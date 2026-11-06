import * as anchor from "@anchor-lang/core";
import { AutocratClient } from "@metadaoproject/programs/autocrat/v0.3";

const { PublicKey } = anchor.web3;

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

// const PROPOSAL_NUMBER = 3;
const proposal = new PublicKey("Dssb1oTTqKjWJTe8QVrStFXxcMZfd7LTSpTRbuHuNdnW");

async function main() {
  // const proposals = await autocratProgram.account.proposal.all();
  // const proposal = proposals.find(
  //   (proposal) => proposal.account.number == PROPOSAL_NUMBER
  // );
  await autocratClient.finalizeProposal(proposal);
}

main();
