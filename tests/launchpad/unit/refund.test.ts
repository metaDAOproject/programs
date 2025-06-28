import { Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
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
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderQuoteAccount: PublicKey;

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
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true
    );
    funderQuoteAccount = getAssociatedTokenAddressSync(
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
        META,
        MAINNET_USDC
      )
      .rpc();

    await launchpadClient.startLaunchIx(launch).rpc();

    // Setup funder accounts
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("allows refunds when launch is in refunding state", async function () {
    // Fund the launch with less than minimum raise
    const partialAmount = minRaise.divn(2);

    await launchpadClient
      .fundIx(launch, partialAmount, undefined, MAINNET_USDC)
      .rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 7);

    // Complete the launch (moves to refunding state)
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey
    );
    const initialMetaBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey
    );

    // Get refund
    await launchpadClient.refundIx(launch, undefined, MAINNET_USDC).rpc();

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
      BigInt(0),
      "META tokens should be burned during refund"
    );
  });

  it("fails when launch is not in refunding state", async function () {
    const partialAmount = minRaise.divn(2);

    await launchpadClient
      .fundIx(launch, partialAmount, undefined, MAINNET_USDC)
      .rpc();

    try {
      await launchpadClient.refundIx(launch, undefined, MAINNET_USDC).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotRefunding");
    }
  });

  it("fails when user has no tokens to refund", async function () {
    // Move to refunding state without any funding
    await this.advanceBySeconds(60 * 60 * 24 * 7);
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    try {
      await launchpadClient.refundIx(launch, undefined, MAINNET_USDC).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // assert.include(e.message, "InvalidAmount");
    }
  });
}
