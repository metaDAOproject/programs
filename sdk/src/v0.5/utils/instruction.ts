import * as anchor from "@coral-xyz/anchor";
import { TransactionInstruction } from "@solana/web3.js";

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
