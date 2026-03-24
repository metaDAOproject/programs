import { TransactionInstruction } from "@solana/web3.js";

export type LowercaseKeys<T> = {
  [K in keyof T as Lowercase<string & K>]: T[K];
};

export class InstructionUtils {
  public static async getInstructions(
    ...methodBuilders: any[]
  ): Promise<TransactionInstruction[]> {
    let instructions: TransactionInstruction[] = [];

    for (const methodBuilder of methodBuilders) {
      instructions.push(...(await methodBuilder.transaction()).instructions);
    }

    return instructions;
  }
}
