import * as anchor from "@coral-xyz/anchor";
import {
  CONDITIONAL_VAULT_PROGRAM_ID,
  FUTARCHY_PROGRAM_ID,
  FutarchyClient,
} from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";

// Set the proposal address before running the script
const proposal = new PublicKey("");

const provider = anchor.AnchorProvider.env();

// Payer MUST be the admin signer - tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  [],
);

export const removeProposal = async () => {
  // Fetch the proposal to get the DAO address
  const proposalAccount = await futarchy.getProposal(proposal);

  console.log(`Removing proposal at address: ${proposal.toBase58()}`);
  console.log(`DAO: ${proposalAccount.dao.toBase58()}`);
  console.log(`Current state: ${JSON.stringify(proposalAccount.state)}`);

  const tx = await futarchy.autocrat.methods
    .adminRemoveProposal()
    .accounts({
      proposal,
      dao: proposalAccount.dao,
      admin: payer.publicKey,
    })
    .rpc();

  console.log(`Proposal removed successfully. Signature: ${tx}`);
};

removeProposal().catch(console.error);
