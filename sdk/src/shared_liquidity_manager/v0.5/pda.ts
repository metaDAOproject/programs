import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
} from "../../constants.js";

export const getSharedLiquidityPoolAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  dao: PublicKey,
  creator: PublicKey,
  proposalStakeRateThresholdBps: number,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("sl_pool"),
      dao.toBuffer(),
      creator.toBuffer(),
      new BN(proposalStakeRateThresholdBps).toArrayLike(Buffer, "le", 2),
    ],
    programId,
  );
};

export const getSlPoolPositionAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  slPool: PublicKey,
  user: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sl_pool_position"), slPool.toBuffer(), user.toBuffer()],
    programId,
  );
};

export const getSharedLiquidityPoolSignerAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  slPool: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sl_pool_signer"), slPool.toBuffer()],
    programId,
  );
};

export const getSpotPoolAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  slPool: PublicKey,
  index: number,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("spot_pool"),
      slPool.toBuffer(),
      new BN(index).toArrayLike(Buffer, "le", 4),
    ],
    programId,
  );
};

export const getDraftProposalAddr = (
  programId: PublicKey = SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  nonce: BN,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("draft_proposal"), nonce.toArrayLike(Buffer, "le", 8)],
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

export const getRaydiumCpmmPoolVaultAddr = (
  poolState: PublicKey,
  token: PublicKey,
  isDevnet: boolean,
): [PublicKey, number] => {
  const programId = isDevnet
    ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
    : RAYDIUM_CP_SWAP_PROGRAM_ID;
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("pool_vault"),
      poolState.toBuffer(),
      token.toBuffer(),
    ],
    programId,
  );
};

export const getRaydiumCpmmObservationStateAddr = (
  poolState: PublicKey,
  isDevnet: boolean,
): [PublicKey, number] => {
  const programId = isDevnet
    ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
    : RAYDIUM_CP_SWAP_PROGRAM_ID;
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("observation"), poolState.toBuffer()],
    programId,
  );
};

export const getRaydiumCpmmLpMintAddr = (
  poolState: PublicKey,
  isDevnet: boolean,
): [PublicKey, number] => {
  const programId = isDevnet
    ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
    : RAYDIUM_CP_SWAP_PROGRAM_ID;
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), poolState.toBuffer()],
    programId,
  );
};
