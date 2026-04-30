import { PublicKey, Transaction } from "@solana/web3.js";
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

  const vaultTxExecuteIx = multisig.instructions.vaultTransactionExecute({
    connection: provider.connection,
    multisigPda,
    transactionIndex: BigInt(proposalAccount.transactionIndex.toString()),
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  // Add both instructions to create the proposal
  const vaultTxExecuteIxResolved = await vaultTxExecuteIx;
  const tx = new Transaction().add(vaultTxExecuteIxResolved.instruction);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;

  // Sign with both accounts
  tx.sign(payer, PERMISSIONLESS_ACCOUNT);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("USDC transfer proposal executed successfully!");
  console.log("Transaction hash:", txHash);
  console.log(
    "Proposal index",
    BigInt(proposalAccount.transactionIndex.toString()),
  );
}

main().catch((error) => {
  console.error("Error creating transfer:", error);
  process.exit(1);
});
