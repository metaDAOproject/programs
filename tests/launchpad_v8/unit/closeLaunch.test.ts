import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.8";
import { MAINNET_USDC } from "@metadaoproject/programs";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;

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
  });

  it("successfully closes launch after sufficient time when minimum raise is met", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const secondsForLaunch = launchAccount.secondsForLaunch;

    await this.advanceBySeconds(secondsForLaunch + 100);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const updatedLaunch = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(updatedLaunch.state, { closed: {} });
    assert.isNotNull(updatedLaunch.unixTimestampClosed);
  });

  it("successfully closes launch after sufficient time when minimum raise is not met", async function () {
    const fundAmount = new BN(100 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const secondsForLaunch = launchAccount.secondsForLaunch;

    await this.advanceBySeconds(secondsForLaunch + 100);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const updatedLaunch = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(updatedLaunch.state, { refunding: {} });
    assert.isNotNull(updatedLaunch.unixTimestampClosed);
  });

  it("fails to close launch before sufficient time has passed", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    await this.advanceBySeconds(60 * 60);

    const callbacks = expectError(
      "LaunchPeriodNotOver",
      "Should have rejected closing before launch period ended",
    );

    await launchpadClient
      .closeLaunchIx({ launch })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { live: {} });
    assert.isNull(launchAccount.unixTimestampClosed);
  });

  it("fails to close launch when launch has already been closed", async function () {
    const fundAmount = new BN(150_000 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const secondsForLaunch = launchAccount.secondsForLaunch;

    await this.advanceBySeconds(secondsForLaunch + 100);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const callbacks = expectError(
      "LaunchNotLive",
      "Should have rejected closing an already closed launch",
    );

    await launchpadClient
      .closeLaunchIx({ launch })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to close launch when launch is still in Initialized state", async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v8,
      this.payer,
    );
    const newLaunch = result.launch;
    const newMETA = result.tokenMint;

    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META2",
        tokenSymbol: "META2",
        tokenUri: "https://example.com",
        minimumRaiseAmount: new BN(100_000 * 10 ** 6),
        secondsForLaunch: 60 * 60 * 24 * 4,
        baseMint: newMETA,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        hasBidWall: false,
      })
      .rpc();

    const callbacks = expectError(
      "LaunchNotLive",
      "Should have rejected closing an initialized (not started) launch",
    );

    await launchpadClient
      .closeLaunchIx({ launch: newLaunch })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const launchAccount = await launchpadClient.fetchLaunch(newLaunch);
    assert.deepEqual(launchAccount.state, { initialized: {} });
  });
}
