import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/";
import { getSquadsPdasFromDao } from "../../utils/squads.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("");
const PROPOSAL_PDA = new PublicKey("");

async function main() {
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  const proposalAccountInfo =
    await multisig.accounts.Proposal.fromAccountAddress(
      provider.connection,
      PROPOSAL_PDA,
    );

  const proposalTransactionIndex = Number(proposalAccountInfo.transactionIndex);
  console.log(
    "Squads proposal transaction index:",
    proposalTransactionIndex.toString(),
  );

  console.log("Vault address:", vaultPda.toBase58());

  const vaultTxExecuteIx = multisig.instructions.vaultTransactionExecute({
    connection: provider.connection,
    multisigPda,
    transactionIndex: BigInt(proposalTransactionIndex.toString()),
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

  console.log("Transaction hash:", txHash);
  console.log("Squads proposal index:", proposalTransactionIndex.toString());
}

main().catch((error) => {
  console.error("Error executing Squads proposal:", error);
  process.exit(1);
});
