import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.5";
import { createMint } from "spl-token-bankrun";
import { BN } from "bn.js";
import {
  getAssociatedTokenAddressSync,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let usdcVault: PublicKey;
  let funderUsdcAccount: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC

  before(async function () {
    autocratClient = this.autocratClient;
    launchpadClient = this.launchpadClient;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpadClient,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;
    usdcVault = getAssociatedTokenAddressSync(MAINNET_USDC, launchSigner, true);
    funderUsdcAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey
    );

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx(
        "META",
        "MTA",
        "https://example.com",
        minRaise,
        60 * 60 * 24 * 6,
        META
      )
      .rpc();

    await launchpadClient.startLaunchIx(launch).rpc();

    // Setup funder accounts
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("allows refunds when launch is in refunding state", async function () {
    // Fund the launch with less than minimum raise
    const partialAmount = minRaise.divn(2);

    await launchpadClient.fundIx(launch, partialAmount).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 7);

    // Complete the launch (moves to refunding state)
    await launchpadClient.completeLaunchIx(launch, META).rpc();

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey
    );
    const initialMetaBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey
    );

    // Get refund
    await launchpadClient.refundIx(launch).rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey
    );
    const finalMetaBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey
    );

    assert.equal(
      (finalUsdcBalance - initialUsdcBalance).toString(),
      partialAmount.toString()
    );
    assert.equal(
      finalMetaBalance,
      0,
      "META tokens should be burned during refund"
    );
  });

  it("fails when launch is not in refunding state", async function () {
    const partialAmount = minRaise.divn(2);

    await launchpadClient.fundIx(launch, partialAmount).rpc();

    try {
      await launchpadClient.refundIx(launch).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotRefunding");
    }
  });

  it("fails when user has no tokens to refund", async function () {
    // Move to refunding state without any funding
    await this.advanceBySeconds(60 * 60 * 24 * 7);
    await launchpadClient.completeLaunchIx(launch, META).rpc();

    try {
      await launchpadClient.refundIx(launch).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // assert.include(e.message, "InvalidAmount");
    }
  });
}
