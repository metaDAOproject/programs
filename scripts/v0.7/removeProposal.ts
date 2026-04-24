import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/futarchy/futarchy/v0.6";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
} from "@metadaoproject/futarchy";
import { PublicKey } from "@solana/web3.js";

// Set the proposal address before running the script
const proposal = new PublicKey("");

const provider = anchor.AnchorProvider.env();

// Payer MUST be the admin signer - tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  [],
);

export const removeProposal = async () => {
  // Fetch the proposal to get the DAO address
  const proposalAccount = await futarchy.getProposal(proposal);

  console.log(`Removing proposal at address: ${proposal.toBase58()}`);
  console.log(`DAO: ${proposalAccount.dao.toBase58()}`);
  console.log(`Current state: ${JSON.stringify(proposalAccount.state)}`);

  const tx = await futarchy.futarchy.methods
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
