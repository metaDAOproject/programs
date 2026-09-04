import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { PublicKey, TransactionMessage } from "@solana/web3.js";
import bs58 from "bs58";

// Set the DAO and the proposal its team wants to sponsor before running the script
const DAO = new PublicKey("");
const PROPOSAL = new PublicKey("");

const provider = anchor.AnchorProvider.env();
const futarchyClient = FutarchyClient.createClient({ provider });

const sponsorProposal = async () => {
  const dao = await futarchyClient.fetchDao(DAO);

  if (!dao) {
    throw new Error("DAO not found");
  }

  const proposal = await futarchyClient.fetchProposal(PROPOSAL);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (!proposal.dao.equals(DAO)) {
    throw new Error(
      `Proposal belongs to DAO ${proposal.dao.toBase58()}, not ${DAO.toBase58()}`,
    );
  }

  console.log(`Proposal: ${PROPOSAL.toBase58()}`);
  console.log(`DAO: ${DAO.toBase58()}`);
  console.log(`Team address: ${dao.teamAddress.toBase58()}`);

  const sponsorIx = await futarchyClient
    .sponsorProposalIx({
      proposal: PROPOSAL,
      dao: DAO,
      teamAddress: dao.teamAddress,
    })
    .instruction();

  const transactionMessage = new TransactionMessage({
    instructions: [sponsorIx],
    payerKey: dao.teamAddress,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
  });

  const serializedMessage = transactionMessage
    .compileToLegacyMessage()
    .serialize();

  console.log("\nTransaction message (base58):");
  console.log(bs58.encode(serializedMessage));

  console.log("\nTransaction message (base64):");
  console.log(serializedMessage.toString("base64"));
};

sponsorProposal().catch(console.error);
