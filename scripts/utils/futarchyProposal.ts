import { AnchorProvider } from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { sha256 } from "@noble/hashes/sha256";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
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
import { createSquadsVaultTxAndProposal } from "./squads.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const accountExists = async (connection: Connection, account: PublicKey) =>
  (await connection.getAccountInfo(account, "confirmed")) !== null;

/**
 * Signs and sends a transaction that creates `createdAccounts`, confirming it
 * at the confirmed commitment, and skips it when they all exist already. A
 * failed attempt is retried with a freshly built transaction: a load balanced
 * RPC can run preflight on a node that hasn't yet seen the transaction that
 * created an account this one reads, and a confirmation timeout doesn't rule
 * out the transaction landing - the existence check at the start of the next
 * attempt catches that.
 */
const sendCreateTransaction = async ({
  provider,
  payer,
  name,
  createdAccounts,
  buildTransaction,
  attempts = 5,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  name: string;
  createdAccounts: PublicKey[];
  buildTransaction: () => Promise<Transaction>;
  attempts?: number;
}) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const existing = await Promise.all(
      createdAccounts.map((account) =>
        accountExists(provider.connection, account),
      ),
    );
    if (existing.every(Boolean)) {
      console.log(`${name} already exists - skipping`);
      return null;
    }

    try {
      const transaction = await buildTransaction();
      const { blockhash, lastValidBlockHeight } =
        await provider.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer);

      const signature = await provider.connection.sendRawTransaction(
        transaction.serialize(),
        { preflightCommitment: "confirmed" },
      );
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
 * Runs the action builders and puts their instructions up for a futarchy
 * vote: sends the payer-funded setup transaction (if any), creates the squads
 * vault transaction + proposal holding the instructions on the DAO's
 * multisig, then initializes the futarchy proposal in draft state. Stake base
 * tokens to the proposal - or have the team sponsor it - and launch it to
 * start the vote.
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
}: {
  provider: AnchorProvider;
  futarchy: FutarchyClient;
  dao: PublicKey;
  payer: Keypair;
  actions: DaoActionBuilder[];
}) => {
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

  // Read only now so the DAO multisig's transaction index is fresh
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

  const squadsTransaction = new Transaction().add(
    vaultTxCreateIx,
    proposalCreateIx,
  );
  squadsTransaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  squadsTransaction.feePayer = payer.publicKey;
  squadsTransaction.sign(payer, PERMISSIONLESS_ACCOUNT);

  const squadsSignature = await sendAndConfirm(provider, squadsTransaction);

  console.log("Squads transaction created!");
  console.log("Transaction signature:", squadsSignature);
  console.log("Squads transaction index:", transactionIndex.toString());
  console.log("Squads transaction:", squadsVaultTransaction.toBase58());
  console.log("Squads proposal:", squadsProposal.toBase58());

  // Resumable - if this fails partway through, re-run initializeFutarchyProposal
  const proposal = await initializeFutarchyProposal({
    provider,
    futarchy,
    dao,
    squadsProposal,
    payer,
  });

  return { proposal, squadsProposal, squadsVaultTransaction, transactionIndex };
};
