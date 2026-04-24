import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/launchpad/v0.4";
import { homedir } from "os";
import { join } from "path";
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

const launchAddr = new PublicKey(
  await input({
    message: "Enter the launch address",
    default: process.env.LAUNCH_ADDRESS,
  }),
);

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

async function main() {
  const launch = await launchpad.getLaunch(launchAddr);

  const tx = await launchpad
    .completeLaunchIx(launchAddr, launch.tokenMint, true)
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
  signers: Keypair[] = [],
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
        txStatus?.meta?.err,
      )}\n\n${txStatus?.meta?.logMessages?.join("\n")}`,
    );
  }
  console.log(`${label} transaction confirmed`);
  return txHash;
}
