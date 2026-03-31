import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Signer,
} from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient, MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Signer;

  const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days

  before(async function () {
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

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
  });

  it("successfully extends a live launch", async function () {
    const launchBefore = await launchpadClient.getLaunch(launch);
    const originalSeconds = launchBefore.secondsForLaunch;

    const extensionSeconds = 60 * 60 * 24; // 1 day

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    const launchAfter = await launchpadClient.getLaunch(launch);
    assert.equal(
      launchAfter.secondsForLaunch,
      originalSeconds + extensionSeconds,
    );
    assert.equal(
      launchAfter.seqNum.toNumber(),
      launchBefore.seqNum.toNumber() + 1,
    );
  });

  it("funders can still fund after original deadline if extended", async function () {
    const extensionSeconds = 60 * 60 * 24 * 2; // 2 extra days

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    // Advance past the *original* deadline but still within extended window
    await this.advanceBySeconds(secondsForLaunch + 100);

    // Funding should still work
    const fundAmount = new BN(100_000_000); // 100 USDC
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    const launchAccount = await launchpadClient.getLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      fundAmount.toString(),
    );
  });

  it("close_launch respects new extended deadline", async function () {
    const extensionSeconds = 60 * 60 * 24 * 2; // 2 extra days

    await launchpadClient
      .extendLaunchIx({
        launch,
        durationSeconds: extensionSeconds,
        admin: this.payer.publicKey,
      })
      .rpc();

    // Fund the launch
    const fundAmount = new BN(100_000_000); // 100 USDC
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance past original deadline but before extended deadline
    await this.advanceBySeconds(secondsForLaunch + 100);

    // close_launch should fail — still within extended window
    try {
      await launchpadClient.closeLaunchIx({ launch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchPeriodNotOver");
    }

    // Advance past the extended deadline
    await this.advanceBySeconds(extensionSeconds);

    // close_launch should now succeed
    await launchpadClient
      .closeLaunchIx({ launch })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .rpc();

    const launchAccount = await launchpadClient.getLaunch(launch);
    assert.isDefined(
      launchAccount.state.refunding || launchAccount.state.closed,
    );
  });
}
