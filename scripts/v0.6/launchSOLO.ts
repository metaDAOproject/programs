import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey(""), // SOLO 1
  new PublicKey(""), // SOLO 2
];
const PERFORMANCE_PACKAGE_GRANTEE = new PublicKey(
  "",
);
const PERFORMANCE_PACKAGE_TOKEN_AMOUNT = 12_900_000;
const PERFORMANCE_PACKAGE_UNLOCK_TIME = 18;

const SPENDING_LIMIT = 100_000;
const MIN_GOAL = 2_000_000;

const TOKEN_SEED = "QOOD2FDAocrPF1ms";

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
      tokenName: "Solomon",
      tokenSymbol: "SOLO",
      tokenUri:
        "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/SOLO/SOLO.json",
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
    })
    .rpc();

  console.log("Launch initialized", launchIx);
  // await launchpad.startLaunchIx({ launch }).rpc();
};

launch().catch(console.error);
