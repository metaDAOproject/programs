import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { METADAO_MULTISIG_VAULT } from "@metadaoproject/programs";
import {
  createSquadsVaultTxAndProposal,
  getSquadsPdasFromDao,
} from "./squads.js";

// MetaDAO operational multisig - its vault 0 (METADAO_MULTISIG_VAULT) is the futarchy admin
export const METADAO_MULTISIG = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);

const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

/**
 * Routes a set of instructions the DAO's squads vault should execute through
 * the admin approval system, by building two transactions:
 *
 * 1. `daoTransaction` creates the squads vault transaction + proposal holding
 *    `instructions` on the DAO's multisig. Sign with the payer and
 *    PERMISSIONLESS_ACCOUNT (the creator).
 * 2. `metadaoTransaction` creates the squads vault transaction + proposal on
 *    the MetaDAO operational multisig that enqueues the futarchy admin
 *    approval of the DAO proposal. Sign with the payer, which MUST be a
 *    member of the operational multisig with permission to propose
 *    transactions.
 *
 * Once the operational multisig approves + executes its transaction, the DAO
 * proposal can be approved + executed permissionlessly via
 * executeMultisigProposalApproval.
 */
export const buildAdminApprovalTransactions = async ({
  provider,
  futarchy,
  dao,
  instructions,
  payer,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  instructions: TransactionInstruction[];
  payer: PublicKey;
}) => {
  const { multisigPda: daoMultisig, vaultPda: daoMultisigVault } =
    await getSquadsPdasFromDao(dao);

  // === DAO multisig: vault transaction with the DAO's instructions ===

  const daoMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      daoMultisig,
    );

  const daoTransactionIndex =
    BigInt(daoMultisigAccount.transactionIndex.toString()) + 1n;

  const daoMessage = new TransactionMessage({
    payerKey: daoMultisigVault,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions,
  });

  const {
    vaultTxCreateIx: daoVaultTxCreateIx,
    proposalCreateIx: daoProposalCreateIx,
  } = await createSquadsVaultTxAndProposal(
    daoMultisig,
    daoTransactionIndex,
    daoMessage,
    payer,
  );

  const [daoVaultTransactionPda] = multisig.getTransactionPda({
    multisigPda: daoMultisig,
    index: daoTransactionIndex,
  });

  const [daoProposalPda] = multisig.getProposalPda({
    multisigPda: daoMultisig,
    transactionIndex: daoTransactionIndex,
  });

  const daoTransaction = new Transaction().add(
    daoVaultTxCreateIx,
    daoProposalCreateIx,
  );
  daoTransaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  daoTransaction.feePayer = payer;

  // === Ops multisig: vault transaction enqueueing the admin approval ===

  const metadaoMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      METADAO_MULTISIG,
    );

  const metadaoTransactionIndex =
    BigInt(metadaoMultisigAccount.transactionIndex.toString()) + 1n;

  const [enqueuedApprovalPda] = PublicKey.findProgramAddressSync(
    [
      SEED_ENQUEUED_APPROVAL,
      dao.toBuffer(),
      new BN(daoTransactionIndex.toString()).toArrayLike(Buffer, "le", 8),
    ],
    futarchy.futarchy.programId,
  );

  // The vault signs as the futarchy admin and pays rent for the enqueued
  // approval account, so it needs to hold a small amount of SOL
  const enqueueApprovalIx = await futarchy.futarchy.methods
    .adminEnqueueMultisigProposalApproval({
      transactionIndex: new BN(daoTransactionIndex.toString()),
    })
    .accounts({
      dao,
      admin: METADAO_MULTISIG_VAULT,
      squadsMultisig: daoMultisig,
      squadsMultisigProposal: daoProposalPda,
      enqueuedApproval: enqueuedApprovalPda,
    })
    .instruction();

  const enqueueApprovalMessage = new TransactionMessage({
    payerKey: METADAO_MULTISIG_VAULT,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: [enqueueApprovalIx],
  });

  const {
    vaultTxCreateIx: enqueueApprovalVaultTxCreateIx,
    proposalCreateIx: enqueueApprovalProposalCreateIx,
  } = await createSquadsVaultTxAndProposal(
    METADAO_MULTISIG,
    metadaoTransactionIndex,
    enqueueApprovalMessage,
    payer,
    payer,
  );

  const [metadaoVaultTransactionPda] = multisig.getTransactionPda({
    multisigPda: METADAO_MULTISIG,
    index: metadaoTransactionIndex,
  });

  const [metadaoProposalPda] = multisig.getProposalPda({
    multisigPda: METADAO_MULTISIG,
    transactionIndex: metadaoTransactionIndex,
  });

  const metadaoTransaction = new Transaction().add(
    enqueueApprovalVaultTxCreateIx,
    enqueueApprovalProposalCreateIx,
  );
  metadaoTransaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  metadaoTransaction.feePayer = payer;

  return {
    daoTransaction,
    daoTransactionIndex,
    daoVaultTransactionPda,
    daoProposalPda,
    metadaoTransaction,
    metadaoTransactionIndex,
    metadaoVaultTransactionPda,
    metadaoProposalPda,
    enqueuedApprovalPda,
  };
};
