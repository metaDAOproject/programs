import { PublicKey } from "@solana/web3.js";
import { LAUNCHPAD_V0_8_PROGRAM_ID } from "../../constants.js";

export function getLaunchAddr(
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  tokenMint: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch"), tokenMint.toBuffer()],
    programId,
  );
}

export const getLaunchSignerAddr = (
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  launch: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("launch_signer"), launch.toBuffer()],
    programId,
  );
};

export const getFundingRecordAddr = (
  programId: PublicKey = LAUNCHPAD_V0_8_PROGRAM_ID,
  launch: PublicKey,
  funder: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("funding_record"), launch.toBuffer(), funder.toBuffer()],
    programId,
  );
};
