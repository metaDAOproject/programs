import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  getAssociatedTokenAddressSync, 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { 
  LAUNCHPAD_PROGRAM_ID,
  AutocratClient,
  AUTOCRAT_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.4";

import {
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  TOKEN_PROGRAM_2022_ID,
} from "../consts.js";
import {
  getPoolStateAddr,
  getCpmmAuthorityAddr,
  getCpmmPoolVaultAddr,
} from "../utils/pda.js";

import RedeemIDL from "../../target/idl/redeem.json" with { type: "json" };

// Configuration
const CONFIG = {
  isDevnet: true,
  daoAddress: "4i91WezpKTwDgikuVKL9G2VV9ySSWHx4uXMgHUAqKYuP", // change this depending on the DAO
  
  migrationDestination: "MIGRATION_ADDRESS_HERE", // Where to send the tokens
  proposalDescriptionUrl: "https://example.com/migration-proposal",
};

// Update this once we deploy, can pull from idl directly
const REDEEM_PROGRAM_ID = new PublicKey("2yybFizjrwdYEKktHtvpXr9qSSpKLd3NzZE7p4batVAf");

function getDaoTreasuryAddr(autocratProgramId: PublicKey, dao: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("dao_treasury"), dao.toBuffer()],
    autocratProgramId
  );
}

