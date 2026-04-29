import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import BN from "bn.js";
import { AUTOCRAT_V0_3_PROGRAM_ID } from "../../constants.js";

export const getDaoTreasuryAddr = (
  programId: PublicKey = AUTOCRAT_V0_3_PROGRAM_ID,
  dao: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([dao.toBuffer()], programId);
};

export const getProposalAddr = (
  programId: PublicKey = AUTOCRAT_V0_3_PROGRAM_ID,
  proposer: PublicKey,
  nonce: BN,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("proposal"),
      proposer.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
};
