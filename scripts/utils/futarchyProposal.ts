import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { sha256 } from "@noble/hashes/sha256";
import bs58 from "bs58";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  FutarchyClient,
  getProposalAddr,
} from "@metadaoproject/programs/futarchy/v0.6";
import {
  buildDaoActions,
  DaoActionBuilder,
  sendAndConfirm,
} from "./daoActions.js";
import {
  createSquadsVaultTxAndProposal,
  getSquadsPdasFromDao,
} from "./squads.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const accountExists = async (connection: Connection, account: PublicKey) =>
  (await connection.getAccountInfo(account, "confirmed")) !== null;

/**
 * Signs and sends a transaction, confirming it at the confirmed commitment.
 * A failed attempt is retried with a freshly built transaction: a load
 * balanced RPC can run preflight on a node that hasn't yet seen the
 * transaction that created an account this one reads, and a transaction that
 * expires unconfirmed can never land, so rebuilding it is safe.
 *
 * `createdAccounts` are accounts only this flow creates (PDAs of its own
 * proposal); when they all exist the transaction is skipped, so an attempt
 * that landed without being confirmed isn't repeated. Leave it out for
 * accounts anyone could create at the same address, like squads transactions
 * at a transaction index - there, only a confirmed signature counts as
 * success.
 */
const sendCreateTransaction = async ({
  provider,
  payer,
  signers = [],
  name,
  createdAccounts = [],
  buildTransaction,
  attempts = 5,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  signers?: Keypair[];
  name: string;
  createdAccounts?: PublicKey[];
  buildTransaction: () => Promise<Transaction>;
  attempts?: number;
}) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (createdAccounts.length > 0) {
      const existing = await Promise.all(
        createdAccounts.map((account) =>
          accountExists(provider.connection, account),
        ),
      );
      if (existing.every(Boolean)) {
        console.log(`${name} already exists - skipping`);
        return null;
      }
    }

    try {
      const transaction = await buildTransaction();
      const { blockhash, lastValidBlockHeight } =
        await provider.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer, ...signers);

      let signature: string;
      try {
        signature = await provider.connection.sendRawTransaction(
          transaction.serialize(),
          { preflightCommitment: "confirmed" },
        );
      } catch (error) {
        // The node rejected the transaction, so nothing was broadcast
        if (error instanceof SendTransactionError) {
          throw error;
        }
        // Anything else (e.g. a transport error) may have happened after the
        // transaction was forwarded, so confirm it by signature: it either
        // lands or expires, and only then is rebuilding it safe
        signature = bs58.encode(transaction.signature!);
      }

      const status = await provider.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (status.value.err) {
        throw new Error(
          `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
        );
      }

      console.log(`${name} created!`);
      console.log("Transaction signature:", signature);
      return signature;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.warn(
        `${name}: attempt ${attempt} of ${attempts} failed, retrying -`,
        error instanceof Error ? error.message : error,
      );
      await sleep(2_000);
    }
  }

  throw new Error(`${name}: out of attempts`);
};

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
 * was created: checks the squads proposal is on the DAO's multisig and still
 * active, then initializes the futarchy proposal for it, skipping the
 * accounts that already exist. The actions aren't rebuilt - the instructions
 * put up for vote are the ones the squads transaction already holds.
 */
const resumeFutarchyProposal = async ({
  provider,
  futarchy,
  dao,
  payer,
  squadsProposal,
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: Keypair;
  squadsProposal: PublicKey;
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
 * Re-run with `resumeSquadsProposal` set to it to finish the initialization;
 * the actions are ignored then, since the instructions are already on-chain.
 * Any other error means no squads proposal was confirmed, so the run can be
 * repeated as is.
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
  if (resumeSquadsProposal) {
    return resumeFutarchyProposal({
      provider,
      futarchy,
      dao,
      payer,
      squadsProposal: resumeSquadsProposal,
    });
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

  if (setupTransaction) {
    setupTransaction.sign(payer);

    const setupSignature = await sendAndConfirm(provider, setupTransaction);

    console.log("Setup transaction sent!");
    console.log("Transaction signature:", setupSignature);
  }

  // Read only now so the DAO multisig's transaction index is fresh. It stays
  // pinned across retries: an attempt that expired can't land anymore, and if
  // another proposal took the index meanwhile the retries fail on it instead
  // of adopting it.
  const daoMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      daoMultisig,
    );
  const transactionIndex =
    BigInt(daoMultisigAccount.transactionIndex.toString()) + 1n;

  const transactionMessage = new TransactionMessage({
    payerKey: daoMultisigVault,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
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

  try {
    await sendCreateTransaction({
      provider,
      payer,
      signers: [PERMISSIONLESS_ACCOUNT],
      name: "Squads transaction and proposal",
      buildTransaction: async () =>
        new Transaction().add(vaultTxCreateIx, proposalCreateIx),
    });
  } catch (error) {
    console.error(
      "Creating the squads transaction and proposal failed. No squads proposal was confirmed, so the run can be repeated as is.",
    );
    throw error;
  }

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
