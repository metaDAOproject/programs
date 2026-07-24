import {
  type AddressLookupTableAccount,
  ComputeBudgetProgram,
  type Connection,
  type Keypair,
  type TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

export interface SimulateAndSendOptions {
  /** Multiplier on simulated CU (default 1.2). */
  cuBuffer?: number;
  /** Optional priority fee in microlamports per CU. */
  priorityMicroLamports?: number;
  commitment?: "processed" | "confirmed" | "finalized";
  /** Extra address lookup tables for the final message. */
  lookupTables?: AddressLookupTableAccount[];
}

/**
 * Simulate instructions (no CU budget), then rebuild with a buffered CU limit,
 * sign, send, and confirm.
 */
export async function simulateAndSendVersioned(
  instructions: TransactionInstruction[],
  payer: Keypair,
  connection: Connection,
  options: SimulateAndSendOptions = {},
): Promise<string> {
  const cuBuffer = options.cuBuffer ?? 1.2;
  const commitment = options.commitment ?? "confirmed";
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const simMessage = new TransactionMessage({
    instructions,
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message(options.lookupTables);
  const simulationTx = new VersionedTransaction(simMessage);

  const simulation = await connection.simulateTransaction(simulationTx, {
    sigVerify: false,
  });

  if (simulation.value.err) {
    console.error("Transaction simulation failed:", simulation.value.err);
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
    );
  }

  const computeUnitsUsed = simulation.value.unitsConsumed || 200_000;
  const computeUnitsWithBuffer = Math.floor(computeUnitsUsed * cuBuffer);
  console.log(`Simulated compute units: ${computeUnitsUsed}`);
  console.log(`Setting compute unit limit: ${computeUnitsWithBuffer}`);

  const finalIxs: TransactionInstruction[] = [
    ComputeBudgetProgram.setComputeUnitLimit({
      units: computeUnitsWithBuffer,
    }),
  ];
  if (options.priorityMicroLamports !== undefined) {
    finalIxs.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: options.priorityMicroLamports,
      }),
    );
  }
  finalIxs.push(...instructions);

  const finalMessage = new TransactionMessage({
    instructions: finalIxs,
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message(options.lookupTables);
  const finalTx = new VersionedTransaction(finalMessage);
  finalTx.sign([payer]);

  const txHash = await connection.sendRawTransaction(finalTx.serialize());
  const confirmation = await connection.confirmTransaction(
    { signature: txHash, blockhash, lastValidBlockHeight },
    commitment,
  );
  if (confirmation.value.err) {
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }
  return txHash;
}
