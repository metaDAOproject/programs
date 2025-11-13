import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";
import { applyFundingFeeInverse } from "../../../sdk/src/v0.6/utils/launch.js";

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
    launchpadClient = this.launchpad;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
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

    const fundAmount = new BN(211_000 * 1e6);

    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    const finalRaiseAmount = new BN(150_000 * 1e6);

    const { amountAfterFees: finalRaiseAmountAfterFees } =
      applyFundingFeeInverse(finalRaiseAmount);

    await this.advanceBySeconds(60 * 60 * 24 * 4);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        baseMint: META,
        finalRaiseAmount,
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

    // Since only one person funded the launch, the refund amount is the difference between the funded amount and the final raise amount after fees
    const expectedRefundAmount = fundAmount.sub(finalRaiseAmountAfterFees);

    const actualRefundAmount = finalUsdcBalance - initialUsdcBalance;

    assert.equal(
      actualRefundAmount.toString(),
      expectedRefundAmount.toString(),
    );
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
