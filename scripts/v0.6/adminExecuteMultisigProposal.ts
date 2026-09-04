import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";

// Executes a DAO squads proposal through admin_execute_multisig_proposal.
// Needed when the DAO itself signs some of the proposal's instructions (e.g.
// removing a spending limit): futarchy signs for the DAO in the execute CPI,
// which the permissionless squads execute can't do. If the proposal's
// enqueued approval hasn't been executed yet, it's executed in the same
// transaction.

///////////////
// Constants //
///////////////

// The squads proposal (on the DAO's multisig) to execute
const SQUADS_PROPOSAL = new PublicKey("SQUADS_PROPOSAL_PUBKEY");

////////////////
// Operations //
////////////////

const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

const provider = anchor.AnchorProvider.env();

// Payer MUST be the futarchy admin key
const payer = provider.wallet["payer"];

const futarchy = FutarchyClient.createClient({ provider });

async function main() {
  const proposal = await multisig.accounts.Proposal.fromAccountAddress(
    provider.connection,
    SQUADS_PROPOSAL,
  );
  const daoMultisig = proposal.multisig;
  const transactionIndex = BigInt(proposal.transactionIndex.toString());

  // The DAO is the multisig's create key
  const daoMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      daoMultisig,
    );
  const dao = daoMultisigAccount.createKey;

  const [vaultTransactionPda] = multisig.getTransactionPda({
    multisigPda: daoMultisig,
    index: transactionIndex,
  });
  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      provider.connection,
      vaultTransactionPda,
    );
  const [vaultPda] = multisig.getVaultPda({
    multisigPda: daoMultisig,
    index: vaultTransaction.vaultIndex,
  });

  console.log("DAO:", dao.toBase58());
  console.log("Squads transaction index:", transactionIndex.toString());
  console.log("Squads proposal status:", proposal.status.__kind);

  const instructions: TransactionInstruction[] = [];

  const [enqueuedApprovalPda] = PublicKey.findProgramAddressSync(
    [
      SEED_ENQUEUED_APPROVAL,
      dao.toBuffer(),
      new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
    ],
    futarchy.futarchy.programId,
  );
  const enqueuedApproval =
    await provider.connection.getAccountInfo(enqueuedApprovalPda);

  if (enqueuedApproval) {
    console.log("Executing the pending enqueued approval first");
    instructions.push(
      await futarchy.futarchy.methods
        .executeMultisigProposalApproval()
        .accounts({
          dao,
          rentReceiver: payer.publicKey,
          squadsMultisig: daoMultisig,
          squadsMultisigProposal: SQUADS_PROPOSAL,
          enqueuedApproval: enqueuedApprovalPda,
          squadsMultisigProgram: multisig.PROGRAM_ID,
        })
        .instruction(),
    );
  } else if (proposal.status.__kind !== "Approved") {
    throw new Error(
      `Squads proposal is ${proposal.status.__kind} and has no enqueued approval - has the ops multisig executed the enqueue?`,
    );
  }

  const { accountMetas, lookupTableAccounts } =
    await multisig.utils.accountsForTransactionExecute({
      connection: provider.connection,
      message: vaultTransaction.message,
      ephemeralSignerBumps: [...vaultTransaction.ephemeralSignerBumps],
      vaultPda,
      transactionPda: vaultTransactionPda,
      programId: multisig.PROGRAM_ID,
    });

  instructions.push(
    await futarchy.futarchy.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao,
        admin: payer.publicKey,
        squadsMultisig: daoMultisig,
        squadsMultisigProposal: SQUADS_PROPOSAL,
        squadsMultisigVaultTransaction: vaultTransactionPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      // The DAO can't sign the outer transaction - futarchy signs for it in
      // the CPI - so its meta must not require a signature here
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .instruction(),
  );

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts);
  const transaction = new VersionedTransaction(message);
  transaction.sign([payer]);

  const signature = await provider.connection.sendTransaction(transaction);
  const status = await provider.connection.confirmTransaction(
    signature,
    "confirmed",
  );
  if (status.value.err) {
    throw new Error(
      `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
    );
  }

  console.log("DAO squads proposal executed!");
  console.log("Transaction signature:", signature);
}

main().catch((error) => {
  console.error("Error executing DAO squads proposal:", error);
  process.exit(1);
});
