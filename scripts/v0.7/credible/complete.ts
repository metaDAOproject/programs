import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createLookupTableForTransaction } from "../../utils/utils.js";
import { token } from "@coral-xyz/anchor/dist/cjs/utils/index.js";
import { TOKEN_SEED } from "./constants.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const completeLaunch = async () => {
  // TODO: BEFORE RUNNING YOU NEED TO APPROVE THE FUNDING RECORDS
  // SCRIPT MUST BE CREATED
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);

  if (launch === undefined) {
    throw new Error(
      "LAUNCH_TO_COMPLETE is not set. Please set it in the script.",
    );
  }

  let launchAccount = await launchpad.fetchLaunch(launch);

  const tx = await launchpad
    .completeLaunchIx({
      launch: launch,
      baseMint: launchAccount.baseMint,
      launchAuthority: payer.publicKey,
    })
    .transaction();

  const LUT = await createLookupTableForTransaction(
    tx,
    payer,
    provider.connection,
  );

  // WE AWAIT THE LUT TO BE CREATED BEFORE GETTING THE BLOCKHASH AND CONTINUING....
  await Promise.resolve(new Promise((resolve) => setTimeout(resolve, 10000)));
  const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([LUT]);

  const vtx = new VersionedTransaction(message);
  vtx.sign([payer]);

  const completeTxHash = await provider.connection.sendTransaction(vtx);

  console.log(`Complete launch transaction sent: ${completeTxHash}`);

  console.log("Launch completed successfully!");

  console.log("Setting up performance package...");

  // Refresh launch account to get the updated base mint
  launchAccount = await launchpad.fetchLaunch(launch);

  // TODO: Review this as we will want to do this manually..
  const initializePerformancePackageTxHash = await launchpad
    .initializePerformancePackageIx({
      launch: launch,
      baseMint: launchAccount.baseMint,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(
    `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  );

  console.log("Performance package set up successfully!");
};

completeLaunch().catch(console.error);
