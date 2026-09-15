import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { sha256 } from "@noble/hashes/sha256";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  FutarchyClient,
  getProposalAddr,
} from "@metadaoproject/programs/futarchy/v0.6";
import { buildDaoActions, DaoActionBuilder } from "./daoActions.js";
import {
  compareVaultTransactionInstructions,
  createSquadsVaultTxAndProposal,
  getSquadsPdasFromDao,
  probeSquadsVaultTransaction,
} from "./squads.js";
import { sendAndConfirm, sendWithRetries } from "./transactions.js";

const accountExists = async (connection: Connection, account: PublicKey) =>
  (await connection.getAccountInfo(account, "confirmed")) !== null;

/**
 * Sends a transaction creating `createdAccounts` - PDAs only this proposal's
 * flow creates - through sendWithRetries, treating the step as done once they
 * all exist. That's what makes a failed run re-runnable: steps whose accounts
 * already exist are skipped.
 */
const sendCreateTransaction = ({
  provider,
  payer,
  name,
  createdAccounts,
  buildTransaction,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  name: string;
  createdAccounts: PublicKey[];
  buildTransaction: () => Promise<Transaction>;
}) =>
  sendWithRetries({
    provider,
    payer,
    name,
    build: async () => ({ transaction: await buildTransaction() }),
    probe: async () => {
      const existing = await Promise.all(
        createdAccounts.map((account) =>
          accountExists(provider.connection, account),
        ),
      );
      return existing.every(Boolean) ? "landed" : "absent";
    },
  });

/**
 * Initializes the futarchy proposal for an existing squads proposal on the
 * DAO's multisig: the question, both conditional vaults and the proposal
 * account, each in its own transaction. Steps whose accounts already exist
 * are skipped, so a run that failed partway through can be re-run.
 */
export const initializeFutarchyProposal = async ({
  provider,
  futarchy,
  dao,
  squadsProposal,
  payer,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  squadsProposal: PublicKey;
  payer: Keypair;
}) => {
  const daoAccount = await futarchy.getDao(dao);
  const [proposal] = getProposalAddr(
    futarchy.futarchy.programId,
    squadsProposal,
  );
  const { question, baseVault, quoteVault } = futarchy.getProposalPdas(
    proposal,
    daoAccount.baseMint,
    daoAccount.quoteMint,
    dao,
  );
  const vaultClient = futarchy.vaultClient;

  console.log("Squads proposal:", squadsProposal.toBase58());
  console.log("Proposal:", proposal.toBase58());
  console.log("Question:", question.toBase58());
  console.log("Base vault:", baseVault.toBase58());
  console.log("Quote vault:", quoteVault.toBase58());

  await sendCreateTransaction({
    provider,
    payer,
    name: "Question",
    createdAccounts: [question],
    buildTransaction: () =>
      vaultClient
        .initializeQuestionIx(
          sha256(`Will ${proposal} pass?/FAIL/PASS`),
          proposal,
          2,
        )
        .transaction(),
  });

  await sendCreateTransaction({
    provider,
    payer,
    name: "Conditional vaults",
    createdAccounts: [baseVault, quoteVault],
    buildTransaction: async () => {
      const transaction = new Transaction();
      for (const [vault, mint] of [
        [baseVault, daoAccount.baseMint],
        [quoteVault, daoAccount.quoteMint],
      ]) {
        if (!(await accountExists(provider.connection, vault))) {
          const vaultTransaction = await vaultClient
            .initializeVaultIx(question, mint, 2, payer.publicKey)
            .transaction();
          transaction.add(...vaultTransaction.instructions);
        }
      }
      return transaction;
    },
  });

  await sendCreateTransaction({
    provider,
    payer,
    name: "Futarchy proposal",
    createdAccounts: [proposal],
    buildTransaction: () =>
      futarchy
        .initializeProposalIx(
          squadsProposal,
          dao,
          daoAccount.baseMint,
          daoAccount.quoteMint,
          question,
          payer.publicKey,
        )
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ])
        .transaction(),
  });

  console.log(
    "The proposal is in draft state. Stake base tokens to it, or have the team sponsor it with sponsorProposal.ts, then launch it.",
  );

  return proposal;
};

