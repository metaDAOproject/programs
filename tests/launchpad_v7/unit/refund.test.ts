import {
  Keypair,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderQuoteAccount: PublicKey;
  let launchAuthority: Signer;

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
      launchAuthority: launchAuthority.publicKey,
    });

    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();

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
    const minRaise = new BN(100_000 * 10 ** 6);

    // fund the launch with more than the minimum raise
    await launchpadClient
      .fundIx({ launch, amount: new BN(211_000 * 1e6) })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 4);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        approvedAmount: minRaise,
        launch,
        funder: this.payer.publicKey,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
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
    tx.sign([this.payer, launchAuthority]);

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

    // User deposited 211k USDC, but only 100k was used to buy tokens. So 111k is refunded.
    const refundAmount = finalUsdcBalance - initialUsdcBalance;
    assert.equal(refundAmount, 111_000n * 1_000_000n);
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
