import {
  Keypair,
  PublicKey,
  Signer,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getFundingRecordAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.7";
import { getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let autocratClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let baseVault: PublicKey;
  let quoteVault: PublicKey;
  let funderBaseAccount: PublicKey;
  let funderQuoteAccount: PublicKey;
  let launchAuthority: Signer;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);
  const unlockThreshold = new BN(2000_000000);

  before(async function () {
    autocratClient = this.futarchy;
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

    baseVault = getAssociatedTokenAddressSync(META, launchSigner, true);
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );
    funderBaseAccount = getAssociatedTokenAddressSync(
      META,
      this.payer.publicKey,
    );
    funderQuoteAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // TODO: put this in main test
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
        hasBidWall: false,
      })
      .rpc();
  });

  it("fails to fund the launch before it's started", async function () {
    await this.createTokenAccount(META, this.payer.publicKey);
    const fundAmount = new BN(100_000000); // 100 USDC

    try {
      await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });

  it("successfully funds the launch", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

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
  });

  it("successfully funds the launch multiple times", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount1 = new BN(100_000000); // 100 USDC
    const fundAmount2 = new BN(200_000000); // 200 USDC
    const totalAmount = fundAmount1.add(fundAmount2);

    // First funding
    await launchpadClient.fundIx({ launch, amount: fundAmount1 }).rpc();

    // Second funding
    await launchpadClient.fundIx({ launch, amount: fundAmount2 }).rpc();

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
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    // Advance time to exactly the boundary (start + secondsForLaunch)
    await this.advanceBySeconds(secondsForLaunch);

    try {
      await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
      assert.fail("Expected fund instruction to fail at exact boundary");
    } catch (e) {
      assert.include(e.message, "LaunchExpired");
    }
  });

  it("fails to fund the launch after time expires", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    // Fast forward time past the launch period (60 * 60 seconds)
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 10);

    try {
      await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "LaunchExpired");
    }
  });

  it("accumulator starts at 0 and last_accumulator_update is set on first fund", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000_000); // 100 USDC
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const record = await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(record.committedAmountAccumulator.toString(), "0");
    assert.isAbove(record.lastAccumulatorUpdate.toNumber(), 0);
  });

  it("accumulator correctly sums across multiple time intervals", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    // Fund 100 USDC at t=0
    await launchpadClient.fundIx({ launch, amount: new BN(100_000_000) }).rpc();

    // Advance 30s, fund 200 USDC at t=30
    // Flush: 100_000_000 * 30 = 3_000_000_000
    await this.advanceBySeconds(30);
    await launchpadClient
      .fundIx({ launch, amount: new BN(200_000_000) })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    let record = await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(record.committedAmountAccumulator.toString(), "3000000000");

    // Advance 60s, fund 50 USDC at t=90
    // Flush: 300_000_000 * 60 = 18_000_000_000
    await this.advanceBySeconds(60);
    await launchpadClient
      .fundIx({ launch, amount: new BN(50_000_000) })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    record = await launchpadClient.fetchFundingRecord(fundingRecord);
    // 3_000_000_000 + 18_000_000_000 = 21_000_000_000
    assert.equal(record.committedAmountAccumulator.toString(), "21000000000");
  });

  it("accumulator stays 0 during activation delay period", async function () {
    // Need a fresh launch with custom accumulatorActivationDelaySeconds
    const result = await initializeMintWithSeeds(
      this.banksClient,
      launchpadClient,
      this.payer,
    );

    const delayLaunch = result.launch;

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: result.tokenMint,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend,
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        accumulatorActivationDelaySeconds: 120, // 2 minutes
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({
        launch: delayLaunch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(result.tokenMint, this.payer.publicKey);

    // Fund 100 USDC
    await launchpadClient
      .fundIx({ launch: delayLaunch, amount: new BN(100_000_000) })
      .rpc();

    // Advance 60s (still within 120s delay)
    await this.advanceBySeconds(60);

    // Second fund to trigger flush attempt
    await launchpadClient
      .fundIx({ launch: delayLaunch, amount: new BN(1_000_000) })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      delayLaunch,
      this.payer.publicKey,
    );

    const record = await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(record.committedAmountAccumulator.toString(), "0");
  });

  it("accumulator only counts time after activation delay", async function () {
    // Need a fresh launch with custom accumulatorActivationDelaySeconds
    const result = await initializeMintWithSeeds(
      this.banksClient,
      launchpadClient,
      this.payer,
    );

    const delayLaunch = result.launch;

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: result.tokenMint,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend,
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        accumulatorActivationDelaySeconds: 60, // 1 minute
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient
      .startLaunchIx({
        launch: delayLaunch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(result.tokenMint, this.payer.publicKey);

    // Fund 100 USDC at t=0
    await launchpadClient
      .fundIx({ launch: delayLaunch, amount: new BN(100_000_000) })
      .rpc();

    // Advance 90s (activation at t=60, so 30s of active time)
    await this.advanceBySeconds(90);

    // Second fund to trigger flush
    await launchpadClient
      .fundIx({ launch: delayLaunch, amount: new BN(1_000_000) })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      delayLaunch,
      this.payer.publicKey,
    );

    const record = await launchpadClient.fetchFundingRecord(fundingRecord);
    // 100_000_000 * 30 = 3_000_000_000
    assert.equal(record.committedAmountAccumulator.toString(), "3000000000");
  });
}