/**
 * Thrown by createFutarchyProposal when its squads proposal was created but
 * initializing the futarchy proposal for it failed. Carries the squads
 * proposal to resume from - re-running with `resumeSquadsProposal` set to it
 * finishes the initialization instead of creating a second squads proposal.
 */
export class FutarchyProposalInitializationError extends Error {
  constructor(
    readonly squadsProposal: PublicKey,
    readonly squadsVaultTransaction: PublicKey,
    readonly transactionIndex: bigint,
    readonly cause: unknown,
  ) {
    super(
      `Squads proposal ${squadsProposal.toBase58()} (transaction index ${transactionIndex}) was created, but initializing its futarchy proposal failed: ${
        cause instanceof Error ? cause.message : cause
      }. Don't re-run as is - that creates a second squads proposal with the same instructions. Re-run with resumeSquadsProposal set to ${squadsProposal.toBase58()} to finish initializing this one.`,
    );
    this.name = "FutarchyProposalInitializationError";
  }
}

/**
 * Finishes a createFutarchyProposal run that failed after its squads proposal
 * was created: checks the squads proposal is on the DAO's multisig, still
 * active and holds `instructions` - what the actions produce now - then
 * initializes the futarchy proposal for it, skipping the accounts that
 * already exist. What's put up for vote is what the squads transaction
 * already holds: instructions whose data differs (amounts recomputed from
 * live state, like withdrawal minimums) are reported, anything else differing
 * means it isn't the proposal these actions created.
 */
const resumeFutarchyProposal = async ({
  provider,
  futarchy,
  dao,
  payer,
  squadsProposal,
  instructions,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: Keypair;
  squadsProposal: PublicKey;
  instructions: TransactionInstruction[];
}) => {
  const { multisigPda: daoMultisig } = await getSquadsPdasFromDao(dao);

  const squadsProposalAccount =
    await multisig.accounts.Proposal.fromAccountAddress(
      provider.connection,
      squadsProposal,
    );

  if (!squadsProposalAccount.multisig.equals(daoMultisig)) {
    throw new Error(
      `Squads proposal ${squadsProposal.toBase58()} belongs to multisig ${squadsProposalAccount.multisig.toBase58()}, not the DAO's (${daoMultisig.toBase58()})`,
    );
  }
  if (squadsProposalAccount.status.__kind !== "Active") {
    throw new Error(
      `Squads proposal ${squadsProposal.toBase58()} is ${squadsProposalAccount.status.__kind}, not Active - there's nothing to resume`,
    );
  }

  const transactionIndex = BigInt(
    squadsProposalAccount.transactionIndex.toString(),
  );
  const [squadsVaultTransaction] = multisig.getTransactionPda({
    multisigPda: daoMultisig,
    index: transactionIndex,
  });

  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      provider.connection,
      squadsVaultTransaction,
    );
  const comparison = compareVaultTransactionInstructions(
    vaultTransaction.message,
    instructions,
  );
  if (comparison.kind === "different") {
    throw new Error(
      `Squads proposal ${squadsProposal.toBase58()} holds other instructions than the actions produce - it isn't the proposal these actions created. Check resumeSquadsProposal against the failed run's log.`,
    );
  }
  if (comparison.kind === "data") {
    for (const i of comparison.differing) {
      console.warn(
        `Instruction ${i} (${instructions[i].programId.toBase58()}) holds different data on-chain than the actions produce now. The on-chain data is what a passed proposal executes - expected for amounts derived from live state, like withdrawal minimums.`,
      );
    }
  }

  console.log("Resuming squads proposal:", squadsProposal.toBase58());
  console.log("Squads transaction index:", transactionIndex.toString());
  console.log("Squads transaction:", squadsVaultTransaction.toBase58());

  const proposal = await initializeFutarchyProposal({
    provider,
    futarchy,
    dao,
    squadsProposal,
    payer,
  });

  return { proposal, squadsProposal, squadsVaultTransaction, transactionIndex };
};

