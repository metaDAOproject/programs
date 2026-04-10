import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  LaunchpadClient,
  getFundingRecordAddr,
} from "@metadaoproject/futarchy-v2/launchpad/v0.8";
import { MAINNET_USDC } from "@metadaoproject/futarchy-v2";
import { getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;
  let quoteVault: PublicKey;

  before(async function () {
    launchpadClient = this.launchpad_v8;
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

    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });
  });

  it("fails to fund the launch before it's started", async function () {
    const fundAmount = new BN(100 * 10 ** 6);

    const callbacks = expectError(
      "InvalidLaunchState",
      "Should have rejected funding before launch started",
    );

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("successfully funds the launch", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundAmount = new BN(100 * 10 ** 6);

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      fundAmount.toString(),
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), fundAmount.toString());

    const [fundingRecord, pdaBump] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      fundAmount.toString(),
    );
    assert.equal(fundingRecordAccount.pdaBump, pdaBump);
    assert.ok(fundingRecordAccount.funder.equals(this.payer.publicKey));
    assert.ok(fundingRecordAccount.launch.equals(launch));
    assert.isFalse(fundingRecordAccount.isTokensClaimed);
    assert.isFalse(fundingRecordAccount.isUsdcRefunded);
    assert.equal(fundingRecordAccount.approvedAmount.toString(), "0");
  });

  it("two different funders get independent funding records", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const funder2 = new Keypair();
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      500 * 10 ** 6,
    );

    const amount1 = new BN(100 * 10 ** 6);
    const amount2 = new BN(300 * 10 ** 6);

    // Funder 1 (payer)
    await launchpadClient
      .fundIx({
        launch,
        amount: amount1,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Funder 2
    await launchpadClient
      .fundIx({
        launch,
        amount: amount2,
        funder: funder2.publicKey,
        payer: this.payer.publicKey,
      })
      .signers([funder2])
      .rpc();

    // Each funding record is independent
    const [fr1] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );
    const [fr2] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      funder2.publicKey,
    );

    const frAccount1 = await launchpadClient.fetchFundingRecord(fr1);
    const frAccount2 = await launchpadClient.fetchFundingRecord(fr2);

    assert.equal(frAccount1.committedAmount.toString(), amount1.toString());
    assert.ok(frAccount1.funder.equals(this.payer.publicKey));

    assert.equal(frAccount2.committedAmount.toString(), amount2.toString());
    assert.ok(frAccount2.funder.equals(funder2.publicKey));

    // Launch total is the sum
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      amount1.add(amount2).toString(),
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(
      usdcVaultAccount.amount.toString(),
      amount1.add(amount2).toString(),
    );
  });

  it("successfully funds the launch multiple times", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundAmount1 = new BN(100 * 10 ** 6);
    const fundAmount2 = new BN(200 * 10 ** 6);
    const totalAmount = fundAmount1.add(fundAmount2);

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount1,
        payer: this.payer.publicKey,
      })
      .rpc();

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount2,
        payer: this.payer.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      totalAmount.toString(),
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), totalAmount.toString());

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      totalAmount.toString(),
    );
  });

  it("fails to fund the launch at the exact boundary second", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const secondsForLaunch = launchAccount.secondsForLaunch;

    // Advance to the exact expiration boundary
    await this.advanceBySeconds(secondsForLaunch);

    const fundAmount = new BN(100 * 10 ** 6);

    const callbacks = expectError(
      "LaunchExpired",
      "Should have rejected funding at exact boundary",
    );

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to fund the launch after time expires", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const secondsForLaunch = launchAccount.secondsForLaunch;

    // Advance past the launch period
    await this.advanceBySeconds(secondsForLaunch + 10);

    const fundAmount = new BN(100 * 10 ** 6);

    const callbacks = expectError(
      "LaunchExpired",
      "Should have rejected funding after expiration",
    );

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("accumulator starts at 0 and last_accumulator_update is set on first fund", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const clock = await this.banksClient.getClock();

    const fundAmount = new BN(100 * 10 ** 6);

    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(
      fundingRecordAccount.committedAmountAccumulator.toString(),
      "0",
    );
    assert.equal(
      fundingRecordAccount.lastAccumulatorUpdate.toString(),
      clock.unixTimestamp.toString(),
    );
  });

  it("accumulator correctly sums across multiple time intervals", async function () {
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const fundAmount1 = new BN(100 * 10 ** 6);
    const fundAmount2 = new BN(200 * 10 ** 6);

    // First fund at t=0
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount1,
        payer: this.payer.publicKey,
      })
      .rpc();

    const clock1 = await this.banksClient.getClock();

    // Advance 60 seconds
    const elapsed1 = 60;
    await this.advanceBySeconds(elapsed1);

    // Second fund at t=60
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount2,
        payer: this.payer.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);

    // Accumulator = fundAmount1 * elapsed1 = 100_000_000 * 60 = 6_000_000_000
    const expectedAccumulator = new BN(100 * 10 ** 6).muln(elapsed1);
    assert.equal(
      fundingRecordAccount.committedAmountAccumulator.toString(),
      expectedAccumulator.toString(),
    );
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      fundAmount1.add(fundAmount2).toString(),
    );
  });

  it("accumulator stays 0 during activation delay period", async function () {
    // Create a launch with accumulator activation delay
    const delayResult = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );
    const delayMeta = delayResult.tokenMint;
    const delayLaunch = delayResult.launch;
    const delayLaunchSigner = delayResult.launchSigner;
    const delayLaunchAuthority = new Keypair();

    const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days
    const delaySeconds = 3600; // 1 hour delay

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "DELAY",
        tokenSymbol: "DELAY",
        tokenUri: "https://example.com",
        minimumRaiseAmount: new BN(100_000 * 10 ** 6),
        secondsForLaunch,
        baseMint: delayMeta,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: delayLaunchAuthority.publicKey,
        accumulatorActivationDelaySeconds: delaySeconds,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({
        launch: delayLaunch,
        launchAuthority: delayLaunchAuthority.publicKey,
      })
      .signers([delayLaunchAuthority])
      .rpc();

    const fundAmount = new BN(100 * 10 ** 6);

    // Fund at t=0 (within delay period)
    await launchpadClient
      .fundIx({
        launch: delayLaunch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Advance 30 minutes (still within 1 hour delay)
    await this.advanceBySeconds(1800);

    // Fund again still within delay period
    await launchpadClient
      .fundIx({
        launch: delayLaunch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      delayLaunch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);

    // Accumulator should remain 0 because both funds happened during the delay period
    assert.equal(
      fundingRecordAccount.committedAmountAccumulator.toString(),
      "0",
    );
  });

  it("accumulator only counts time after activation delay", async function () {
    // Create a launch with accumulator activation delay
    const delayResult = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );
    const delayMeta = delayResult.tokenMint;
    const delayLaunch = delayResult.launch;
    const delayLaunchSigner = delayResult.launchSigner;
    const delayLaunchAuthority = new Keypair();

    const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days
    const delaySeconds = 3600; // 1 hour delay

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "DELAY2",
        tokenSymbol: "DELAY2",
        tokenUri: "https://example.com",
        minimumRaiseAmount: new BN(100_000 * 10 ** 6),
        secondsForLaunch,
        baseMint: delayMeta,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: delayLaunchAuthority.publicKey,
        accumulatorActivationDelaySeconds: delaySeconds,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({
        launch: delayLaunch,
        launchAuthority: delayLaunchAuthority.publicKey,
      })
      .signers([delayLaunchAuthority])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(delayLaunch);
    const startTime = launchAccount.unixTimestampStarted.toNumber();
    const activationTimestamp = startTime + delaySeconds;

    const fundAmount = new BN(100 * 10 ** 6);

    // Fund at t=0 (before activation)
    await launchpadClient
      .fundIx({
        launch: delayLaunch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Advance past the activation delay + 120 seconds
    const timeAfterActivation = 120;
    await this.advanceBySeconds(delaySeconds + timeAfterActivation);

    // Fund again after activation delay
    await launchpadClient
      .fundIx({
        launch: delayLaunch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      delayLaunch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);

    // The accumulator should only count time after the activation timestamp.
    // period_start = max(last_accumulator_update=startTime, activation_timestamp) = activation_timestamp
    // elapsed = (startTime + delaySeconds + timeAfterActivation) - activation_timestamp = timeAfterActivation = 120
    // accumulator = fundAmount * 120 = 100_000_000 * 120 = 12_000_000_000
    const expectedAccumulator = new BN(100 * 10 ** 6).muln(timeAfterActivation);
    assert.equal(
      fundingRecordAccount.committedAmountAccumulator.toString(),
      expectedAccumulator.toString(),
    );
  });
}
