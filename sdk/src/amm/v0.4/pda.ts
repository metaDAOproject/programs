import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { AMM_V0_4_PROGRAM_ID } from "../../constants.js";

export const getAmmAddr = (
  programId: PublicKey = AMM_V0_4_PROGRAM_ID,
  baseMint: PublicKey,
  quoteMint: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("amm__"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    programId,
  );
};

export const getAmmLpMintAddr = (
  programId: PublicKey = AMM_V0_4_PROGRAM_ID,
  amm: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("amm_lp_mint"), amm.toBuffer()],
    programId,
  );
};
