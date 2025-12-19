import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.7";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const LAUNCH_AUTHORITY = payer.publicKey;

const TEAM_ADDRESS = PublicKey.default;

// Launch details
const MIN_GOAL = 500_000;

const SPENDING_MEMBERS = [TEAM_ADDRESS];
const SPENDING_LIMIT = 60_000;

const PERFORMANCE_PACKAGE_GRANTEE = TEAM_ADDRESS;
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 8_076_923;
const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 18;

// Additional carveout details - leave undefined if not used
const ADDITIONAL_CARVEOUT = undefined;
const ADDITIONAL_CARVEOUT_RECIPIENT = undefined;

const TOKEN_SEED = "YacrMS3w7lcgi44t";
const TOKEN_NAME = "Loyal";
const TOKEN_SYMBOL = "LOYAL";
const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/LOYAL/LOYAL.json";

const secondsPerDay = 86_400;
const numberOfDays = 4;
const launchDurationSeconds = secondsPerDay * numberOfDays;

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

  const tx = new Transaction().add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: TOKEN,
      basePubkey: payer.publicKey,
      seed: TOKEN_SEED,
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

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

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
    })
    .rpc();

  console.log("Launch initialized", launchIx);
  // await launchpad.startLaunchIx({ launch }).rpc();
};

launch().catch(console.error);
