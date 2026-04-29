import { PublicKey } from "@solana/web3.js";
import { MINT_GOVERNOR_V0_7_PROGRAM_ID } from "../../constants.js";

export const getMintGovernorAddr = ({
  programId = MINT_GOVERNOR_V0_7_PROGRAM_ID,
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
  programId = MINT_GOVERNOR_V0_7_PROGRAM_ID,
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
