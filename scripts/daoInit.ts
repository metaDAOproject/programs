import { Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AutocratClient } from "@metadaoproject/futarchy/v0.4";
import { homedir } from "os";
import { join } from "path";
import fs from "fs";
import { input } from "@inquirer/prompts";

import dotenv from "dotenv";
import * as token from "@solana/spl-token";
import { BN } from "bn.js";

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

const autocratClient: AutocratClient = AutocratClient.createClient({
  provider,
});

const daoKeypairPath = await input({
  message:
    "Enter the path (relative to home directory) to your DAO keypair file",
  default: join(homedir(), process.env.DAO_KEYPAIR_PATH),
});

async function main() {
  const daoKeypairFile = fs.readFileSync(daoKeypairPath);
  const daoKeypair = Keypair.fromSecretKey(
    Buffer.from(JSON.parse(daoKeypairFile.toString()) as Uint8Array)
  );

  // Create META token mint
  const metaMint = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    9 // 9 decimals like in tests
  );
  console.log("Created META mint:", metaMint.toString());

  // Create USDC mint
  const usdcMint = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6 // 6 decimals for USDC
  );
  console.log("Created USDC mint:", usdcMint.toString());

  // Create token accounts for the payer
  const metaAccount = await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    metaMint,
    payer.publicKey
  );
  console.log("Created META account:", metaAccount.toString());

  const usdcAccount = await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    usdcMint,
    payer.publicKey
  );
  console.log("Created USDC account:", usdcAccount.toString());

  // Mint initial tokens to the payer
  await token.mintTo(
    provider.connection,
    payer,
    metaMint,
    metaAccount,
    payer,
    100_000n * 1_000_000_000n // 100,000 META with 9 decimals
  );
  console.log("Minted 100,000 META to payer");

  await token.mintTo(
    provider.connection,
    payer,
    usdcMint,
    usdcAccount,
    payer,
    2_000_000n * 1_000_000n // 200,000 USDC with 6 decimals (like in tests)
  );
  console.log("Minted 2,000,000 USDC to payer");

  // Initialize the DAO
  const tokenPriceUiAmount = 1.0; // Initial token price in USDC
  const minBaseFutarchicLiquidity = 5; // Lower minimum requirement (5 META)
  const minQuoteFutarchicLiquidity = 5; // Lower minimum requirement (5 USDC)
  const twapStartDelaySlots = new BN(150); // 150 slots ~ 1 minute

  const dao = await autocratClient.initializeDao(
    metaMint,
    tokenPriceUiAmount,
    minBaseFutarchicLiquidity,
    minQuoteFutarchicLiquidity,
    usdcMint,
    daoKeypair,
    twapStartDelaySlots
  );

  console.log("DAO created with address:", dao.toString());
  console.log("DAO keypair public key:", daoKeypair.publicKey.toString());
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
