import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.6";
import { MAINNET_USDC } from "@metadaoproject/programs";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;

  const minRaise = new BN(100_000_000); // 100 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(10_000_000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(600_000_000_000_0);

  before(async function () {
    launchpadClient = this.launchpad_v6;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v6,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );
    funderUsdcAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
    });

    await launchpadClient.startLaunchIx({ launch }).rpc();

    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("successfully closes launch after sufficient time when minimum raise is met", async function () {
    // Fund the launch to meet minimum raise
    const fundAmount = new BN(150_000_000_000); // 150k USDC (above minimum)
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance clock past the launch period
    await this.advanceBySeconds(secondsForLaunch + 100);

    // Close the launch
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Verify launch state is Closed
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { closed: {} });
    assert.isNotNull(launchAccount.unixTimestampClosed);
  });

  it("successfully closes launch after sufficient time when minimum raise is not met", async function () {
    // Fund the launch with less than minimum raise
    const fundAmount = new BN(50_000_000); // 50 USDC (below minimum)
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance clock past the launch period
    await this.advanceBySeconds(secondsForLaunch + 100);

    // Close the launch
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Verify launch state is Refunding
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { refunding: {} });
    assert.isNotNull(launchAccount.unixTimestampClosed);
  });

  it("fails to close launch before sufficient time has passed", async function () {
    // Fund the launch
    const fundAmount = new BN(150_000_000);
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Try to close before the launch period ends (only advance by 1 hour)
    await this.advanceBySeconds(60 * 60);

    try {
      await launchpadClient.closeLaunchIx({ launch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchPeriodNotOver");
    }

    // Verify launch state is still Live
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { live: {} });
    assert.isNull(launchAccount.unixTimestampClosed);
  });

  it("fails to close launch when launchi s has already been closed", async function () {
    // Fund the launch
    const fundAmount = new BN(150_000_000);
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance clock and close the launch
    await this.advanceBySeconds(secondsForLaunch + 100);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    // Try to close again
    try {
      await launchpadClient
        .closeLaunchIx({ launch })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotLive");
    }
  });

  it("fails to close launch when launch is still in Initialized state", async function () {
    // Create a new launch that stays in Initialized state
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v6,
      this.payer,
    );
    const newLaunch = result.launch;
    const newMETA = result.tokenMint;

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META2",
        tokenSymbol: "META2",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: newMETA,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend,
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
      })
      .rpc();

    // Don't start the launch, keep it in Initialized state
    try {
      await launchpadClient.closeLaunchIx({ launch: newLaunch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotLive");
    }

    // Verify launch state is still Initialized
    const launchAccount = await launchpadClient.fetchLaunch(newLaunch);
    assert.deepEqual(launchAccount.state, { initialized: {} });
  });
}
