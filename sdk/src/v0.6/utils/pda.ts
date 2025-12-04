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
  DAMM_V2_PROGRAM_ID,
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
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

export const getStakeAddr = (
  programId: PublicKey = FUTARCHY_PROGRAM_ID,
  draftProposal: PublicKey,
  staker: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), draftProposal.toBuffer(), staker.toBuffer()],
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

export const getChangeRequestAddr = ({
  programId = PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  performancePackage,
  proposer,
  pdaNonce,
}: {
  programId?: PublicKey;
  performancePackage: PublicKey;
  proposer: PublicKey;
  pdaNonce: number;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("change_request"),
      performancePackage.toBuffer(),
      proposer.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([pdaNonce]).buffer)),
    ],
    programId,
  );
};

export const getMeteoraPoolAddr = ({
  baseMint,
  quoteMint = MAINNET_USDC,
  meteoraConfig = MAINNET_METEORA_CONFIG,
}: {
  baseMint: PublicKey;
  quoteMint: PublicKey;
  meteoraConfig: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      meteoraConfig.toBuffer(),
      getFirstKey(baseMint, quoteMint),
      getSecondKey(baseMint, quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );
};

export const getLaunchpadMeteoraPoolPositionAddr = ({
  baseMint,
}: {
  baseMint: PublicKey;
}) => {
  // TODO - refactor together with LaunchpadClient
  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
    LAUNCHPAD_PROGRAM_ID,
  );

  // TODO - refactor together with LaunchpadClient
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );
};

function getFirstKey(key1: PublicKey, key2: PublicKey) {
  const buf1 = key1.toBuffer();
  const buf2 = key2.toBuffer();
  // Buf1 > buf2
  if (Buffer.compare(buf1, buf2) === 1) {
    return buf1;
  }
  return buf2;
}

// TODO - refactor together with LaunchpadClient
function getSecondKey(key1: PublicKey, key2: PublicKey) {
  const buf1 = key1.toBuffer();
  const buf2 = key2.toBuffer();
  // Buf1 > buf2
  if (Buffer.compare(buf1, buf2) === 1) {
    return buf2;
  }
  return buf1;
}
