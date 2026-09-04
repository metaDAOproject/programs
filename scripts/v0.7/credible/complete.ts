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
import { ComputeBudgetProgram } from "@solana/web3.js";
import { token } from "@coral-xyz/anchor/dist/cjs/utils/index.js";
import { TOKEN_SEED, ADDITIONAL_CARVEOUT_RECIPIENT } from "./constants.js";

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

  // const tx = await launchpad
  //   .completeLaunchIx({
  //     launch: launch,
  //     baseMint: launchAccount.baseMint,
  //     launchAuthority: payer.publicKey,
  //   })
  //   .preInstructions([
  //     ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
  //   ])
  //   .transaction();

  // const LUT = await provider.connection.getAddressLookupTable(new PublicKey("8R4VtmzL9ivp1CViLN2o7ejnGioEQux4pRaStG5Vb8Y9"));
  // if (LUT === null || LUT.value === null) {
  //   throw new Error("LUT not found");
  // }
  // const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  // const message = new TransactionMessage({
  //   payerKey: payer.publicKey,
  //   recentBlockhash: blockhash,
  //   instructions: tx.instructions,
  // }).compileToV0Message([LUT.value]);

  // const vtx = new VersionedTransaction(message);
  // vtx.sign([payer]);

  // // const simulation = await provider.connection.simulateTransaction(vtx, { sigVerify: false });
  // // if (simulation.value.err) {
  // //   console.error("Transaction simulation failed:", simulation.value.err);
  // //   throw new Error(
  // //     `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
  // //   );
  // // }
  // // console.log("Simulation:", simulation);
  // // console.log("Simulation:", simulation.value);
  // // console.log("Simulation:", simulation.value.unitsConsumed);
  // // return;

  // const completeTxHash = await provider.connection.sendTransaction(vtx);

  // console.log(`Complete launch transaction sent: ${completeTxHash}`);

  // const isDone = await provider.connection.confirmTransaction(completeTxHash, "confirmed");

  // if (isDone.value.err) {
  //   throw new Error(`Launch completion failed ${JSON.stringify(isDone.value.err)}`);
  // }

  // console.log("Launch completion confirmed:", isDone);

  // console.log("Launch completed successfully!");

  // console.log("Setting up performance package...");

  // // Refresh launch account to get the updated base mint
  // launchAccount = await launchpad.fetchLaunch(launch);

  // if (launchAccount === null) {
  //   throw new Error("Launch account not found");
  // }

  // // TODO: Review this as we will want to do this manually..
  // const initializePerformancePackageTxHash = await launchpad
  //   .initializePerformancePackageIx({
  //     launch: launch,
  //     baseMint: launchAccount.baseMint,
  //     payer: payer.publicKey,
  //   })
  //   .rpc();

  // console.log(
  //   `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  // );

  // console.log("Performance package set up successfully!");

  // const transferAllocationTxHash = await launchpad.claimAdditionalTokenAllocationIx({
  //   launch: launch,
  //   baseMint: launchAccount.baseMint,
  //   additionalTokensRecipient: ADDITIONAL_CARVEOUT_RECIPIENT,
  //   payer: payer.publicKey,
  // })
  // .rpc();

  // console.log(
  //   `Transfer allocation transaction sent: ${transferAllocationTxHash}`
  // );
};

completeLaunch().catch(console.error);
