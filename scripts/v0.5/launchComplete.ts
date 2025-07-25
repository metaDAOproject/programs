import {
  ComputeBudgetProgram,
  Transaction,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.5";

import dotenv from "dotenv";
import { createLookupTableForTransaction } from "../utils/utils.js";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const LAUNCH_TO_FINALIZE = new PublicKey("7DzBXBYSKhrXHPWT6mAKq394vKupaKaqLn9bK1wscpBz");


const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

async function main() {
  const launch = await launchpad.getLaunch(LAUNCH_TO_FINALIZE);

  const tx = await launchpad
    .completeLaunchIx(LAUNCH_TO_FINALIZE, launch.quoteMint, launch.baseMint, false)
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    ])
    .transaction();

  await sendAndConfirmTransaction(tx, "Complete launch");

  console.log("Launch completed!");
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function sendAndConfirmTransaction(
  tx: Transaction,
  label: string,
) {

  const completeLaunchLut = await createLookupTableForTransaction(
    tx,
    payer,
    provider
  );

  console.log('Complete launch lookup table:', completeLaunchLut);
  new Promise(resolve => setTimeout(resolve, 4000));
  let blockhash = await provider.connection.getLatestBlockhash()

  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([completeLaunchLut]);

  const transactionV0 = new VersionedTransaction(messageV0);
  transactionV0.sign([payer]);
  const txHash = await provider.connection.sendRawTransaction(transactionV0.serialize());
  console.log(`${label} transaction sent:`, txHash);

  await provider.connection.confirmTransaction(txHash, "confirmed");
  const txStatus = await provider.connection.getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (txStatus?.meta?.err) {
    throw new Error(
      `Transaction failed: ${txHash}\nError: ${JSON.stringify(
        txStatus?.meta?.err
      )}\n\n${txStatus?.meta?.logMessages?.join("\n")}`
    );
  }
  console.log(`${label} transaction confirmed`);
  return txHash;
}
