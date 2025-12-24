import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getLaunchSignerAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.6";
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
  });

  it("returns funds to the recipient", async function () {
    const amount_wrongly_sent = new BN(100);

    const initialUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const [launchSigner] = getLaunchSignerAddr(
      launchpadClient.launchpad.programId,
      launch,
    );

    const launchQuoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );

    const recipientQuoteAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
      true,
    );

    // Transfer wrongly sent USDC to the launch signer
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      launchSigner,
      amount_wrongly_sent.toNumber(),
    );

    await launchpadClient.launchpad.methods
      .returnFunds({ amount: amount_wrongly_sent })
      .accounts({
        launch,
        recipient: this.payer.publicKey,
        recipientQuoteAccount,
        launchQuoteVault,
        launchSigner,
        admin: this.payer.publicKey, // This should be the multisig vault, but without the `production` flag, it can be anyone
      })
      .rpc();

    const finalUsdcBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // The recipient should have received the wrongly sent USDC, thus no balance change
    assert.equal(finalUsdcBalance, initialUsdcBalance);
  });
}
