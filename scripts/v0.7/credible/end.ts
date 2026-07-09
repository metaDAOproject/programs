import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { TOKEN_SEED } from "./constants.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const end = async () => {
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);

  const closeLaunchIx = await launchpad
    .closeLaunchIx({
      launch,
    })
    .instruction();

  // Build transaction without compute budget first
  const tx = new Transaction().add(closeLaunchIx);

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
    closeLaunchIx,
  );

  finalTx.recentBlockhash = blockhash;
  finalTx.feePayer = payer.publicKey;
  finalTx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(
    finalTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch closed", txHash);
};

end().catch(console.error);
