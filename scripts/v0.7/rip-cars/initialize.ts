import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";
import {
  TOKEN_SEED,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  TOKEN_URI,
  MIN_GOAL,
  SPENDING_LIMIT,
  SPENDING_MEMBERS,
  PERFORMANCE_PACKAGE_GRANTEE,
  PERFORMANCE_PACKAGE_TOKEN_AMOUNT,
  PERFORMANCE_PACKAGE_UNLOCK_MONTHS,
  ADDITIONAL_CARVEOUT,
  ADDITIONAL_CARVEOUT_RECIPIENT,
  TEAM_ADDRESS,
  TOKEN_ADDRESS,
  LAUNCH_DAYS,
} from "./constants.js";
import { secondsPerDay } from "../../utils/constants.js";

const provider = anchor.AnchorProvider.env();
const payer = (
  provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;

const LAUNCH_AUTHORITY = payer.publicKey; // NOTE: We're duplicating this.. but we should validate I'd assume

const launchDurationSeconds = secondsPerDay * LAUNCH_DAYS; // 4 days

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const launch = async () => {
  // Check balance of the payer
  console.log("Checking balance of the payer");
  console.log("Payer address:", payer.publicKey.toBase58());
  const balance = await provider.connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
  if (balance < LAMPORTS_PER_SOL * 0.001) {
    throw new Error(
      "Insufficient balance. Please fund the address with at least 0.001 SOL",
    );
  }

  // Notify user of the balance for estimate of launch cost and with number of users with accounts
  // TODO: Implement ^

  // Get minimum balance for rent exemption
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());
  if (TOKEN.toBase58() !== TOKEN_ADDRESS.toBase58()) {
    throw new Error("Token address does not match the constants");
  }
  // TODO: Confirm the token address from the constants

  const [launch] = getLaunchAddr(undefined, TOKEN);
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);

  console.log("Launch address:", launch.toBase58()); // Note: this is used in the constants for later

  const createTokenAccountIx = SystemProgram.createAccountWithSeed({
    fromPubkey: payer.publicKey,
    newAccountPubkey: TOKEN,
    basePubkey: payer.publicKey,
    seed: TOKEN_SEED,
    lamports: lamports,
    space: token.MINT_SIZE,
    programId: token.TOKEN_PROGRAM_ID,
  });

  const initializeMintIx = token.createInitializeMint2Instruction(
    TOKEN,
    6,
    launchSigner,
    null,
  );

  // TODO: We should confirm the launch settings are expected results / build a test to make sure nothing is going to violate
  // before we do all of this.. Now simulation will catch it.
  const launchIx = await launchpad
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
      hasBidWall: false,
    })
    .instruction();

  const ixs = [createTokenAccountIx, initializeMintIx, launchIx];

  const { blockhash } = await provider.connection.getLatestBlockhash();

  // TODO: Break this out into a helper as we use it a lot...
  // Simulate without compute budget to get units consumed
  const messageV0 = new TransactionMessage({
    instructions: ixs,
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  const simulationTx = new VersionedTransaction(messageV0);
  const simulation = await provider.connection.simulateTransaction(
    simulationTx,
    { sigVerify: false },
  );

  const computeUnitsUsed = simulation.value.unitsConsumed || 200_000;
  // Add 20% buffer to the compute units
  const computeUnitsWithBuffer = Math.floor(computeUnitsUsed * 1.2);

  console.log(`Simulated compute units: ${computeUnitsUsed}`);
  console.log(`Setting compute unit limit: ${computeUnitsWithBuffer}`);

  const finalMessageV0 = new TransactionMessage({
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitsWithBuffer,
      }),
      ...ixs,
    ],
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  const finalTx = new VersionedTransaction(finalMessageV0);
  finalTx.sign([payer]);

  const txHash = await provider.connection.sendRawTransaction(
    finalTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch initialized", txHash);
};

launch().catch(console.error);