async function createUnwindAndMigrationProposal() {
  const provider = AnchorProvider.env();
  const payer = provider.wallet["payer"];
  const connection = provider.connection;
  const autocratClient = AutocratClient.createClient({ provider });

  const daoKey = new PublicKey(CONFIG.daoAddress);
  const dao = await autocratClient.getDao(daoKey);
  const migrator = new PublicKey(CONFIG.migrationDestination);

  const [daoTreasury, treasuryBump] = getDaoTreasuryAddr(AUTOCRAT_PROGRAM_ID, daoKey);
  const [poolState] = getPoolStateAddr(LAUNCHPAD_PROGRAM_ID, daoKey);

  console.log("Creating unwind and migration proposal...");
  console.log("Wallet:", payer.publicKey.toString());

  const USDC = dao.usdcMint;
  const baseMint = dao.tokenMint;

  // === STEP 1: Initialize Raydium SDK to get pool info ===
  const raydium = await Raydium.load({
    connection,
    owner: payer.publicKey,
    cluster: CONFIG.isDevnet ? 'devnet' : 'mainnet',
    disableFeatureCheck: true,
    blockhashCommitment: 'finalized',
  });

  console.log("\n=== Addresses ===");
  console.log("DAO:", daoKey.toString());
  console.log("DAO Treasury:", daoTreasury.toString());
  console.log("Treasury Bump:", treasuryBump);
  console.log("Migration Destination:", migrator.toString());
  console.log("Pool State:", poolState.toString());

  // === STEP 2: Fetch pool info from Raydium ===
  console.log("\n=== Fetching Pool Info ===");
  
  const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolState.toString());
  
  if (!poolData) {
    throw new Error("Pool not found");
  }

  const lpMint = new PublicKey(poolData.poolKeys.mintLp);
  console.log("LP Mint:", lpMint.toString());

  // Get LP token balance
  const treasuryLpAccount = getAssociatedTokenAddressSync(lpMint, daoTreasury, true);
  const lpBalance = await connection.getTokenAccountBalance(treasuryLpAccount);
  
  console.log(`LP tokens in treasury: ${lpBalance.value.uiAmount}`);
  
  if (new BN(lpBalance.value.amount).isZero()) {
    throw new Error("No LP tokens found in treasury");
  }

  // === STEP 3: Build the unwind and migrate instruction ===
  console.log("\n=== Building Unwind and Migrate Instruction ===");
  
  // Initialize the unwind migrator program
  const redeemProgram = new Program(
    RedeemIDL as any,
    REDEEM_PROGRAM_ID,
    provider
  );

  // Get all necessary accounts
  const cpSwapProgramId = CONFIG.isDevnet 
    ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID 
    : RAYDIUM_CP_SWAP_PROGRAM_ID;
    
  const [poolAuthority] = getCpmmAuthorityAddr(cpSwapProgramId);
  const [poolBaseVault] = getCpmmPoolVaultAddr(poolState, baseMint, cpSwapProgramId);
  const [poolQuoteVault] = getCpmmPoolVaultAddr(poolState, USDC, cpSwapProgramId);

  // Treasury token accounts
  const treasuryBaseAccount = getAssociatedTokenAddressSync(baseMint, daoTreasury, true);
  const treasuryQuoteAccount = getAssociatedTokenAddressSync(USDC, daoTreasury, true);

  // Destination token accounts
  const migratorVault = getAssociatedTokenAddressSync(USDC, migrator, true);

  // Build the single instruction that does everything
  const redeemIx = await redeemProgram.methods
    .redeem()
    .accounts({
      dao: daoKey,
      treasury: daoTreasury,
      poolState,
      poolAuthority,
      lpMint,
      baseMint,  
      quoteMint: USDC,  
      lpAccount: treasuryLpAccount,
      baseAccount: treasuryBaseAccount,  
      quoteAccount: treasuryQuoteAccount,  
      poolBaseVault,  
      poolQuoteVault,  
      migratorVault,  
      lamportReceiver: payer.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      autocratProgram: AUTOCRAT_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      cpSwapProgram: cpSwapProgramId,  
      tokenProgram2022: TOKEN_PROGRAM_2022_ID,
      memoProgram: MEMO_PROGRAM_ID,
      launchpadProgram: LAUNCHPAD_PROGRAM_ID,  
    })
    .instruction();

  // Convert instruction to the format expected by initializeProposal
  const proposalInstruction = {
    programId: redeemIx.programId,
    accounts: redeemIx.keys.map(key => ({
      pubkey: key.pubkey,
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: redeemIx.data,
  };

  // === STEP 4: Create futarchy proposal ===
  console.log("\n=== Creating Proposal ===");
  
  // Get minimum liquidity requirements
  const minBaseLiquidity = dao.minBaseFutarchicLiquidity;
  const minQuoteLiquidity = dao.minQuoteFutarchicLiquidity;
  
  console.log("Min Base Liquidity Required:", minBaseLiquidity.toString());
  console.log("Min Quote Liquidity Required:", minQuoteLiquidity.toString());

  // Ensure proposer has tokens for the proposal
  const proposerBaseAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    baseMint,
    payer.publicKey
  );
  
  const proposerQuoteAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    USDC,
    payer.publicKey
  );
  
  const baseBalance = proposerBaseAccount.amount;
  const usdcBalance = proposerQuoteAccount.amount;
  console.log("Proposer Base balance:", baseBalance.toString());
  console.log("Proposer USDC balance:", usdcBalance.toString());
  
  if (
    baseBalance < BigInt(minBaseLiquidity.toString()) ||
    usdcBalance < BigInt(minQuoteLiquidity.toString())
  ) {
    console.log("Insufficient balance for proposal creation");
    console.log("Required Base Tokens:", minBaseLiquidity.toString());
    console.log("Required USDC:", minQuoteLiquidity.toString());
    return;
  }

  // Create the proposal with the unwind and migrate instruction
  try {
    const proposal = await autocratClient.initializeProposal(
      daoKey,
      CONFIG.proposalDescriptionUrl,
      proposalInstruction,
      minBaseLiquidity,
      minQuoteLiquidity
    );
    
    console.log("\n Unwind and Migration proposal created!");
    console.log("Proposal address:", proposal.toString());
  } catch (error) {
    console.error("Proposal creation failed:", error);
    throw error;
  }
}

// Run the script
createUnwindAndMigrationProposal()
  .then(() => {
    console.log("\n Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n Script failed:", error);
    process.exit(1);
  });