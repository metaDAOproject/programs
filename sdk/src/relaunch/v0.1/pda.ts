import { PublicKey } from "@solana/web3.js";
import { RELAUNCH_V0_1_PROGRAM_ID } from "../../constants.js";

export const getRelaunchAddr = ({
  programId = RELAUNCH_V0_1_PROGRAM_ID,
  newMint,
}: {
  programId?: PublicKey;
  newMint: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("relaunch"), newMint.toBuffer()],
    programId,
  );
};

export const getRelaunchSignerAddr = ({
  programId = RELAUNCH_V0_1_PROGRAM_ID,
  relaunch,
}: {
  programId?: PublicKey;
  relaunch: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("relaunch_signer"), relaunch.toBuffer()],
    programId,
  );
};

export const getDepositRecordAddr = ({
  programId = RELAUNCH_V0_1_PROGRAM_ID,
  relaunch,
  depositor,
}: {
  programId?: PublicKey;
  relaunch: PublicKey;
  depositor: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("deposit_record"), relaunch.toBuffer(), depositor.toBuffer()],
    programId,
  );
};
