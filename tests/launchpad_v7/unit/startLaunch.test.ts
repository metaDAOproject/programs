import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { assert } from "chai";
import { FutarchyClient, LaunchpadClient } from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";

import { initializeMintWithSeeds } from "../utils.js";
import { MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Signer;
  const minRaise = new BN(1000_000000); // 1000 USDC

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

    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);
    const unlockThreshold = new BN(2000_000000);

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
      })
      .rpc();
  });

  it("starts launch correctly", async function () {
    // Check initial state
    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.isNull(launchAccount.unixTimestampStarted);
    assert.exists(launchAccount.state.initialized);

    // Get current slot for comparison
    const clock = await this.banksClient.getClock();

    // Start the launch
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();

    // Check final state
    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.unixTimestampStarted.toString(),
      clock.unixTimestamp.toString(),
    );
    assert.exists(launchAccount.state.live);
  });
}
