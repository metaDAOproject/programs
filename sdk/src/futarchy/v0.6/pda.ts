import { utils } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
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

// The Squads transaction + proposal PDAs for a given transaction index, and
// the futarchy proposal PDA seeded on that Squads proposal. All three are
// derivable before anything exists — the typed create instructions create the
// Squads accounts at the next index themselves, so the client pins every
// address up front. The client-side twin of the on-chain derivation.
export const getProposalAddrsForTransactionIndex = ({
  dao,
  transactionIndex,
  programId = FUTARCHY_V0_6_PROGRAM_ID,
}: {
  dao: PublicKey;
  transactionIndex: bigint;
  programId?: PublicKey;
}): {
  squadsMultisig: PublicKey;
  squadsTransaction: PublicKey;
  squadsProposal: PublicKey;
  proposal: PublicKey;
} => {
  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  const [squadsTransaction] = multisig.getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });
  const [squadsProposal] = multisig.getProposalPda({
    multisigPda,
    transactionIndex,
  });
  const [proposal] = getProposalAddr(programId, squadsProposal);

  return {
    squadsMultisig: multisigPda,
    squadsTransaction,
    squadsProposal,
    proposal,
  };
};

// The futarchy PDA that records an admin's or liquidator's intent to cancel
// the Squads proposal at `transactionIndex`, consumed and closed by
// `execute_multisig_proposal_cancellation`.
export const getEnqueuedMultisigProposalCancellationAddr = ({
  dao,
  transactionIndex,
  programId = FUTARCHY_V0_6_PROGRAM_ID,
}: {
  dao: PublicKey;
  transactionIndex: bigint;
  programId?: PublicKey;
}): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("enqueued_cancellation"),
      dao.toBuffer(),
      new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
    ],
    programId,
  );
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
