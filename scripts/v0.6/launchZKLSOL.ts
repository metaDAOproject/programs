import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/programs/launchpad/v0.6";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("DjMcCdkhWk93zQ1v2uGd6QwMjTUQtcfd5oFkdPgZPD6y"), // ZKLSOL 1
  new PublicKey("2bq1JFjhuAjTStD8NwjdQNFTSXGroofQbBejwubNXGhj"), // ZKLSOL 2
];
const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "G8ZvC9Fkks5HaG8LiCKwGaWKBtz8ey8C6EMvSQgYnqqN",
);
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 15_000_000;
const PERFORMANCE_PACKAGE_UNLOCK_TIME = 18;

const SPENDING_LIMIT = 50_000;
const MIN_GOAL = 300_000;

const TOKEN_SEED = "2yRbPnX1ArpAzgUu";

const secondsPerDay = 86_400;
const fourDays = secondsPerDay * 4;

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const launch = async () => {
  const seed = TOKEN_SEED;
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE,
  );

  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
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

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  const launchIx = await launchpad
    .initializeLaunchIx({
      tokenName: "ZKFG",
      tokenSymbol: "ZKFG",
      tokenUri:
        "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/ZKFG/ZKFG.json",
      minimumRaiseAmount: new BN(MIN_GOAL * 10 ** 6),
      baseMint: TOKEN,
      monthlySpendingLimitAmount: new BN(SPENDING_LIMIT * 10 ** 6),
      monthlySpendingLimitMembers: SPENDING_MEMBERS,
      performancePackageGrantee: PERFORMANCE_PACKAGE_GRANTEE,
      performancePackageTokenAmount: new BN(
        PERFORMANCE_PACKAGE_TOKEN_AMOUNT * 10 ** 6,
      ),
      monthsUntilInsidersCanUnlock: PERFORMANCE_PACKAGE_UNLOCK_TIME,
      secondsForLaunch: fourDays,
      teamAddress: PublicKey.default,
    })
    .rpc();

  console.log("Launch initialized", launchIx);
  // await launchpad.startLaunchIx({ launch }).rpc();
};

launch().catch(console.error);
