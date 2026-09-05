import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { MAINNET_USDC } from "@metadaoproject/programs";
import {
  memo,
  transferToken,
  updateDao,
  withdrawLiquidity,
  withdrawMeteoraLiquidity,
} from "../utils/daoActions.js";
import { createFutarchyProposal } from "../utils/futarchyProposal.js";

// Template for putting DAO vault actions up for a futarchy vote. Copy it, set
// the constants, and compose the actions below. The proposal is created in
// draft state - stake base tokens to it, or have the team sponsor it with
// sponsorProposal.ts, then launch it. Actions the DAO itself signs (like
// removeSpendingLimit) can't go through here, since a passed proposal is
// executed permissionlessly - enqueue those with enqueueTemplate.ts instead.
//
// If a run fails after "Squads transaction and proposal created!", don't
// re-run it as is - that creates a second squads proposal with the same
// instructions. Set RESUME_SQUADS_PROPOSAL to the logged squads proposal and
// re-run to finish initializing the futarchy proposal for it.

///////////////
// Constants //
///////////////

// The DAO whose vault should execute the actions
const DAO = new PublicKey("DAO_ADDRESS");

// The squads proposal of a run that failed after creating it, to finish
// initializing the futarchy proposal for. Leave null to create a new proposal.
const RESUME_SQUADS_PROPOSAL: PublicKey | null = null;

////////////////
// Operations //
////////////////

const provider = anchor.AnchorProvider.env();

// Pays for the setup instructions and the rent of the squads and futarchy
// proposal accounts
const payer = provider.wallet["payer"];

const futarchy = FutarchyClient.createClient({ provider });

async function main() {
  await createFutarchyProposal({
    provider,
    futarchy,
    dao: DAO,
    payer,
    resumeSquadsProposal: RESUME_SQUADS_PROPOSAL ?? undefined,
    actions: [
      // Compose the actions the DAO's vault should execute, e.g.:
      //
      updateDao({
        baseToStake: new BN(1_500_000).mul(new BN(10 ** 6)),
        passThresholdBps: 300,
        teamSponsoredPassThresholdBps: -300,
        minBaseFutarchicLiquidity: new BN(1),
        minQuoteFutarchicLiquidity: new BN(1),
      }),
      //
      // withdrawLiquidity({ fractionBps: 5_000, slippageBps: 2_000 }),
      //
      // withdrawMeteoraLiquidity({ slippageBps: 500 }),
      //
      // transferToken({
      //   mint: MAINNET_USDC,
      //   recipient: new PublicKey("..."),
      //   amount: new BN(1_000).mul(new BN(10 ** 6)),
      // }),
      //
      // memo("..."),
    ],
  });
}

main().catch((error) => {
  console.error("Error creating futarchy proposal:", error);
  process.exit(1);
});
