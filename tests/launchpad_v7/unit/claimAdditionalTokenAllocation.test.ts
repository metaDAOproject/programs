import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction, expectError } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Signer;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v7,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    launchAuthority = new Keypair();
  });

  it("sets and claims additional token allocation successfully, and only once", async function () {
    const additionalTokensAmount = new BN(100_000000);
    const additionalTokensRecipient = Keypair.generate().publicKey;

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
        additionalTokensAmount: additionalTokensAmount,
        additionalTokensRecipient: additionalTokensRecipient,
      })
      .rpc();

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.additionalTokensAmount.toString(),
      additionalTokensAmount.toString(),
    );
    assert.equal(
      launchAccount.additionalTokensRecipient.toString(),
      additionalTokensRecipient.toString(),
    );
    assert.isFalse(launchAccount.additionalTokensClaimed);

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
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

    const mint = await this.getMint(META);
    assert.equal(
      mint.supply,
      12_900_000 * 10 ** 6 +
        Number(premineAmount) +
        Number(additionalTokensAmount),
    );

    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: additionalTokensRecipient,
      })
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.isTrue(launchAccount.additionalTokensClaimed);

    const additionalTokensRecipientBalance = await this.getTokenBalance(
      META,
      additionalTokensRecipient,
    );
    assert.equal(
      additionalTokensRecipientBalance.toString(),
      additionalTokensAmount.toString(),
    );

    const callbacks = expectError(
      "AdditionalTokensAlreadyClaimed",
      "Additional tokens already claimed",
    );

    // Try to claim again, should fail
    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: additionalTokensRecipient,
      })
      .preInstructions([
        // unique value to prevent same recent blockhash on next claim tx, which would cause the transaction to fail
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to claim additional token allocation if the launch doesn't have one", async function () {
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
        monthlySpendingLimitAmount: monthlySpend,
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

    await launchpadClient.fundIx({ launch, amount: minRaise }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
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

    const callbacks = expectError(
      "NoAdditionalTokensRecipientSet",
      "No additional tokens recipient set",
    );

    const fakeRecipient = Keypair.generate().publicKey;

    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: fakeRecipient,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
