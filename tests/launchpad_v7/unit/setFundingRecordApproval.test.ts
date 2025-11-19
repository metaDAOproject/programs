import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
} from "@metadaoproject/futarchy/v0.5";
import {
  FutarchyClient,
  getMetadataAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { deserializeMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction, expectError } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);
  const unlockThreshold = new BN(2000_000000);

  const launchAuthority = Keypair.generate();

  const funder1 = Keypair.generate();
  const funder2 = Keypair.generate();
  const funder3 = Keypair.generate();
  const funder4 = Keypair.generate();

  const funder1Amount = new BN(100_000_000); // 100 USDC
  const funder2Amount = new BN(200_000_000); // 200 USDC
  const funder3Amount = new BN(300_000_000); // 300 USDC
  const funder4Amount = new BN(400_000_000); // 400 USDC

  async function fundLaunch() {
    await launchpadClient
      .fundIx({ launch, amount: funder1Amount, funder: funder1.publicKey })
      .signers([funder1])
      .rpc();
    await launchpadClient
      .fundIx({ launch, amount: funder2Amount, funder: funder2.publicKey })
      .signers([funder2])
      .rpc();
    await launchpadClient
      .fundIx({ launch, amount: funder3Amount, funder: funder3.publicKey })
      .signers([funder3])
      .rpc();
    await launchpadClient
      .fundIx({ launch, amount: funder4Amount, funder: funder4.publicKey })
      .signers([funder4])
      .rpc();
  }

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad;

    // Setup token accounts for funders
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder4.publicKey);
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    // Mint USDC to funders
    // Mint 10x the amount of the funder's actual amount for cases where we're testing oversubscriptions
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      funder1Amount.toNumber() * 10,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      funder2Amount.toNumber() * 10,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      funder3Amount.toNumber() * 10,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder4.publicKey,
      funder4Amount.toNumber() * 10,
    );
  });

  it("can set funding record approval for full, partial, and zero amounts", async function () {
    // Fully fund the launch and wait for the launch period to end
    await fundLaunch();
    this.advanceBySeconds(secondsForLaunch + 1);

    // Set funder1's funding record approval to the full amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundingRecord1 = launchpadClient.getFundingRecordAddress({
      launch,
      funder: funder1.publicKey,
    });

    let fundingRecord1Account =
      await launchpadClient.getFundingRecord(fundingRecord1);

    assert.equal(
      fundingRecord1Account.approvedAmount.toString(),
      funder1Amount.toString(),
    );

    let launchAccount = await launchpadClient.getLaunch(launch);

    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.toString(),
    );

    // Set funder1's funding record approval to the partial amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount.div(new BN(2)),
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    fundingRecord1Account =
      await launchpadClient.getFundingRecord(fundingRecord1);
    assert.equal(
      fundingRecord1Account.approvedAmount.toString(),
      funder1Amount.div(new BN(2)).toString(),
    );

    launchAccount = await launchpadClient.getLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.div(new BN(2)).toString(),
    );

    // Set funder1's funding record approval to the zero amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: new BN(0),
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    fundingRecord1Account =
      await launchpadClient.getFundingRecord(fundingRecord1);
    assert.equal(fundingRecord1Account.approvedAmount.toString(), "0");

    launchAccount = await launchpadClient.getLaunch(launch);
    assert.equal(launchAccount.totalApprovedAmount.toString(), "0");
  });

  it("correctly updates the launch account total approved amount", async function () {
    // Fully fund the launch and wait for the launch period to end
    await fundLaunch();
    this.advanceBySeconds(secondsForLaunch + 1);

    // Set funder1's funding record approval to the full amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundingRecord1 = launchpadClient.getFundingRecordAddress({
      launch,
      funder: funder1.publicKey,
    });

    const fundingRecord2 = launchpadClient.getFundingRecordAddress({
      launch,
      funder: funder2.publicKey,
    });

    // Funding record 1 should have the approved amount of funder1
    const fundingRecord1Account =
      await launchpadClient.getFundingRecord(fundingRecord1);
    assert.equal(
      fundingRecord1Account.approvedAmount.toString(),
      funder1Amount.toString(),
    );

    // Launch should have the total approved amount of funder1
    let launchAccount = await launchpadClient.getLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.toString(),
    );

    // Set funder2's funding record approval to the full amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder2Amount,
        funder: funder2.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    // Funding record 1 should have the approved amount of funder2
    const fundingRecord2Account =
      await launchpadClient.getFundingRecord(fundingRecord2);
    assert.equal(
      fundingRecord2Account.approvedAmount.toString(),
      funder2Amount.toString(),
    );

    // Launch should have the total approved amount of funder1 and funder2
    launchAccount = await launchpadClient.getLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.add(funder2Amount).toString(),
    );
  });

  it("can't set funding record approval before the launch period ends", async function () {
    // Fully fund the launch
    await fundLaunch();

    // Skip waiting for the launch period to end

    const callbacks = expectError(
      "LaunchPeriodNotOver",
      "Launch is complete, no more funding allowed",
    );

    // Set funder1's funding record approval to the full amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't set funding record approval after the launch is closed", async function () {
    // Fully fund the launch and wait for the launch period to end
    await fundLaunch();
    this.advanceBySeconds(secondsForLaunch + 1);

    // Close the launch
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const callbacks = expectError(
      "LaunchNotLive",
      "Launch must be live to be closed",
    );

    // Set funder1's funding record approval to the full amount - should fail
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't set funding record approval to an amount greater than the committed amount", async function () {
    // Fully fund the launch and wait for the launch period to end
    await fundLaunch();
    this.advanceBySeconds(secondsForLaunch + 1);

    const callbacks = expectError(
      "InsufficientFunds",
      "Failed to set funding record approval to an amount greater than the committed amount",
    );

    // Set funder1's funding record approval to the full amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount.add(new BN(1)),
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("completes a launch with the correct total approved amount, including claims and refunds", async function () {
    // Fully fund the launch twice (oversubscribe 3x)
    // The plan is to oversubscribe 3x, but approve only 1x, so that we refund the extra 2x
    await fundLaunch();
    await fundLaunch();
    await fundLaunch();

    // Wait for the launch period to end
    this.advanceBySeconds(secondsForLaunch + 1);

    // Set funders' funding record approvals to the 1x amount
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder1Amount,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder2Amount,
        funder: funder2.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder3Amount,
        funder: funder3.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder4Amount,
        funder: funder4.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    // Close the launch
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Complete the launch
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: null,
        launchAuthority: launchAuthority.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(tx);

    // Claim tokens for all funders
    await launchpadClient.claimIx(launch, META, funder1.publicKey).rpc();
    await launchpadClient.claimIx(launch, META, funder2.publicKey).rpc();
    await launchpadClient.claimIx(launch, META, funder3.publicKey).rpc();
    await launchpadClient.claimIx(launch, META, funder4.publicKey).rpc();

    // Verify token distributions
    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    const funder2Balance = await this.getTokenBalance(META, funder2.publicKey);
    const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);
    const funder4Balance = await this.getTokenBalance(META, funder4.publicKey);

    const totalApprovedAmount = funder1Amount
      .add(funder2Amount)
      .add(funder3Amount)
      .add(funder4Amount);

    const totalTokens = new BN(10_000_000_000000); // 10M tokens

    assert.equal(
      funder1Balance.toString(),
      totalTokens.mul(funder1Amount).div(totalApprovedAmount).toString(),
    );
    assert.equal(
      funder2Balance.toString(),
      totalTokens.mul(funder2Amount).div(totalApprovedAmount).toString(),
    );
    assert.equal(
      funder3Balance.toString(),
      totalTokens.mul(funder3Amount).div(totalApprovedAmount).toString(),
    );
    assert.equal(
      funder4Balance.toString(),
      totalTokens.mul(funder4Amount).div(totalApprovedAmount).toString(),
    );

    // Verify refunds
    const funder1BalanceBeforeRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const funder2BalanceBeforeRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder2.publicKey,
    );
    const funder3BalanceBeforeRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );
    const funder4BalanceBeforeRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder4.publicKey,
    );

    await launchpadClient.refundIx({ launch, funder: funder1.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder2.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder3.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder4.publicKey }).rpc();

    const funder1BalanceAfterRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const funder2BalanceAfterRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder2.publicKey,
    );
    const funder3BalanceAfterRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );
    const funder4BalanceAfterRefund = await this.getTokenBalance(
      MAINNET_USDC,
      funder4.publicKey,
    );

    assert.equal(
      (funder1BalanceAfterRefund - funder1BalanceBeforeRefund).toString(),
      funder1Amount.muln(2).toString(),
    );
    assert.equal(
      (funder2BalanceAfterRefund - funder2BalanceBeforeRefund).toString(),
      funder2Amount.muln(2).toString(),
    );
    assert.equal(
      (funder3BalanceAfterRefund - funder3BalanceBeforeRefund).toString(),
      funder3Amount.muln(2).toString(),
    );
    assert.equal(
      (funder4BalanceAfterRefund - funder4BalanceBeforeRefund).toString(),
      funder4Amount.muln(2).toString(),
    );
  });
}
