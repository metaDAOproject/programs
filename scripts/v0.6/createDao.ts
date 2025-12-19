import * as anchor from "@coral-xyz/anchor";
import {
  FutarchyClient,
  getDaoAddr,
  MAINNET_USDC,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY,
  DEVNET_USDC,
  PriceMath,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

// The base token mint for the DAO (e.g., META for MetaDAO)
const BASE_MINT = new PublicKey("BASE_MINT_HERE");

// Team address for sponsored proposals (recommend setting to a multisig for flexibility)
const TEAM_ADDRESS = new PublicKey("TEAM_ADDRESS_HERE");

// Initial token price in USD (e.g., 1.5 for $1.50)
// Used to calculate TWAP initial observation
const INITIAL_TOKEN_PRICE_USD = 1;

// Pass threshold in basis points
// Constraint: 0 - 1000 (0% - 10%)
const PASS_THRESHOLD_BPS = 500;

// Team sponsored pass threshold in basis points
// Constraint: -1000 to 1000 (-10% to 10%), use -1 to disable team-sponsored proposals
const TEAM_SPONSORED_PASS_THRESHOLD_BPS = -1;

// Proposal duration in days
// Constraint: >= 1 day AND >= TWAP_START_DELAY_HOURS * 2
const PROPOSAL_DURATION_DAYS = 3;

// TWAP start delay in hours (forces TWAP calculation to start after this delay)
// Constraint: <= PROPOSAL_DURATION_DAYS * 24 / 2
const TWAP_START_DELAY_HOURS = 24;

// Amount of base tokens to stake to launch a proposal (in tokens, will be multiplied by decimals)
const BASE_TO_STAKE = 300_000;

// Minimum quote tokens (USDC) required as futarchic liquidity to create a proposal
// Anti-spam measure. Set to 0 to disable. Example: 5000 for 5000 USDC
const MIN_QUOTE_FUTARCHIC_LIQUIDITY = 0;

// Minimum base tokens required as futarchic liquidity to create a proposal
// Anti-spam measure. Set to 0 to disable. Example: 10 for 10 tokens
const MIN_BASE_FUTARCHIC_LIQUIDITY = 0;

// Initial spending limit configuration
// Allows specified members to spend quote tokens from the DAO vault without a proposal
// Set amount to 0 to disable
const INITIAL_SPENDING_LIMIT_AMOUNT_PER_MONTH = 10_000; // USDC per month
// Constraint: max 10 members
const INITIAL_SPENDING_LIMIT_MEMBERS = [
  new PublicKey("YOUR_MEMBER_ADDRESS_1"),
  // new PublicKey("YOUR_MEMBER_ADDRESS_2"),
];

// ============================================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = FutarchyClient.createClient({ provider });

const isMainnet = provider.connection.rpcEndpoint.includes("mainnet");

export const createDao = async () => {
  const quoteMint = isMainnet ? MAINNET_USDC : DEVNET_USDC;
  const squadsTreasury = isMainnet
    ? SQUADS_PROGRAM_CONFIG_TREASURY
    : DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY;

  // Verify the mint exists
  const mintInfo = await token.getMint(provider.connection, BASE_MINT);
  console.log(`Base mint found with ${mintInfo.decimals} decimals`);

  const secondsPerProposal = PROPOSAL_DURATION_DAYS * 24 * 60 * 60;
  const twapStartDelaySeconds = TWAP_START_DELAY_HOURS * 60 * 60;

  // Calculate TWAP values based on token price and decimals
  const twapInitialObservation = PriceMath.getAmmPrice(
    INITIAL_TOKEN_PRICE_USD,
    mintInfo.decimals,
    6, // USDC decimals
  );
  const twapMaxObservationChangePerUpdate = twapInitialObservation.divn(20);

  const nonce = new BN(Math.floor(Math.random() * 2 ** 50));

  const [dao] = getDaoAddr({
    nonce,
    daoCreator: payer.publicKey,
  });

  console.log("\n=== DAO Configuration ===");
  console.log(`Network: ${isMainnet ? "mainnet" : "devnet"}`);
  console.log(`Base Mint: ${BASE_MINT.toString()}`);
  console.log(`Quote Mint: ${quoteMint.toString()}`);
  console.log(`DAO Address (predicted): ${dao.toString()}`);
  console.log(`Team Address: ${TEAM_ADDRESS.toString()}`);
  console.log(`Initial Token Price: $${INITIAL_TOKEN_PRICE_USD}`);
  console.log(`TWAP Initial Observation: ${twapInitialObservation.toString()}`);
  console.log(
    `TWAP Max Change Per Update: ${twapMaxObservationChangePerUpdate.toString()}`,
  );
  console.log(
    `Pass Threshold: ${PASS_THRESHOLD_BPS} bps (${PASS_THRESHOLD_BPS / 100}%)`,
  );
  console.log(
    `Team Sponsored Threshold: ${TEAM_SPONSORED_PASS_THRESHOLD_BPS} bps`,
  );
  console.log(`Proposal Duration: ${PROPOSAL_DURATION_DAYS} days`);
  console.log(`TWAP Start Delay: ${TWAP_START_DELAY_HOURS} hours`);
  console.log(`Base to Stake: ${BASE_TO_STAKE.toLocaleString()} tokens`);
  console.log(
    `Min Quote Futarchic Liquidity: ${MIN_QUOTE_FUTARCHIC_LIQUIDITY > 0 ? `${MIN_QUOTE_FUTARCHIC_LIQUIDITY.toLocaleString()} USDC` : "None"}`,
  );
  console.log(
    `Min Base Futarchic Liquidity: ${MIN_BASE_FUTARCHIC_LIQUIDITY > 0 ? `${MIN_BASE_FUTARCHIC_LIQUIDITY.toLocaleString()} tokens` : "None"}`,
  );
  console.log(
    `Spending Limit: ${INITIAL_SPENDING_LIMIT_AMOUNT_PER_MONTH > 0 ? `${INITIAL_SPENDING_LIMIT_AMOUNT_PER_MONTH.toLocaleString()} USDC/month for ${INITIAL_SPENDING_LIMIT_MEMBERS.length} member(s)` : "Disabled"}`,
  );
  console.log("========================\n");

  console.log("Initializing DAO...");

  await futarchy
    .initializeDaoIx({
      baseMint: BASE_MINT,
      quoteMint,
      squadsProgramConfigTreasury: squadsTreasury,
      provideLiquidity: false,
      params: {
        twapInitialObservation,
        twapMaxObservationChangePerUpdate,
        twapStartDelaySeconds,
        minQuoteFutarchicLiquidity: new BN(MIN_QUOTE_FUTARCHIC_LIQUIDITY * 1e6),
        minBaseFutarchicLiquidity: new BN(
          MIN_BASE_FUTARCHIC_LIQUIDITY * 10 ** mintInfo.decimals,
        ),
        passThresholdBps: PASS_THRESHOLD_BPS,
        nonce,
        initialSpendingLimit:
          INITIAL_SPENDING_LIMIT_AMOUNT_PER_MONTH > 0
            ? {
                amountPerMonth: new BN(
                  INITIAL_SPENDING_LIMIT_AMOUNT_PER_MONTH * 1e6,
                ),
                members: INITIAL_SPENDING_LIMIT_MEMBERS,
              }
            : null,
        baseToStake: new BN(BASE_TO_STAKE * 10 ** mintInfo.decimals),
        secondsPerProposal,
        teamSponsoredPassThresholdBps: TEAM_SPONSORED_PASS_THRESHOLD_BPS,
        teamAddress: TEAM_ADDRESS,
      },
    })
    .rpc();

  console.log("\n=== DAO Created Successfully ===");
  console.log(`DAO: ${dao.toString()}`);
  console.log(`Base Mint: ${BASE_MINT.toString()}`);
  console.log(`Quote Mint: ${quoteMint.toString()}`);
  console.log("\nNext step: Run provideLiquidity.ts to add initial liquidity");
};

createDao().catch(console.error);
