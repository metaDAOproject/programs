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
  PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  LAUNCHPAD_PROGRAM_ID,
  FUTARCHY_PROGRAM_ID,
  BID_WALL_PROGRAM_ID,
  MINT_GOVERNOR_PROGRAM_ID,
  LIQUIDATION_PROGRAM_ID,
} from "../constants.js";

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

export const getBidWallAddr = ({
  programId = BID_WALL_PROGRAM_ID,
  baseMint,
  creator,
  nonce,
}: {
  programId?: PublicKey;
  baseMint: PublicKey;
  creator: PublicKey;
  nonce: BN;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("bid_wall"),
      baseMint.toBuffer(),
      creator.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
};

export const getMintGovernorAddr = ({
  programId = MINT_GOVERNOR_PROGRAM_ID,
  mint,
  createKey,
}: {
  programId?: PublicKey;
  mint: PublicKey;
  createKey: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_governor"), mint.toBuffer(), createKey.toBuffer()],
    programId,
  );
};

export const getMintAuthorityAddr = ({
  programId = MINT_GOVERNOR_PROGRAM_ID,
  mintGovernor,
  authorizedMinter,
}: {
  programId?: PublicKey;
  mintGovernor: PublicKey;
  authorizedMinter: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("mint_authority"),
      mintGovernor.toBuffer(),
      authorizedMinter.toBuffer(),
    ],
    programId,
  );
};

export const getPerformancePackageV2Addr = ({
  programId = PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
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

export const getChangeRequestV2Addr = ({
  programId = PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
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

export const getLiquidationAddr = ({
  programId = LIQUIDATION_PROGRAM_ID,
  baseMint,
  quoteMint,
  createKey,
}: {
  programId?: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  createKey: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("liquidation"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
      createKey.toBuffer(),
    ],
    programId,
  );
};

export const getRefundRecordAddr = ({
  programId = LIQUIDATION_PROGRAM_ID,
  liquidation,
  recipient,
}: {
  programId?: PublicKey;
  liquidation: PublicKey;
  recipient: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("refund_record"),
      liquidation.toBuffer(),
      recipient.toBuffer(),
    ],
    programId,
  );
};
