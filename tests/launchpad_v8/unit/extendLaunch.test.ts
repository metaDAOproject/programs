import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.8";
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

  it("successfully extends a live launch", async function () {
    const launchBefore = await launchpadClient.fetchLaunch(launch);
    const originalSeconds = launchBefore.secondsForLaunch;

    const extensionSeconds = 60 * 60 * 24; // 1 day

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    const launchAfter = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAfter.secondsForLaunch,
      originalSeconds + extensionSeconds,
    );
  });

  it("funders can still fund after original deadline if extended", async function () {
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const originalSeconds = launchAccount.secondsForLaunch;

    const extensionSeconds = 60 * 60 * 24 * 2; // 2 days

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    // Advance past the original deadline but before the new one
    await this.advanceBySeconds(originalSeconds + 100);

    const fundAmount = new BN(100 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    const updatedLaunch = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(updatedLaunch.state, { live: {} });
  });

  it("close_launch respects new extended deadline", async function () {
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const originalSeconds = launchAccount.secondsForLaunch;

    const extensionSeconds = 60 * 60 * 24 * 2; // 2 days

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    const fundAmount = new BN(150_000 * 10 ** 6);
    await launchpadClient
      .fundIx({
        launch,
        amount: fundAmount,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Advance past original deadline but before new deadline — close should fail
    await this.advanceBySeconds(originalSeconds + 100);

    const callbacks = expectError(
      "LaunchPeriodNotOver",
      "Should have rejected closing before extended deadline",
    );

    await launchpadClient
      .closeLaunchIx({ launch })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // Advance past the new extended deadline — close should succeed
    await this.advanceBySeconds(extensionSeconds);

    await launchpadClient
      .closeLaunchIx({ launch })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const updatedLaunch = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(updatedLaunch.state, { closed: {} });
  });
}
