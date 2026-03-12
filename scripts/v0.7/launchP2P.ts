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

const TEAM_ADDRESS = new PublicKey(
  "63miwxnMci7L76tWBGFfmHjbm199MKiteiWrNY1ShQhV",
); // P2P team address

// Launch details
const MIN_GOAL = 6_000_000; // 6M USDC

const SPENDING_MEMBERS = [
  new PublicKey("G4vHnTW7PSgTtHAYwmrBvUydWGmz8Bd2px9XYAsBQWgu"),
  new PublicKey("6fwrmfLPCQJmF47LdoLTBBojtw8Qbq2wicRyDpzsQjBk"),
  new PublicKey("CTDAar2UbkpVq21u8RRvzWT3rtjvoeV2PFZp7PdiMZWg"),
];
const SPENDING_LIMIT = 175_000; // 175k USDC

const PERFORMANCE_PACKAGE_GRANTEE = TEAM_ADDRESS;
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 7_740_000; // 7.74M P2P
const PERFORMANCE_PACKAGE_UNLOCK_MONTHS = 12; // 12 months

// Additional carveout details
const ADDITIONAL_CARVEOUT = 5_160_000; // 5.16M P2P
const ADDITIONAL_CARVEOUT_RECIPIENT = new PublicKey(
  "BzZhwMzoY5ikk9mWBejb3dKbYXCYZ6eJhijk71WfvTYt",
); // MetaDAO P2P Launch Custody Multisig

const TOKEN_SEED = "ltSNHJR5jLfmx0Zs";
const TOKEN_NAME = "P2P Protocol";
const TOKEN_SYMBOL = "P2P";
const TOKEN_URI =
  "https://raw.githubusercontent.com/metaDAOproject/programs/refs/heads/develop/scripts/assets/P2P/P2P.json";

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

  console.log("Launch initialized, P2P for you and for me!", launchIx);
};

launch().catch(console.error);
