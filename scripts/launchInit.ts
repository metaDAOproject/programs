import * as token from "@solana/spl-token";
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.4";
import { BN } from "bn.js";
import { homedir } from "os";
import { join } from "path";
import fs from "fs";
import { input, select } from "@inquirer/prompts";

import dotenv from "dotenv";

dotenv.config();

const choices = [
  { value: "devnet", name: "devnet" },
  { value: "mainnet", name: "mainnet" },
];

// Place mainnet as first choice if env says mainnet
if (process.env.NETWORK === "mainnet") {
  choices.reverse();
}

const network = await select({
  message: "Which network is this launch on?",
  choices: choices,
});

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

const launchAuthorityAddress = await input({
  message:
    "Enter the address of the launch authority",
  default: process.env.LAUNCH_AUTHORITY_ADDRESS,
});

const isDevnet = network === "devnet";

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const tokenName = await input({
  message: "Enter the token name",
  default: process.env.LAUNCH_TOKEN_NAME,
});

const tokenSymbol = await input({
  message: "Enter the token symbol",
  default: process.env.LAUNCH_TOKEN_SYMBOL,
});

const tokenUri = await input({
  message: "Enter the token URI",
  default: process.env.LAUNCH_TOKEN_URI,
});

const minimumRaiseAmount = new BN(
  await input({
    message: "Enter the minimum raise amount",
    default: process.env.MINIMUM_RAISE_AMOUNT,
  })
);

const secondsForLaunch = Number.parseInt(
  await input({
    message: "Enter the seconds for launch",
    default: process.env.SECONDS_FOR_LAUNCH,
  })
);

async function main() {
  if (!tokenName.length) {
    throw new Error("Token name is required.");
  }

  if (!tokenSymbol.length) {
    throw new Error("Token symbol is required.");
  }

  if (!tokenUri.length) {
    throw new Error("Token URI is required.");
  }

  const mintKeypair = Keypair.generate();

  const [launchAddr] = getLaunchAddr(
    launchpad.getProgramId(),
    mintKeypair.publicKey
  );
  const [launchSigner] = getLaunchSignerAddr(
    launchpad.getProgramId(),
    launchAddr
  );

  console.log("Creating mint...");
  
  const mint = await token.createMint(
    provider.connection,
    payer,
    launchSigner,
    null,
    6,
    mintKeypair,
    {
      // Let's be 100% sure the mint is created
      commitment: "finalized",
    }
  );
  
  console.log("Mint created:", mint.toBase58());

  console.log("Launching...");

  const tx = await launchpad
    .initializeLaunchIx(
      tokenName,
      tokenSymbol,
      tokenUri,
      minimumRaiseAmount,
      secondsForLaunch,
      mint,
      new PublicKey(launchAuthorityAddress),
      isDevnet,
      payer.publicKey,
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5 }),
    ])
    .transaction();
  await sendAndConfirmTransaction(tx, "Initialize launch");

  console.log("Launch initialized!");
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
