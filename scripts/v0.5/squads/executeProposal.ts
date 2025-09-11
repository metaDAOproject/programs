import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";
import { getSquadsPdasFromDao } from "../utils/squads.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("");
const PROPOSAL_PDA = new PublicKey(
  "HDyg2gbibGfDf672KN9MU38Z5dnNVaSiTsVQw33WnY5Q"
);

async function main() {
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  const proposalAccountInfo =
    await multisig.accounts.Proposal.fromAccountAddress(
      provider.connection,
      PROPOSAL_PDA
    );

  const proposalTransactionIndex = Number(proposalAccountInfo.transactionIndex);
  console.log(
    "Proposal transaction index:",
    proposalTransactionIndex.toString()
  );

  console.log("Vault address:", vaultPda.toBase58());

  const proposalApproveIx = multisig.instructions.proposalApprove({
    multisigPda,
    transactionIndex: BigInt(proposalTransactionIndex.toString()),
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  const vaultTxExecuteIx = multisig.instructions.vaultTransactionExecute({
    connection: provider.connection,
    multisigPda,
    transactionIndex: BigInt(proposalTransactionIndex.toString()),
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  // Add both instructions to create the proposal
  const vaultTxExecuteIxResolved = await vaultTxExecuteIx;
  const tx = new Transaction().add(
    proposalApproveIx,
    vaultTxExecuteIxResolved.instruction
  );
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
  console.log("Proposal index:", proposalTransactionIndex.toString());
}

main().catch((error) => {
  console.error("Error creating transfer:", error);
  process.exit(1);
});
