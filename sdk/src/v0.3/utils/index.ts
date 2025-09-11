export * from "./filters.js";
export * from "./pda.js";
export * from "./ammMath.js";
export * from "./metadata.js";
export * from "./cu.js";
export * from "./instruction.js";

import { AccountMeta, ComputeBudgetProgram, PublicKey } from "@solana/web3.js";

export enum PriorityFeeTier {
  NORMAL = 35,
  HIGH = 3571,
  TURBO = 357142,
}

export const addComputeUnits = (num_units: number = 1_400_000) =>
  ComputeBudgetProgram.setComputeUnitLimit({
    units: num_units,
  });

export const addPriorityFee = (pf: number) =>
  ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: pf,
  });

export const pubkeyToAccountInfo = (
  pubkey: PublicKey,
  isWritable: boolean,
  isSigner = false
): AccountMeta => {
  return {
    pubkey: pubkey,
    isSigner: isSigner,
    isWritable: isWritable,
  };
};

export async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
