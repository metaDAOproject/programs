import { AccountMeta, PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import {
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
} from "../constants.js";
import { LAUNCHPAD_PROGRAM_ID, FUTARCHY_PROGRAM_ID } from "../constants.js";

export const getEventAuthorityAddr = (programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId,
  );
};

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

export const getMetadataAddr = (mint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID,
  );
};

export const getDaoAddr = ({
  nonce,
  daoCreator,
  programId = FUTARCHY_PROGRAM_ID,
}: {
  nonce: BN;
  daoCreator: PublicKey;
  programId?: PublicKey;
}): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("dao"),
      daoCreator.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
};

/**
 * @deprecated Use getAutocratProposalAddr instead
 */
export const getProposalAddr = (
  programId: PublicKey,
  squadsProposal: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("proposal"), squadsProposal.toBuffer()],
    programId,
  );
};

export const getProposalAddrV2 = ({
  programId = FUTARCHY_PROGRAM_ID,
  squadsProposal,
}: {
  programId?: PublicKey;
  squadsProposal: PublicKey;
}): [PublicKey, number] => {
  return getProposalAddr(programId, squadsProposal);
};

export function getLaunchAddr(
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  tokenMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch"), tokenMint.toBuffer()],
    programId,
  );
}

export const getLaunchSignerAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  launch: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_signer"), launch.toBuffer()],
    programId,
  );
};

export const getFundingRecordAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  launch: PublicKey,
  funder: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding_record"), launch.toBuffer(), funder.toBuffer()],
    programId,
  );
};

export const getStakeRecordAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  draftProposal: PublicKey,
  staker: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake_record"), draftProposal.toBuffer(), staker.toBuffer()],
    programId,
  );
};

export const getPerformancePackageAddr = ({
  programId = PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  createKey,
}: {
  programId?: PublicKey;
  createKey: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("performance_package"), createKey.toBuffer()],
    programId,
  );
};
