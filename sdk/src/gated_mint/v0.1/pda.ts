import { PublicKey } from "@solana/web3.js";
import { GATED_MINT_V0_1_PROGRAM_ID } from "../../constants.js";

export const getGatedMintConfigAddr = ({
  programId = GATED_MINT_V0_1_PROGRAM_ID,
  mint,
}: {
  programId?: PublicKey;
  mint: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("gated_mint_config"), mint.toBuffer()],
    programId,
  );
};

export const getWhitelistedUserAddr = ({
  programId = GATED_MINT_V0_1_PROGRAM_ID,
  mint,
  user,
}: {
  programId?: PublicKey;
  mint: PublicKey;
  user: PublicKey;
}) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("whitelisted_user"), mint.toBuffer(), user.toBuffer()],
    programId,
  );
};
