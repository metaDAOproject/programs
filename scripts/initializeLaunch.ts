import * as token from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import {
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.5";
import { BN } from "bn.js";
import { USDC } from "./consts.js";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

// Use the RPC endpoint of your choice.
const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// Change these variables to match the launch details
const START_LAUNCH_KEY = new PublicKey(
  "CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf"
);
const MIN_RAISE_AMOUNT = 300_000;
const FOUNDER_REQUESTED_SPENDING_LIMIT = 10_000;
const FOUNDER_KEYS = [
  new PublicKey("5jRqFejxKHWMfR69dbYF2A9TnpnBPjz7iaRQS44imcMi"),
  new PublicKey("A4juvYuvaAqhefj8BFkz2QZHxmVZRSf1nmLj8QvKUX4B")
];
const TOKEN_SEED = "Ck2w0N97Nkr886o8"; // Thanks Caveycool!

// Safetychecks / processes data
const MAX_MONTHLY_SPENDING_LIMIT = MIN_RAISE_AMOUNT / 6;
const SPENDING_LIMIT = Math.min(FOUNDER_REQUESTED_SPENDING_LIMIT, MAX_MONTHLY_SPENDING_LIMIT);
const ONE_MINUTE_IN_SECONDS = 60; // Devnet only
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 60;
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS * 24;
const SEVEN_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 7;

async function main() {
  const seed = TOKEN_SEED;
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    token.TOKEN_PROGRAM_ID
  );

  console.log('Token address:', TOKEN.toBase58());

  const [launch] = getLaunchAddr(launchpad.getProgramId(), TOKEN);
  const [launchSigner] = getLaunchSignerAddr(launchpad.getProgramId(), launch);

  console.log('Launch address:', launch.toBase58());

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE
  );

  const convertedRaise = MIN_RAISE_AMOUNT * 10 ** 6;
  const convertedMonthlySpendingLimit = SPENDING_LIMIT * 10 ** 6;

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
    token.createInitializeMint2Instruction(TOKEN, 6, launchSigner, null)
  );
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  await launchpad
    .initializeLaunchIx(
      "Omnipair Futarchy Governance",
      "OMFG",
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/OMFG/OMFG.json",
      new BN(convertedRaise), // note: multiplied by 10^6
      SEVEN_DAYS_IN_SECONDS,
      TOKEN,
      USDC, // use for devnet new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
      new BN(convertedMonthlySpendingLimit), // note: multiplied by 10^6
      FOUNDER_KEYS,
      START_LAUNCH_KEY,
      false, // note: change for devnet
      payer.publicKey
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ])
    .rpc();
}

main();
