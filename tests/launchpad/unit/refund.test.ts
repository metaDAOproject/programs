import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.6";
import { FutarchyClient, MAINNET_USDC } from "@metadaoproject/programs";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderQuoteAccount: PublicKey;

  before(async function () {
    futarchyClient = this.futarchy;
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
    funderQuoteAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
    });

    await launchpadClient.startLaunchIx({ launch }).rpc();

    // Setup funder accounts
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("allows refunds when launch is in refunding state", async function () {
    // Fund the launch with less than minimum raise
    const partialAmount = new BN(100_000_000_000).divn(2); // 50k USDC

    await launchpadClient.fundIx({ launch, amount: partialAmount }).rpc();

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 7);

    // Close the launch (moves to refunding state)
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const initialMetaBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // Get refund
    await launchpadClient.refundIx({ launch, quoteMint: MAINNET_USDC }).rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const finalMetaBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    assert.equal(
      (finalUsdcBalance - initialUsdcBalance).toString(),
      partialAmount.toString(),
    );
    assert.equal(
      finalMetaBalance,
      BigInt(0),
      "META tokens should be burned during refund",
    );
  });

  it("works for oversubscribed launches", async function () {
    // fund the launch with more than the minimum raise

    await launchpadClient
      .fundIx({ launch, amount: new BN(211_000 * 1e6) })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 4);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        baseMint: META,
        finalRaiseAmount: new BN(150_000 * 1e6),
        launchAuthority: this.payer.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
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
      this.payer.publicKey,
    );

    await launchpadClient.refundIx({ launch }).rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const refundAmount = finalUsdcBalance - initialUsdcBalance;
    assert.equal(refundAmount, 61_000n * 1_000_000n);
  });

  it("properly rounds down when refunding (doesn't fail for last refund with insufficient funds)", async function () {
    const fund1Amount = new BN(100_000 * 1e6);
    const fund2Amount = new BN(66_666 * 1e6);

    const funder1 = new Keypair();
    const funder2 = new Keypair();

    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);

    // Mint USDC to funders
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      fund1Amount.toNumber(),
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      fund2Amount.toNumber(),
    );

    await launchpadClient
      .fundIx({ launch, funder: funder1.publicKey, amount: fund1Amount })
      .signers([funder1])
      .rpc();
    await launchpadClient
      .fundIx({ launch, funder: funder2.publicKey, amount: fund2Amount })
      .signers([funder2])
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 7);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        baseMint: META,
        finalRaiseAmount: new BN(100_000 * 1e6),
        launchAuthority: this.payer.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    await launchpadClient.refundIx({ launch, funder: funder1.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder2.publicKey }).rpc();
  });

  it("fails when launch is not in refunding state", async function () {
    const partialAmount = new BN(100_000_000_000).divn(2); // 50k USDC

    await launchpadClient.fundIx({ launch, amount: partialAmount }).rpc();

    try {
      await launchpadClient.refundIx({ launch, quoteMint: MAINNET_USDC }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchNotRefunding");
    }
  });
}
