import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchyClient = FutarchyClient.createClient({ provider });

const PROPOSAL = new PublicKey("FUTARCHY_PROPOSAL_HERE");

const finalizeProposal = async () => {
  const proposal = await futarchyClient.fetchProposal(PROPOSAL);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const dao = await futarchyClient.fetchDao(proposal.dao);

  if (!dao) {
    throw new Error("DAO not found");
  }

  // Do a final spot swap crank before finalizing
  const spotSwapIx = await futarchyClient
    .spotSwapIx({
      dao: proposal.dao,
      baseMint: dao.baseMint,
      swapType: "buy",
      inputAmount: new BN(101),
    })
    .instruction();

  // Create finalize instruction
  const finalizeIx = await futarchyClient
    .finalizeProposalIxV2({
      squadsProposal: proposal.squadsProposal,
      dao: proposal.dao,
      baseMint: dao.baseMint,
    })
    .instruction();

  // Build and send transaction
  const tx = new Transaction().add(spotSwapIx, finalizeIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log(`Finalized proposal ${PROPOSAL.toBase58()}`);
  console.log(`Transaction: ${txHash}`);
};

finalizeProposal().catch(console.error);
