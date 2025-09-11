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
  RAYDIUM_CP_SWAP_PROGRAM_ID,
} from "../constants.js";
import { LAUNCHPAD_PROGRAM_ID } from "../constants.js";

export const getEventAuthorityAddr = (programId: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    programId
  );
};

export const getQuestionAddr = (
  programId: PublicKey,
  questionId: Uint8Array,
  oracle: PublicKey,
  numOutcomes: number
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
    programId
  );
};

export const getVaultAddr = (
  programId: PublicKey,
  question: PublicKey,
  underlyingTokenMint: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_vault"),
      question.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    programId
  );
};

export const getConditionalTokenMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  index: number
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_token"),
      vault.toBuffer(),
      new BN(index).toArrayLike(Buffer, "le", 1),
    ],
    programId
  );
};

export const getDownAndUpMintAddrs = (
  programId: PublicKey,
  vault: PublicKey
): { down: PublicKey; up: PublicKey } => {
  return {
    down: getConditionalTokenMintAddr(programId, vault, 0)[0],
    up: getConditionalTokenMintAddr(programId, vault, 1)[0],
  };
};

export const getFailAndPassMintAddrs = (
  programId: PublicKey,
  vault: PublicKey
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
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
};

export const getDaoTreasuryAddr = (
  programId: PublicKey,
  dao: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([dao.toBuffer()], programId);
};

export const getProposalAddr = (
  programId: PublicKey,
  proposer: PublicKey,
  nonce: BN
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("proposal"),
      proposer.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
};

export const getAmmAddr = (
  programId: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("amm__"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    programId
  );
};

export const getAmmLpMintAddr = (
  programId: PublicKey,
  amm: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("amm_lp_mint"), amm.toBuffer()],
    programId
  );
};

export function getLaunchAddr(
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch"), tokenMint.toBuffer()],
    programId
  );
}

export const getLaunchSignerAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  launch: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_signer"), launch.toBuffer()],
    programId
  );
};

export const getFundingRecordAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  launch: PublicKey,
  funder: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding_record"), launch.toBuffer(), funder.toBuffer()],
    programId
  );
};

export const getLaunchDaoAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  launch: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_dao"), launch.toBuffer()],
    programId
  );
};

export const getLiquidityPoolAddr = (
  programId: PublicKey = LAUNCHPAD_PROGRAM_ID,
  dao: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_state"), dao.toBuffer()],
    programId
  );
};

export const getRaydiumCpmmLpMintAddr = (
  poolState: PublicKey,
  isDevnet: boolean
): [PublicKey, number] => {
  const programId = isDevnet
    ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
    : RAYDIUM_CP_SWAP_PROGRAM_ID;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
    programId
  );
};
