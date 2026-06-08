import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.6";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { createLookupTableForTransaction } from "../utils/utils.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const FINAL_RAISE_AMOUNT = null;

export const launch = async () => {
  const mintKp = new PublicKey("PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta");

  const [launch] = getLaunchAddr(undefined, mintKp);

  await launchpad.closeLaunchIx({ launch }).rpc();

  const tx = await launchpad
    .completeLaunchTxBuilder({
      launch,
      // quoteMint: DEVNET_USDC,
      baseMint: mintKp,
      finalRaiseAmount: new BN(FINAL_RAISE_AMOUNT * 10 ** 6),
      launchAuthority: payer.publicKey,
    })
    .transaction();

  const LUT = await createLookupTableForTransaction(
    tx,
    payer,
    provider.connection,
  );

  const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([LUT]);

  const vtx = new VersionedTransaction(message);
  vtx.sign([payer]);
  await provider.connection.sendTransaction(vtx, { skipPreflight: true });
};

launch().catch(console.error);
