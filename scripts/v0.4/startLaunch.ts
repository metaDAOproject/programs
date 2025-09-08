import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getLaunchAddr, LaunchpadClient } from "@metadaoproject/futarchy/v0.4";
import { homedir } from "os";
import { join } from "path";
import fs from "fs";
import { input } from "@inquirer/prompts";

import dotenv from "dotenv";

dotenv.config();

const rpcUrl = await input({
  message: "Enter your RPC URL:",
  default: process.env.RPC_URL,
});

const walletPath = await input({
  message: "Enter the path (relative to home directory) to your wallet file",
  default: join(homedir(), process.env.WALLET_PATH),
});
process.env.ANCHOR_WALLET = walletPath;
const provider = anchor.AnchorProvider.local(rpcUrl, {
  commitment: "confirmed",
});
const payer = provider.wallet["payer"];

const launchAuthorityKeypairPath = await input({
  message:
    "Enter the path (relative to home directory) to your launch authority keypair file",
  default: join(homedir(), process.env.LAUNCH_AUTHORITY_KEYPAIR_PATH),
});

const launchAddr = new PublicKey(
  await input({
    message: "Enter the launch address",
    default: process.env.LAUNCH_ADDRESS,
  })
);

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

async function main() {
  const launchAuthorityFile = fs.readFileSync(launchAuthorityKeypairPath);
  const launchAuthorityKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(launchAuthorityFile.toString()) as Uint8Array)
  );

  if (!launchAuthorityKeypair) {
    throw new Error("Could not read launch authority keypair.");
  }

  console.log(
    "Launch authority public key:",
    launchAuthorityKeypair.publicKey.toBase58()
  );

  console.log("Starting launch...");

  const tx = await launchpad
    .startLaunchIx(launchAddr, launchAuthorityKeypair.publicKey)
    .transaction();

  await sendAndConfirmTransaction(tx, "Start launch", [launchAuthorityKeypair]);

  console.log("Launch started!");
  console.log("Launch address:", launchAddr.toBase58());
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