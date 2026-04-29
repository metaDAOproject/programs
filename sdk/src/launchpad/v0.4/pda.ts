import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import {
  LAUNCHPAD_V0_4_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
} from "../../constants.js";

export function getLaunchAddr(
  programId: PublicKey = LAUNCHPAD_V0_4_PROGRAM_ID,
  tokenMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch"), tokenMint.toBuffer()],
    programId,
  );
}

export const getLaunchSignerAddr = (
  programId: PublicKey = LAUNCHPAD_V0_4_PROGRAM_ID,
  launch: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_signer"), launch.toBuffer()],
    programId,
  );
};

export const getFundingRecordAddr = (
  programId: PublicKey = LAUNCHPAD_V0_4_PROGRAM_ID,
  launch: PublicKey,
  funder: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding_record"), launch.toBuffer(), funder.toBuffer()],
    programId,
  );
};

export const getLaunchDaoAddr = (
  programId: PublicKey = LAUNCHPAD_V0_4_PROGRAM_ID,
  launch: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_dao"), launch.toBuffer()],
    programId,
  );
};

export const getLiquidityPoolAddr = (
  programId: PublicKey = LAUNCHPAD_V0_4_PROGRAM_ID,
  dao: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool_state"), dao.toBuffer()],
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
