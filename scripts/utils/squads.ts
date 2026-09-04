import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import { PublicKey, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";

// Returns the multisig, spending limit and 0th vault pda for a given dao address
export const getSquadsPdasFromDao = async (
  daoAddress: string | PublicKey,
): Promise<{
  multisigPda: PublicKey;
  spendingLimitPda: PublicKey;
  vaultPda: PublicKey;
}> => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPda,
    createKey: dao,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda: multisigPda,
    index: 0,
  });

  return {
    multisigPda,
    spendingLimitPda,
    vaultPda,
  };
};

export const getSquadsTxIndex = async (
  squadsMultisig: PublicKey,
  provider: anchor.AnchorProvider,
) => {
  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection, // TODO: Review if we want to instead offer connection class...
      squadsMultisig,
    );
  return Number(multisigAccountInfo.transactionIndex);
};

export const createSquadsVaultTxAndProposal = async (
  squadsMultisig: PublicKey,
  transactionIndex: bigint,
  transactionMessage: TransactionMessage,
  payer: PublicKey,
  creator: PublicKey = PERMISSIONLESS_ACCOUNT.publicKey,
) => {
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    isDraft: false,
  });

  return {
    vaultTxCreateIx,
    proposalCreateIx,
  };
};
