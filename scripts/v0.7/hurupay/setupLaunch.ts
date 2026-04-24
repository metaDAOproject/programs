import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const LAUNCH_AUTHORITY = payer.publicKey;

const TEAM_ADDRESS = new PublicKey(
  "5ZGh1VosZepRpTamvCNLVsRx9xPy8gykFTfRS27Du4H1",
); // Hurupay team address

// Launch details
const MIN_GOAL = 3_000_000; // 3M USDC

const SPENDING_MEMBERS = [
  new PublicKey("7BPZaiS2LMhQHF7Yt8Pj16YmnCpsdiwRPSatkYjtbJVp"),
  new PublicKey("Fa6CuD8JCy9wSkoqAVmY7LVNPvVo9fPGVoYtBSF5qQhg"),
  new PublicKey("CANWSTstBGBnQEhYQ7d1Tzg1wFWJoZnLBosVnF4GtMob"),
];
const SPENDING_LIMIT = 250_000; // 250k USDC

// Even without a performance package, defaults need to be set
const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "11111111111111111111111111111111",
);
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 1; // 1 HURU
const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 36; // 36 months

// Additional carveout details
const ADDITIONAL_CARVEOUT = 12_725_000; // 12.725M HURU
const ADDITIONAL_CARVEOUT_RECIPIENT = new PublicKey(
  "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf",
); // MetaDAO operational multisig vault

const TOKEN_SEED = "DrmUAbym6RUsMqs6";
const TOKEN_NAME = "Hurupay";
const TOKEN_SYMBOL = "HURU";
const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/HURU/HURU.json";

const secondsPerDay = 86_400;
const numberOfDays = 4;
const launchDurationSeconds = secondsPerDay * numberOfDays; // 4 days

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const launch = async () => {
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);

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

  // Build transaction without compute budget first
  const tx = new Transaction().add(
    createTokenAccountIx,
    initializeMintIx,
    launchIx,
  );

  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;

  // Simulate transaction to get compute units used
  tx.sign(payer);
  const simulation = await provider.connection.simulateTransaction(tx);

  if (simulation.value.err) {
    console.error("Transaction simulation failed:", simulation.value.err);
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
    );
  }

  const computeUnitsUsed = simulation.value.unitsConsumed || 200_000;
  // Add 20% buffer to the compute units
  const computeUnitsWithBuffer = Math.floor(computeUnitsUsed * 1.2);

  console.log(`Simulated compute units: ${computeUnitsUsed}`);
  console.log(`Setting compute unit limit: ${computeUnitsWithBuffer}`);

  // Rebuild transaction with compute budget
  const finalTx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnitsWithBuffer }),
    createTokenAccountIx,
    initializeMintIx,
    launchIx,
  );

  finalTx.recentBlockhash = blockhash;
  finalTx.feePayer = payer.publicKey;
  finalTx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(
    finalTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch initialized", txHash);
};

launch().catch(console.error);
