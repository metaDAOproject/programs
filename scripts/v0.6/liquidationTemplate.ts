import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { METADAO_MULTISIG_VAULT } from "@metadaoproject/programs";
import {
  claimMeteoraFees,
  memo,
  revokeMintAuthority,
  transferTokenAccountOwnership,
  withdrawAllLiquidity,
  withdrawMeteoraLiquidity,
} from "../utils/daoActions.js";
import { createFutarchyProposal } from "../utils/futarchyProposal.js";

// Template for putting a DAO's liquidation up for a futarchy vote. Once the
// proposal passes and executes, everything the DAO had in its futarchy AMM
// and Meteora positions sits in the vault's base token and USDC accounts,
// the base mint can't be minted anymore and those two accounts belong to the
// estate handler for good, to burn the DAO's own tokens and distribute the
// USDC to holders without another vote. The DAO can't take them back. The
// vault's instructions execute as one squads transaction, so if any of them
// fails none of it happens.
//
// Copy it, set the constants, and run it. The proposal is created in draft
// state - stake base tokens to it, or have the team sponsor it with
// sponsorProposal.ts, then launch it. Note that no further proposal can be
// launched once the AMM is empty.
//
// If a run fails after "Squads transaction and proposal created!", don't
// re-run it as is - that creates a second squads proposal with the same
// instructions. Set RESUME_SQUADS_PROPOSAL to the logged squads proposal,
// keep the constants as they were (the script checks the proposal holds the
// actions), and re-run to finish initializing the futarchy proposal for it.

///////////////
// Constants //
///////////////

// The DAO to liquidate
const DAO = new PublicKey("DAO_ADDRESS");

// Who owns the vault's base token and USDC accounts once the proposal
// executes - the MetaDAO operational multisig's vault by default
const ESTATE_HANDLER = METADAO_MULTISIG_VAULT;

// How far below its current worth the Meteora withdrawal may come out at
// execution. The vote takes days and the whole transaction fails if the
// withdrawal falls below its minimum, so leave room for the price to move.
const METEORA_SLIPPAGE_BPS = 10_000;

// Logged on-chain when the vault transaction executes
const MEMO = "Liquidation: ...";

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
  const daoAccount = await futarchy.getDao(DAO);

  await createFutarchyProposal({
    provider,
    futarchy,
    dao: DAO,
    payer,
    resumeSquadsProposal: RESUME_SQUADS_PROPOSAL ?? undefined,
    actions: [
      withdrawAllLiquidity(),
      withdrawMeteoraLiquidity({ slippageBps: METEORA_SLIPPAGE_BPS }),
      claimMeteoraFees(),
      revokeMintAuthority(),
      // Last, once everything is in the vault's token accounts
      transferTokenAccountOwnership({
        mint: daoAccount.baseMint,
        newOwner: ESTATE_HANDLER,
      }),
      transferTokenAccountOwnership({
        mint: daoAccount.quoteMint,
        newOwner: ESTATE_HANDLER,
      }),
      // memo(MEMO),
    ],
  });
}

main().catch((error) => {
  console.error("Error creating liquidation proposal:", error);
  process.exit(1);
});
