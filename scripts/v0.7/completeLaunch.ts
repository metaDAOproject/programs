import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  FEE_RECIPIENT,
} from "@metadaoproject/futarchy/v0.7";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createLookupTableForTransaction } from "../utils/utils.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const BID_WALL_FEE_RECIPIENT: PublicKey | undefined = new PublicKey(
  "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf",
);

export const completeLaunch = async () => {
  if (BID_WALL_FEE_RECIPIENT === undefined) {
    throw new Error(
      "BID_WALL_FEE_RECIPIENT is not set. Please set it in the script.",
    );
  }

  const BASE_MINT = new PublicKey(
    "7EJRXkBfoAYtzAXE7PRry4gqh6NciY3Yt5YF3GR8LC8V",
  );

  const [launch] = getLaunchAddr(undefined, BASE_MINT);

  const tx = await launchpad
    .completeLaunchIx({
      launch,
      baseMint: BASE_MINT,
      launchAuthority: payer.publicKey,
      feeRecipient: BID_WALL_FEE_RECIPIENT,
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

  const completeTxHash = await provider.connection.sendTransaction(vtx, {
    skipPreflight: true,
  });

  console.log(`Complete launch transaction sent: ${completeTxHash}`);

  console.log("Launch completed successfully!");

  console.log("Setting up performance package...");

  const initializePerformancePackageTxHash = await launchpad
    .initializePerformancePackageIx({
      launch,
      baseMint: BASE_MINT,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(
    `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  );

  console.log("Performance package set up successfully!");
};

completeLaunch().catch(console.error);
