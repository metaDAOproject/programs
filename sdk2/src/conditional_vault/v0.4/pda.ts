import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import BN from "bn.js";

export const getQuestionAddr = (
  programId: PublicKey,
  questionId: Uint8Array,
  oracle: PublicKey,
  numOutcomes: number,
) => {
  if (questionId.length != 32) {
    throw new Error("questionId must be 32 bytes");
  }

  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("question"),
      Buffer.from(questionId),
      oracle.toBuffer(),
      new BN(numOutcomes).toArrayLike(Buffer, "le", 1),
    ],
    programId,
  );
};

export const getVaultAddr = (
  programId: PublicKey,
  question: PublicKey,
  underlyingTokenMint: PublicKey,
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_vault"),
      question.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    programId,
  );
};

export const getConditionalTokenMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  index: number,
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_token"),
      vault.toBuffer(),
      new BN(index).toArrayLike(Buffer, "le", 1),
    ],
    programId,
  );
};

export const getDownAndUpMintAddrs = (
  programId: PublicKey,
  vault: PublicKey,
): { down: PublicKey; up: PublicKey } => {
  return {
    down: getConditionalTokenMintAddr(programId, vault, 0)[0],
    up: getConditionalTokenMintAddr(programId, vault, 1)[0],
  };
};

export const getFailAndPassMintAddrs = (
  programId: PublicKey,
  vault: PublicKey,
): { fail: PublicKey; pass: PublicKey } => {
  return {
    fail: getConditionalTokenMintAddr(programId, vault, 0)[0],
    pass: getConditionalTokenMintAddr(programId, vault, 1)[0],
  };
};
