import { PublicKey, Keypair, Signer } from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/futarchy-v2/launchpad/v0.8";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchAuthority: Signer;

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
    launchAuthority = new Keypair();

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
      launchAuthority: launchAuthority.publicKey,
    });
  });

  it("starts launch correctly", async function () {
    // Check initial state
    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.isNull(launchAccount.unixTimestampStarted);
    assert.exists(launchAccount.state.initialized);

    const clock = await this.banksClient.getClock();

    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);

    assert.exists(launchAccount.state.live);
    assert.equal(
      launchAccount.unixTimestampStarted.toString(),
      clock.unixTimestamp.toString(),
    );
    assert.equal(launchAccount.seqNum.toString(), "1");
  });
}