/**
 * Runs the action builders and puts their instructions up for a futarchy
 * vote: sends the payer-funded setup transaction (if any), creates the squads
 * vault transaction + proposal holding the instructions on the DAO's
 * multisig, then initializes the futarchy proposal in draft state. Stake base
 * tokens to the proposal - or have the team sponsor it - and launch it to
 * start the vote.
 *
 * If initialization fails after the squads proposal was created, a
 * FutarchyProposalInitializationError carrying the squads proposal is thrown.
 * Re-run with `resumeSquadsProposal` set to it and the same actions to finish
 * the initialization; the actions are only rebuilt then to check the squads
 * proposal holds them, since what's voted on is already on-chain.
 * Any other error means nothing of this run landed on the DAO's multisig, so
 * the run can be repeated as is.
 *
 * A passed proposal is executed permissionlessly, so actions the DAO itself
 * signs (requiresAdminExecution) can't go through here - route those through
 * the admin approval flow instead.
 */
export const createFutarchyProposal = async ({
  provider,
  futarchy,
  dao,
  payer,
  actions,
  resumeSquadsProposal,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: Keypair;
  actions: DaoActionBuilder[];
  resumeSquadsProposal?: PublicKey;
}) => {
  if (resumeSquadsProposal && actions.length === 0) {
    throw new Error(
      "Resuming needs the actions the squads proposal was created with, to check it holds them",
    );
  }

  const {
    daoMultisig,
    daoMultisigVault,
    instructions,
    setupTransaction,
    requiresAdminExecution,
  } = await buildDaoActions({
    provider,
    futarchy,
    dao,
    payer: payer.publicKey,
    actions,
  });

  if (requiresAdminExecution) {
    throw new Error(
      "An action is signed by the DAO itself, which a futarchy proposal's permissionless execution can't provide - enqueue it through the admin approval flow instead",
    );
  }

  if (resumeSquadsProposal) {
    return resumeFutarchyProposal({
      provider,
      futarchy,
      dao,
      payer,
      squadsProposal: resumeSquadsProposal,
      instructions,
    });
  }

  if (setupTransaction) {
    setupTransaction.sign(payer);

    const setupSignature = await sendAndConfirm(provider, setupTransaction);

    console.log("Setup transaction sent!");
    console.log("Transaction signature:", setupSignature);
  }

  const { transactionIndex, squadsVaultTransaction, squadsProposal } =
    await sendWithRetries({
      provider,
      payer,
      signers: [PERMISSIONLESS_ACCOUNT],
      name: "Squads transaction and proposal",
      // Built only now so the DAO multisig's transaction index is fresh, and
      // rebuilt only if another proposal takes that index
      build: async () => {
        const daoMultisigAccount =
          await multisig.accounts.Multisig.fromAccountAddress(
            provider.connection,
            daoMultisig,
          );
        const transactionIndex =
          BigInt(daoMultisigAccount.transactionIndex.toString()) + 1n;

        const transactionMessage = new TransactionMessage({
          payerKey: daoMultisigVault,
          recentBlockhash: (await provider.connection.getLatestBlockhash())
            .blockhash,
          instructions,
        });

        const { vaultTxCreateIx, proposalCreateIx } =
          await createSquadsVaultTxAndProposal(
            daoMultisig,
            transactionIndex,
            transactionMessage,
            payer.publicKey,
          );

        const [squadsVaultTransaction] = multisig.getTransactionPda({
          multisigPda: daoMultisig,
          index: transactionIndex,
        });
        const [squadsProposal] = multisig.getProposalPda({
          multisigPda: daoMultisig,
          transactionIndex,
        });

        return {
          transaction: new Transaction().add(vaultTxCreateIx, proposalCreateIx),
          transactionIndex,
          squadsVaultTransaction,
          squadsProposal,
        };
      },
      probe: ({ squadsVaultTransaction }) =>
        probeSquadsVaultTransaction(
          provider.connection,
          squadsVaultTransaction,
          instructions,
        ),
    });

  console.log("Squads transaction index:", transactionIndex.toString());
  console.log("Squads transaction:", squadsVaultTransaction.toBase58());
  console.log("Squads proposal:", squadsProposal.toBase58());

  let proposal: PublicKey;
  try {
    proposal = await initializeFutarchyProposal({
      provider,
      futarchy,
      dao,
      squadsProposal,
      payer,
    });
  } catch (error) {
    throw new FutarchyProposalInitializationError(
      squadsProposal,
      squadsVaultTransaction,
      transactionIndex,
      error,
    );
  }

  return { proposal, squadsProposal, squadsVaultTransaction, transactionIndex };
};
