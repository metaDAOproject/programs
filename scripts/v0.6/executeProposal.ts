import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/futarchy/v0.6";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchy = FutarchyClient.createClient({ provider });

const PROPOSAL = new PublicKey("FUTARCHY_PROPOSAL_HERE");

const executeSpendingLimit = async () => {
  const proposal = await futarchy.getProposal(PROPOSAL);
  const squadsProposal = proposal.squadsProposal;

  const proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
    provider.connection,
    squadsProposal,
  );

  const dao = await futarchy.getDao(proposal.dao);
  const multisigPda = dao.squadsMultisig;

  const [vaultTransactionPda] = await multisig.getTransactionPda({
    multisigPda,
    index: BigInt(proposalAccount.transactionIndex.toString()),
  });

  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      provider.connection,
      vaultTransactionPda,
    );

  // Get remaining accounts from the vault transaction
  const remainingAccounts = vaultTransaction.message.accountKeys.map((key) => ({
    pubkey: key,
    isWritable: true,
    isSigner: false,
  }));

  const executeIx = await futarchy.autocrat.methods
    .executeSpendingLimitChange()
    .accounts({
      proposal: PROPOSAL,
      dao: proposal.dao,
      squadsProposal: squadsProposal,
      squadsMultisig: multisigPda,
      squadsMultisigProgram: multisig.PROGRAM_ID,
      vaultTransaction: vaultTransactionPda,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();

  const tx = new Transaction().add(executeIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log(`Transaction: ${txHash}`);
};

executeSpendingLimit().catch(console.error);
