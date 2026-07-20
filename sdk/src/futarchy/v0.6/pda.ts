import { BN, utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

import { FUTARCHY_V0_6_PROGRAM_ID } from "../../constants.js";

export const getDaoAddr = ({
  nonce,
  daoCreator,
  programId = FUTARCHY_V0_6_PROGRAM_ID,
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

export const getProposalAddr = (
  programId: PublicKey = FUTARCHY_V0_6_PROGRAM_ID,
  squadsProposal: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("proposal"), squadsProposal.toBuffer()],
    programId,
  );
};

export const getProposalAddrV2 = ({
  programId = FUTARCHY_V0_6_PROGRAM_ID,
  squadsProposal,
}: {
  programId?: PublicKey;
  squadsProposal: PublicKey;
}): [PublicKey, number] => {
  return getProposalAddr(programId, squadsProposal);
};

// The Squads spending-limit PDA — `create_key` is always the DAO, so the
// address is derivable from the DAO alone.
export const getSpendingLimitAddr = ({
  dao,
}: {
  dao: PublicKey;
}): [PublicKey, number] => {
  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  return multisig.getSpendingLimitPda({ multisigPda, createKey: dao });
};

export const getStakeAddr = (
  programId: PublicKey = FUTARCHY_V0_6_PROGRAM_ID,
  draftProposal: PublicKey,
  staker: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), draftProposal.toBuffer(), staker.toBuffer()],
    programId,
  );
};
