import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

// LAUNCH CONFIGURATION
const LAUNCH_PARAMS = {
  tokenName: "Example Token",
  tokenSymbol: "EXMPL",
  tokenUri: "https://example.com/metadata.json",
  minimumRaiseAmount: 10, // 10 USDC
  monthlySpendingLimitAmount: 1, // 5 USDC
  monthlySpendingLimitMembers: [
    new PublicKey("BF8hxzzR4KuVxfsyAUFyy26E6y2GhsSZgBoUQrygwof1"),
    new PublicKey("C2qbG1j7WW28NYKum1JGnhL3RziNwaeP8DT7Q1WAVvdP"),
  ],
  performancePackageGrantee: new PublicKey(
    "BF8hxzzR4KuVxfsyAUFyy26E6y2GhsSZgBoUQrygwof1",
  ),
  performancePackageTokenAmount: 100_000,
  monthsUntilInsidersCanUnlock: 18,
  secondsForLaunch: 60 * 60,
};

interface InitializeLaunchParams {
  tokenName: string;
  tokenSymbol: string;
  tokenUri: string;
  minimumRaiseAmount: number;
  monthlySpendingLimitAmount: number;
  monthlySpendingLimitMembers: PublicKey[];
  performancePackageGrantee: PublicKey;
  performancePackageTokenAmount: number; // in token units
  monthsUntilInsidersCanUnlock: number;
  secondsForLaunch?: number;
}

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const initializeLaunch = async (params: InitializeLaunchParams) => {
  const {
    tokenName,
    tokenSymbol,
    tokenUri,
    minimumRaiseAmount,
    monthlySpendingLimitAmount,
    monthlySpendingLimitMembers,
    performancePackageGrantee,
    performancePackageTokenAmount,
    monthsUntilInsidersCanUnlock,
    secondsForLaunch,
  } = params;

  // Generate a random seed for token creation
  const seed = Math.random().toString(36).substring(2, 15);
  console.log(`Using seed: ${seed}`);

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    token.TOKEN_PROGRAM_ID,
  );

  console.log(`Token mint address: ${TOKEN.toBase58()}`);

  const [launch] = getLaunchAddr(undefined, TOKEN);
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);

  console.log(`Launch address: ${launch.toBase58()}`);
  console.log(`Launch signer address: ${launchSigner.toBase58()}`);

  // Create token mint account
  const tx = new Transaction().add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: TOKEN,
      basePubkey: payer.publicKey,
      seed,
      lamports: lamports,
      space: token.MINT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(TOKEN, 6, launchSigner, null),
  );
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  console.log("Creating token mint...");
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");
  console.log(`Token mint created: ${txHash}`);

  // Initialize launch
  console.log("Initializing launch...");
  const launchIx = await launchpad
    .initializeLaunchIx({
      tokenName,
      tokenSymbol,
      tokenUri,
      minimumRaiseAmount: new BN(minimumRaiseAmount * 10 ** 6),
      baseMint: TOKEN,
      monthlySpendingLimitAmount: new BN(monthlySpendingLimitAmount * 10 ** 6),
      monthlySpendingLimitMembers,
      performancePackageGrantee,
      performancePackageTokenAmount: new BN(performancePackageTokenAmount),
      monthsUntilInsidersCanUnlock,
      secondsForLaunch,
    })
    .rpc();

  console.log("Launch initialized:", launchIx);
  console.log("\nLaunch Details:");
  console.log("===============");
  console.log(`Token Mint: ${TOKEN.toBase58()}`);
  console.log(`Launch Address: ${launch.toBase58()}`);
  console.log(`Token Name: ${tokenName}`);
  console.log(`Token Symbol: ${tokenSymbol}`);
  console.log(`Minimum Raise: ${minimumRaiseAmount.toLocaleString()} USDC`);
  console.log(`Launch Duration: ${secondsForLaunch} seconds`);

  return {
    tokenMint: TOKEN,
    launchAddress: launch,
    launchSigner,
    txSignature: launchIx,
  };
};

initializeLaunch(LAUNCH_PARAMS).catch(console.error);
