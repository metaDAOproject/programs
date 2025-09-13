import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.5";

import dotenv from "dotenv";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const LAUNCH_TO_START = new PublicKey(
  "7DzBXBYSKhrXHPWT6mAKq394vKupaKaqLn9bK1wscpBz"
);

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

async function main() {
  const launchAuthorityKeypair = payer;

  console.log(
    "Launch authority public key:",
    launchAuthorityKeypair.publicKey.toBase58()
  );

  console.log("Starting launch...");

  const tx = await launchpad
    .startLaunchIx(LAUNCH_TO_START, launchAuthorityKeypair.publicKey)
    .transaction();

  await sendAndConfirmTransaction(tx, "Start launch", [launchAuthorityKeypair]);

  console.log("Launch started!");
  console.log("Launch address:", LAUNCH_TO_START.toBase58());
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function sendAndConfirmTransaction(
  tx: Transaction,
  label: string,
  signers: Keypair[] = []
) {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.partialSign(payer, ...signers);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
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
