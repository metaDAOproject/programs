import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ProposalInstruction,
} from "@metadaoproject/futarchy/v0.4";
import { homedir } from "os";
import { join } from "path";
import { input } from "@inquirer/prompts";

import dotenv from "dotenv";
import { BN } from "bn.js";

dotenv.config();

const rpcUrl = await input({
  message: "Enter your RPC URL:",
  default: process.env.RPC_URL,
});

const walletPath = await input({
  message: "Enter the path (relative to home directory) to your wallet file",
  default: join(homedir(), process.env.WALLET_PATH),
});
process.env.ANCHOR_WALLET = walletPath;
const provider = anchor.AnchorProvider.local(rpcUrl, {
  commitment: "confirmed",
});
const payer = provider.wallet["payer"];

const autocratClient: AutocratClient = AutocratClient.createClient({
  provider,
});

const daoAddr = new PublicKey(
  await input({
    message: "Enter the DAO address",
    default: process.env.DAO_ADDRESS,
  })
);

const descriptionUrl = await input({
  message: "Enter the description URL for the proposal",
  default: process.env.PROPOSAL_DESCRIPTION_URL,
});

const memo = await input({
  message: "Enter the memo for the proposal instruction",
  default: process.env.PROPOSAL_INSTRUCTION_MEMO,
});

async function main() {
  const proposalInstruction: ProposalInstruction = {
    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
    accounts: [],
    data: Buffer.from(memo, "utf8"),
  };

  const createdProposal = await autocratClient.initializeProposal(
    daoAddr,
    descriptionUrl,
    proposalInstruction,
    new BN(1_000_000_000),
    new BN(100_000_000)
  );

  console.log("Proposal created:", createdProposal.toBase58());
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
