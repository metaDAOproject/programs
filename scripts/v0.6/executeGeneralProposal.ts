import {
  ComputeBudgetProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchy = FutarchyClient.createClient({ provider });

const PROPOSAL = new PublicKey("FUTARCHY_PROPOSAL_HERE");

async function main() {
  const proposal = await futarchy.getProposal(PROPOSAL);
  const squadsProposal = proposal.squadsProposal;

  const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
    provider.connection,
    squadsProposal,
  );

  const dao = await futarchy.getDao(proposal.dao);
  const multisigPda = dao.squadsMultisig;

  // Resolves the accounts the vault transaction loads from lookup tables, if any
  const { instruction, lookupTableAccounts } =
    await multisig.instructions.vaultTransactionExecute({
      connection: provider.connection,
      multisigPda,
      transactionIndex: BigInt(proposalAccount.transactionIndex.toString()),
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: [
      // The vault transaction may run several programs' worth of work
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
      instruction,
    ],
  }).compileToV0Message(lookupTableAccounts);
  const transaction = new VersionedTransaction(message);

  // Sign with both accounts
  transaction.sign([payer, PERMISSIONLESS_ACCOUNT]);

  const txHash = await provider.connection.sendTransaction(transaction);
  const status = await provider.connection.confirmTransaction(
    txHash,
    "confirmed",
  );
  if (status.value.err) {
    throw new Error(
      `Transaction ${txHash} failed: ${JSON.stringify(status.value.err)}`,
    );
  }

  console.log("Proposal executed successfully!");
  console.log("Transaction hash:", txHash);
  console.log(
    "Proposal index",
    BigInt(proposalAccount.transactionIndex.toString()),
  );
}

main().catch((error) => {
  console.error("Error executing proposal:", error);
  process.exit(1);
});
