import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.5";
import { createMint } from "spl-token-bankrun";
import { BN } from "bn.js";
import {
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { MAINNET_USDC } from "@metadaoproject/futarchy/v0.3";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let dao: PublicKey;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  const minRaise = new BN(1000_000000); // 1000 USDC

  before(async function () {
    autocratClient = this.futarchy;
    launchpadClient = this.launchpad;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx(
        "META",
        "MTA",
        "https://example.com",
        minRaise,
        60 * 60 * 24 * 2,
        META,
        MAINNET_USDC,
        new BN(100_000000), // 100 USDC burn
        [this.payer.publicKey]
      )
      .rpc();
  });

  it("starts launch correctly", async function () {
    // Check initial state
    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(launchAccount.unixTimestampStarted.toString(), "0");
    assert.exists(launchAccount.state.initialized);

    // Get current slot for comparison
    const clock = await this.banksClient.getClock();

    // Start the launch
    await launchpadClient.startLaunchIx(launch).rpc();

    // Check final state
    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.unixTimestampStarted.toString(),
      clock.unixTimestamp.toString()
    );
    assert.exists(launchAccount.state.live);
  });
}
