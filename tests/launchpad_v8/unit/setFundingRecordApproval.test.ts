import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  LaunchpadClient,
  getFundingRecordAddr,
} from "@metadaoproject/futarchy-v2/launchpad/v0.8";
import { MAINNET_USDC } from "@metadaoproject/futarchy-v2";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;

  const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days

  const funder1 = Keypair.generate();
  const funder2 = Keypair.generate();
  const funder3 = Keypair.generate();
  const funder4 = Keypair.generate();

  const funder1Amount = new BN(30_000 * 10 ** 6); // 30,000 USDC
  const funder2Amount = new BN(40_000 * 10 ** 6); // 40,000 USDC
  const funder3Amount = new BN(20_000 * 10 ** 6); // 20,000 USDC
  const funder4Amount = new BN(50_000 * 10 ** 6); // 50,000 USDC

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
    launchpadClient = this.launchpad_v8;

    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder4.publicKey);
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    launchAuthority = new Keypair();

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });

    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    // Mint USDC to funders (10x for oversubscription cases)
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
    await fundLaunch();
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Set funder1's approval to full amount
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

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.toString(),
    );

    // Update to partial amount (half)
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

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.div(new BN(2)).toString(),
    );

    // Update to zero
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

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(launchAccount.totalApprovedAmount.toString(), "0");
  });

  it("correctly updates the launch account total approved amount", async function () {
    await fundLaunch();
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Approve funder1
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
    const fundingRecord1Account =
      await launchpadClient.getFundingRecord(fundingRecord1);
    assert.equal(
      fundingRecord1Account.approvedAmount.toString(),
      funder1Amount.toString(),
    );

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.toString(),
    );

    // Approve funder2
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        approvedAmount: funder2Amount,
        funder: funder2.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundingRecord2 = launchpadClient.getFundingRecordAddress({
      launch,
      funder: funder2.publicKey,
    });
    const fundingRecord2Account =
      await launchpadClient.getFundingRecord(fundingRecord2);
    assert.equal(
      fundingRecord2Account.approvedAmount.toString(),
      funder2Amount.toString(),
    );

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalApprovedAmount.toString(),
      funder1Amount.add(funder2Amount).toString(),
    );
  });

  it("can't set funding record approval before the launch period ends", async function () {
    await fundLaunch();

    const callbacks = expectError("InvalidLaunchState", "Invalid launch state");

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

  it("can't set funding record approval after the funding record approval period ends (2 days after launch is closed)", async function () {
    await fundLaunch();
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Advance exactly 2 days (the boundary)
    await this.advanceBySeconds(60 * 60 * 24 * 2);

    const callbacks = expectError(
      "FundingRecordApprovalPeriodOver",
      "Funding record approval period is over",
    );

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

  // TODO: needs settle_launch to reach Complete state
  it("can't set funding record approval after the launch is completed");

  it("can't set funding record approval to an amount greater than the committed amount", async function () {
    await fundLaunch();
    await this.advanceBySeconds(secondsForLaunch + 1);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const callbacks = expectError(
      "InsufficientFunds",
      "Failed to set funding record approval to an amount greater than the committed amount",
    );

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
}
