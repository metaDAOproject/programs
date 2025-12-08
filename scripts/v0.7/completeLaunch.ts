import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createLookupTableForTransaction } from "../utils/utils.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const BID_WALL_FEE_RECIPIENT: PublicKey | undefined = undefined;

export const completeLaunch = async () => {
  if (BID_WALL_FEE_RECIPIENT === undefined) {
    throw new Error(
      "BID_WALL_FEE_RECIPIENT is not set. Please set it in the script.",
    );
  }

  const mintKp = new PublicKey("PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta");

  const [launch] = getLaunchAddr(undefined, mintKp);

  const tx = await launchpad
    .completeLaunchIx({
      launch,
      baseMint: mintKp,
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
      baseMint: mintKp,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(
    `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  );

  console.log("Performance package set up successfully!");
};

completeLaunch().catch(console.error);
