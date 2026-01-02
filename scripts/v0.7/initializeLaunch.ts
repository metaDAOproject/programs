import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.7";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// ============= CONFIGURATION =============
// Launch authority - who controls the launch
const LAUNCH_AUTHORITY = payer.publicKey;

// Team address - receives tokens after launch
const TEAM_ADDRESS = PublicKey.default;

// Launch parameters
const MIN_GOAL = 6; // Minimum raise amount in USDC

// Spending limit configuration
const SPENDING_MEMBERS = [TEAM_ADDRESS];
const SPENDING_LIMIT = 1; // Monthly spending limit in USDC

// Performance package configuration
const PERFORMANCE_PACKAGE_GRANTEE = TEAM_ADDRESS;
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 8_076_923;
const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18;

// Additional carveout (optional)
const ADDITIONAL_CARVEOUT = undefined;
const ADDITIONAL_CARVEOUT_RECIPIENT = undefined;

// Token configuration
const TOKEN_NAME = "Test Token";
const TOKEN_SYMBOL = "TEST";
const TOKEN_URI = "";

// Launch duration
const secondsPerDay = 3600;
const numberOfDays = 1;
const launchDurationSeconds = secondsPerDay * numberOfDays;
// =========================================

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const initializeLaunch = async () => {
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  // Generate a random keypair for the token mint
  const mintKeypair = Keypair.generate();
  const TOKEN = mintKeypair.publicKey;
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);

  console.log("Launch address:", launch.toBase58());
  console.log("Launch signer:", launchSigner.toBase58());

  // Create the token mint with the random keypair
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: TOKEN,
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
  tx.sign(payer, mintKeypair);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");
  console.log("Token mint created:", txHash);

  // Initialize the launch
  const launchTxHash = await launchpad
    .initializeLaunchIx({
      tokenName: TOKEN_NAME,
      tokenSymbol: TOKEN_SYMBOL,
      tokenUri: TOKEN_URI,
      minimumRaiseAmount: new BN(MIN_GOAL * 10 ** 6),
      baseMint: TOKEN,
      monthlySpendingLimitAmount: new BN(SPENDING_LIMIT * 10 ** 6),
      monthlySpendingLimitMembers: SPENDING_MEMBERS,
      performancePackageGrantee: PERFORMANCE_PACKAGE_GRANTEE,
      performancePackageTokenAmount: new BN(
        PERFORMANCE_PACKAGE_TOKEN_AMOUNT * 10 ** 6,
      ),
      monthsUntilInsidersCanUnlock: PERFORMANCE_PACKAGE_UNLOCK_MONTHS,
      secondsForLaunch: launchDurationSeconds,
      teamAddress: TEAM_ADDRESS,
      additionalTokensAmount: ADDITIONAL_CARVEOUT
        ? new BN(ADDITIONAL_CARVEOUT * 10 ** 6)
        : undefined,
      additionalTokensRecipient: ADDITIONAL_CARVEOUT_RECIPIENT,
      launchAuthority: LAUNCH_AUTHORITY,
    })
    .rpc();

  console.log("Launch initialized:", launchTxHash);
  console.log("Launch address:", launch.toBase58());
};

initializeLaunch().catch(console.error);
