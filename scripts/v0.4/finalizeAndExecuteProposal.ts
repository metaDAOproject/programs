import * as anchor from "@coral-xyz/anchor";
import { AmmClient, AutocratClient } from "@metadaoproject/futarchy/v0.4";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();

const autocratClient = AutocratClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

const proposalKey = new PublicKey("Fj5Khdvi4yFzTBsKxXNHw6TTeQwoSRB5DwUWb2qBodks");

async function main() {
  let proposal = await autocratClient.getProposal(proposalKey);
  if(!proposal) {
    console.log('proposal not found');
    return;
  }

  if(proposal.state.pending !== undefined) {
    console.log('proposal is pending attempting finalization');

    try {
      const crankPassAmm = await ammClient.crankThatTwap(proposal.passAmm);
      console.log('cranked pass amm', crankPassAmm);
      const crankFailAmm = await ammClient.crankThatTwap(proposal.failAmm);
      console.log('cranked fail amm', crankFailAmm);
    } catch (error) {
      console.log(error);
    }

    try {
      const tx = await autocratClient.finalizeProposal(proposalKey);
      console.log('finalized proposal', tx);
    } catch (error) {
      console.log(error);
    }
    // Refetch proposal to get the latest state
    proposal = await autocratClient.getProposal(proposalKey);
  } else {
    if(proposal.state.passed === undefined) {
      console.log('proposal not passed nothing to execute');
      return;
    }
  }

  try {
    const tx = await autocratClient.executeProposal(proposalKey);
    console.log('executed proposal', tx);
  } catch (error) {
    console.log(error);
  }
}

main();