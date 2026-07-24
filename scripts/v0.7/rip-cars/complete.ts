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
import { ComputeBudgetProgram } from "@solana/web3.js";
import { token } from "@coral-xyz/anchor/dist/cjs/utils/index.js";
import { TOKEN_SEED, LUT_ADDRESS } from "./constants.js";

const provider = anchor.AnchorProvider.env();
const payer = (
  provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;

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

  if (launchAccount === null) {
    throw new Error("Launch account not found");
  }

  const tx = await launchpad
    .completeLaunchIx({
      launch: launch,
      baseMint: launchAccount.baseMint,
      launchAuthority: payer.publicKey,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
    ])
    .transaction();

  const LUT = await provider.connection.getAddressLookupTable(LUT_ADDRESS);
  if (LUT === null || LUT.value === null) {
    throw new Error("LUT not found");
  }
  const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([LUT.value]);

  const vtx = new VersionedTransaction(message);
  vtx.sign([payer]);

  // TODO: We want to run pre-checks before we fire this off, pre-checks should be done 5 minutes before expected
  // completion time. This should be one of the pre-checks...
  // TODO: Other pre-checks:
  // - SOL balance relative to the funding records
  // - Funding records approved
  // - Launch is not already complete
  // - Sum of funding records
  // - Launch account state (eg total approved)
  // const simulation = await provider.connection.simulateTransaction(vtx, { sigVerify: false });
  // if (simulation.value.err) {
  //   console.error("Transaction simulation failed:", simulation.value.err);
  //   throw new Error(
  //     `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
  //   );
  // }
  // console.log("Simulation:", simulation);
  // console.log("Simulation:", simulation.value);
  // console.log("Simulation:", simulation.value.unitsConsumed);
  // return;

  const completeTxHash = await provider.connection.sendTransaction(vtx);

  console.log(`Complete launch transaction sent: ${completeTxHash}`);

  const isDone = await provider.connection.confirmTransaction(
    completeTxHash,
    "confirmed",
  );

  if (isDone.value.err) {
    throw new Error(
      `Launch completion failed ${JSON.stringify(isDone.value.err)}`,
    );
  }

  console.log("Launch completion confirmed:", isDone);

  console.log("Launch completed successfully!");

  console.log("Setting up performance package...");

  // Refresh launch account to get the updated base mint
  launchAccount = await launchpad.fetchLaunch(launch);

  if (launchAccount === null) {
    throw new Error("Launch account not found");
  }

  // TODO: Ideally we don't wrap this into this call given I don't want ANYTHING about it
  // to stall a complete launch call...
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
