import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import BN from "bn.js";
import { AUTOCRAT_V0_5_PROGRAM_ID } from "../../constants.js";

export const getDaoAddr = ({
  nonce,
  daoCreator,
  programId = AUTOCRAT_V0_5_PROGRAM_ID,
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

export const getDaoTreasuryAddr = (
  programId: PublicKey = AUTOCRAT_V0_5_PROGRAM_ID,
  dao: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([dao.toBuffer()], programId);
};

export const getProposalAddr = (
  programId: PublicKey = AUTOCRAT_V0_5_PROGRAM_ID,
  squadsProposal: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("proposal"), squadsProposal.toBuffer()],
    programId,
  );
};
