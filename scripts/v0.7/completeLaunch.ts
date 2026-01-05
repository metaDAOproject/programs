import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createLookupTableForTransaction } from "../utils/utils.js";

const LAUNCH_TO_COMPLETE: PublicKey | undefined = new PublicKey(
  "111111111111111111111111111111111",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const completeLaunch = async () => {
  if (LAUNCH_TO_COMPLETE === undefined) {
    throw new Error(
      "LAUNCH_TO_COMPLETE is not set. Please set it in the script.",
    );
  }

  let launchAccount = await launchpad.fetchLaunch(LAUNCH_TO_COMPLETE);

  const tx = await launchpad
    .completeLaunchIx({
      launch: LAUNCH_TO_COMPLETE,
      baseMint: launchAccount.baseMint,
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

  const completeTxHash = await provider.connection.sendTransaction(vtx);

  console.log(`Complete launch transaction sent: ${completeTxHash}`);

  console.log("Launch completed successfully!");

  console.log("Setting up performance package...");

  // Refresh launch account to get the updated base mint
  launchAccount = await launchpad.fetchLaunch(LAUNCH_TO_COMPLETE);

  const initializePerformancePackageTxHash = await launchpad
    .initializePerformancePackageIx({
      launch: LAUNCH_TO_COMPLETE,
      baseMint: launchAccount.baseMint,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(
    `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  );

  console.log("Performance package set up successfully!");
};

completeLaunch().catch(console.error);
