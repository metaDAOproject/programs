import "dotenv/config";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  ComputeBudgetProgram,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
  Keypair,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as multisig from "@sqds/multisig";
import {
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getMetadataAccountDataSerializer,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  publicKey as UmiPublicKey,
  createNoopSigner,
} from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { sha256 } from "@noble/hashes/sha256";

import {
  AutocratClient,
  AmmClient,
  ConditionalVaultClient,
  AUTOCRAT_PROGRAM_ID,
  PERMISSIONLESS_ACCOUNT,
  getProposalAddr,
  getMetadataAddr,
  InstructionUtils,
  LAUNCHPAD_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getRaydiumCpmmPoolVaultAddr,
} from "@metadaoproject/futarchy/v0.5";

import {
  FutarchyClient as FutarchyClientV6,
  DAMM_V2_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";
import {
  sendBundle,
  getTipAccounts,
  getTipFloor,
  getBundleStatuses,
} from "../utils/bundles.js";
import { IDL as RaydiumMigrationHelperIDL } from "../../target/types/raydium_migration_helper.js";

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
const V5_DAO_ADDRESS = new PublicKey(
  "9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo",
);

// V6 DAO to migrate TO (must already be initialized)
const V6_DAO_ADDRESS = new PublicKey(
  "Cn2wML7SWX2x5mroSKp5eSd9QEkBRjccAXqQ9YWiwZNx",
);

// Set to true to create full futarchy proposal with Jito bundle
// Set to false to only create Squads proposal (for testing/simulation)
const FULL_PROPOSAL = false;

// Program IDs
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);
const RAYDIUM_MIGRATION_HELPER_PROGRAM_ID = new PublicKey(
  "migR87BnBEkJbbDECLzRxhmNsQ44WMzhDCpCJhfPvR1",
);
const MIGRATION_METEORA_CONFIG = new PublicKey(
  "5FSCTMuJcrsahe8nB7P3LooAYv5U5GNgBPY8JYjWKfHr",
);
// =========================

// ===== UTILS =====
function maxKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBuffer = left.toBuffer();
  const rightBuffer = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBuffer[i] > rightBuffer[i]) return leftBuffer;
    if (leftBuffer[i] < rightBuffer[i]) return rightBuffer;
  }
  return leftBuffer;
}

function minKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBuffer = left.toBuffer();
  const rightBuffer = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBuffer[i] < rightBuffer[i]) return leftBuffer;
    if (leftBuffer[i] > rightBuffer[i]) return rightBuffer;
  }
  return leftBuffer;
}

function getMeteoraPdas(baseMint: PublicKey, quoteMint: PublicKey) {
  const [migrationSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_signer"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("damm_pool_creator_authority")],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  const [pool] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      MIGRATION_METEORA_CONFIG.toBuffer(),
      maxKey(baseMint, quoteMint),
      minKey(baseMint, quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );

  const [positionNftAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [tokenAVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), baseMint.toBuffer(), pool.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [tokenBVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), quoteMint.toBuffer(), pool.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_authority")],
    DAMM_V2_PROGRAM_ID,
  );

  const [dammV2EventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    DAMM_V2_PROGRAM_ID,
  );

  const migrationSignerBaseAta = getAssociatedTokenAddressSync(
    baseMint,
    migrationSigner,
    true,
  );
  const migrationSignerQuoteAta = getAssociatedTokenAddressSync(
    quoteMint,
    migrationSigner,
    true,
  );

  return {
    migrationSigner,
    migrationSignerBaseAta,
    migrationSignerQuoteAta,
    positionNftMint,
    poolCreatorAuthority,
    pool,
    positionNftAccount,
    position,
    tokenAVault,
    tokenBVault,
    poolAuthority,
    dammV2EventAuthority,
  };
}
// =================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// V5 clients
const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

// V6 client
const futarchyV6 = FutarchyClientV6.createClient({ provider });

async function main() {
  if (!process.env.JITO_AUTH_TOKEN) {
    console.log(
      "Warning: No Jito auth token provided, results may be unreliable",
    );
  }

  console.log("=".repeat(60));
  console.log("MIGRATE V5 DAO TO V6 DAO (Raydium LP)");
  console.log("=".repeat(60));
  console.log(
    `Mode: ${FULL_PROPOSAL ? "FULL PROPOSAL (Squads + Futarchy markets)" : "SQUADS ONLY (for simulation)"}`,
  );
  console.log("=".repeat(60));

  // Step 1: Fetch V5 DAO data
  console.log("\n[1] Fetching V5 DAO data...");
  const v5Dao = await autocratClient.getDao(V5_DAO_ADDRESS);
  const { multisigPda: v5MultisigPda, vaultPda: v5VaultPda } =
    await getSquadsPdasFromDao(V5_DAO_ADDRESS);

  console.log("  V5 DAO Address:", V5_DAO_ADDRESS.toBase58());
  console.log("  Base Mint:", v5Dao.baseMint.toBase58());
  console.log("  Quote Mint:", v5Dao.quoteMint.toBase58());
  console.log("  V5 Squads Multisig:", v5MultisigPda.toBase58());
  console.log("  V5 Vault PDA:", v5VaultPda.toBase58());

  // Step 2: Fetch and verify V6 DAO
  console.log("\n[2] Fetching V6 DAO data...");
  const v6Dao = await futarchyV6.fetchDao(V6_DAO_ADDRESS);
  if (!v6Dao) {
    throw new Error(
      `V6 DAO not found at ${V6_DAO_ADDRESS.toBase58()}. Make sure it's already initialized.`,
    );
  }

  // Verify mints match
  if (!v6Dao.baseMint.equals(v5Dao.baseMint)) {
    throw new Error(
      `Base mint mismatch! V5: ${v5Dao.baseMint.toBase58()}, V6: ${v6Dao.baseMint.toBase58()}`,
    );
  }
  if (!v6Dao.quoteMint.equals(v5Dao.quoteMint)) {
    throw new Error(
      `Quote mint mismatch! V5: ${v5Dao.quoteMint.toBase58()}, V6: ${v6Dao.quoteMint.toBase58()}`,
    );
  }

  const v6MultisigPda = multisig.getMultisigPda({
    createKey: V6_DAO_ADDRESS,
  })[0];
  const v6VaultPda = multisig.getVaultPda({
    multisigPda: v6MultisigPda,
    index: 0,
  })[0];

  console.log("  V6 DAO Address:", V6_DAO_ADDRESS.toBase58());
  console.log("  V6 Squads Multisig:", v6MultisigPda.toBase58());
  console.log("  V6 Vault PDA:", v6VaultPda.toBase58());
  console.log("  ✓ Base mint matches V5 DAO");
  console.log("  ✓ Quote mint matches V5 DAO");

  // Step 3: Fetch token decimals and liquidity requirements
  console.log("\n[3] Fetching token decimals and liquidity requirements...");

  // Get mint decimals
  const baseMintInfo = await getMint(provider.connection, v5Dao.baseMint);
  const quoteMintInfo = await getMint(provider.connection, v5Dao.quoteMint);
  const baseDecimals = baseMintInfo.decimals;
  const quoteDecimals = quoteMintInfo.decimals;

  console.log("  Base token decimals:", baseDecimals);
  console.log("  Quote token decimals:", quoteDecimals);

  // Get min liquidity requirements from DAO
  const minBaseLiquidity = v5Dao.minBaseFutarchicLiquidity;
  const minQuoteLiquidity = v5Dao.minQuoteFutarchicLiquidity;

  const baseMultiplier = Math.pow(10, baseDecimals);
  const quoteMultiplier = Math.pow(10, quoteDecimals);

  console.log(
    "  Min base liquidity required:",
    (minBaseLiquidity.toNumber() / baseMultiplier).toLocaleString(),
  );
  console.log(
    "  Min quote liquidity required:",
    (minQuoteLiquidity.toNumber() / quoteMultiplier).toLocaleString(),
  );

  // Check payer's wallet balances (only needed for full proposal)
  if (FULL_PROPOSAL) {
    const payerBaseAta = getAssociatedTokenAddressSync(
      v5Dao.baseMint,
      payer.publicKey,
      true,
    );
    const payerQuoteAta = getAssociatedTokenAddressSync(
      v5Dao.quoteMint,
      payer.publicKey,
      true,
    );

    let payerBaseBalance = BigInt(0);
    let payerQuoteBalance = BigInt(0);

    try {
      const baseInfo =
        await provider.connection.getTokenAccountBalance(payerBaseAta);
      payerBaseBalance = BigInt(baseInfo.value.amount);
    } catch {
      console.log("  ⚠ Base token account doesn't exist");
    }

    try {
      const quoteInfo =
        await provider.connection.getTokenAccountBalance(payerQuoteAta);
      payerQuoteBalance = BigInt(quoteInfo.value.amount);
    } catch {
      console.log("  ⚠ Quote token account doesn't exist");
    }

    console.log(
      "  Your base token balance:",
      (Number(payerBaseBalance) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "  Your quote token balance:",
      (Number(payerQuoteBalance) / quoteMultiplier).toLocaleString(),
    );

    // Check if payer has enough tokens
    if (payerBaseBalance < BigInt(minBaseLiquidity.toString())) {
      const needed = (
        minBaseLiquidity.toNumber() / baseMultiplier
      ).toLocaleString();
      const have = (Number(payerBaseBalance) / baseMultiplier).toLocaleString();
      throw new Error(`Insufficient base tokens! Need ${needed}, have ${have}`);
    }
    if (payerQuoteBalance < BigInt(minQuoteLiquidity.toString())) {
      const needed = (
        minQuoteLiquidity.toNumber() / quoteMultiplier
      ).toLocaleString();
      const have = (
        Number(payerQuoteBalance) / quoteMultiplier
      ).toLocaleString();
      throw new Error(
        `Insufficient quote tokens! Need ${needed}, have ${have}`,
      );
    }

    console.log("  ✓ Wallet has sufficient tokens for proposal liquidity");
  } else {
    console.log("  (Skipping wallet balance check - Squads only mode)");
  }

  // Step 4: Get vault token balances to transfer
  console.log("\n[4] Fetching V5 vault token balances...");
  // Create token accounts for vaults and DAO AMM using idempotent instructions
  const v5VaultBaseAta = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    v5VaultPda,
    true,
  );
  const v5VaultQuoteAta = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    v5VaultPda,
    true,
  );
  const v6VaultBaseAta = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    v6VaultPda,
    true,
  );
  const v6VaultQuoteAta = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    v6VaultPda,
    true,
  );
  const ammBaseVault = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    V6_DAO_ADDRESS,
    true,
  );
  const ammQuoteVault = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    V6_DAO_ADDRESS,
    true,
  );

  // Get migration_signer PDA and its ATAs (needed for Meteora CPI)
  const meteoraPdasForAtas = getMeteoraPdas(v5Dao.baseMint, v5Dao.quoteMint);
  const migrationSignerBaseAta = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    meteoraPdasForAtas.migrationSigner,
    true,
  );
  const migrationSignerQuoteAta = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    meteoraPdasForAtas.migrationSigner,
    true,
  );

  const createAtasIx = [
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      v5VaultBaseAta,
      v5VaultPda,
      v5Dao.baseMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      v6VaultBaseAta,
      v6VaultPda,
      v5Dao.baseMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      v5VaultQuoteAta,
      v5VaultPda,
      v5Dao.quoteMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      v6VaultQuoteAta,
      v6VaultPda,
      v5Dao.quoteMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ammBaseVault,
      V6_DAO_ADDRESS,
      v5Dao.baseMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ammQuoteVault,
      V6_DAO_ADDRESS,
      v5Dao.quoteMint,
    ),
    // Migration signer ATAs (needed for Meteora CPI)
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      migrationSignerBaseAta,
      meteoraPdasForAtas.migrationSigner,
      v5Dao.baseMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      migrationSignerQuoteAta,
      meteoraPdasForAtas.migrationSigner,
      v5Dao.quoteMint,
    ),
  ];

  const createAtasTx = new Transaction().add(...createAtasIx);
  createAtasTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  createAtasTx.feePayer = payer.publicKey;
  const signedCreateAtasTx =
    await provider.wallet.signTransaction(createAtasTx);
  const createAtasSig = await provider.connection.sendRawTransaction(
    signedCreateAtasTx.serialize(),
  );
  await provider.connection.confirmTransaction(createAtasSig);
  console.log("  ✓ Token accounts created:", createAtasSig);

  // Fund migration_signer PDA with SOL for Meteora pool creation rent
  // Meteora creates multiple accounts: pool, vaults, position NFT, etc. (~8.63M lamports needed)
  const migrationSignerRent = 0.02 * LAMPORTS_PER_SOL; // 0.02 SOL for rent
  const fundMigrationSignerIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: meteoraPdasForAtas.migrationSigner,
    lamports: migrationSignerRent,
  });
  const fundMigrationSignerTx = new Transaction().add(fundMigrationSignerIx);
  fundMigrationSignerTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  fundMigrationSignerTx.feePayer = payer.publicKey;
  const signedFundMigrationSignerTx = await provider.wallet.signTransaction(
    fundMigrationSignerTx,
  );
  const fundMigrationSignerSig = await provider.connection.sendRawTransaction(
    signedFundMigrationSignerTx.serialize(),
  );
  await provider.connection.confirmTransaction(fundMigrationSignerSig);
  console.log(
    `  ✓ Migration signer funded with ${migrationSignerRent / LAMPORTS_PER_SOL} SOL:`,
    fundMigrationSignerSig,
  );

  let baseBalance = BigInt(0);
  let quoteBalance = BigInt(0);

  try {
    const baseInfo =
      await provider.connection.getTokenAccountBalance(v5VaultBaseAta);
    baseBalance = BigInt(baseInfo.value.amount);
    console.log(
      "  Base token balance:",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Base token balance: 0 (no account)");
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(v5VaultQuoteAta);
    quoteBalance = BigInt(quoteInfo.value.amount);
    console.log(
      "  Quote token balance:",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Quote token balance: 0 (no account)");
  }

  // Step 4.5: Fetch Raydium CPMM pool info and LP balance
  console.log("\n[4.5] Fetching Raydium CPMM pool info...");

  const [raydiumPoolState] = getLiquidityPoolAddr(
    LAUNCHPAD_PROGRAM_ID,
    V5_DAO_ADDRESS,
  );
  const [raydiumLpMint] = getRaydiumCpmmLpMintAddr(raydiumPoolState, false);
  const v5VaultLpAta = getAssociatedTokenAddressSync(
    raydiumLpMint,
    v5VaultPda,
    true,
  );

  console.log("  Raydium Pool State:", raydiumPoolState.toBase58());
  console.log("  Raydium LP Mint:", raydiumLpMint.toBase58());

  let lpBalance = BigInt(0);
  try {
    const lpInfo =
      await provider.connection.getTokenAccountBalance(v5VaultLpAta);
    lpBalance = BigInt(lpInfo.value.amount);
    console.log("  Vault LP token balance:", lpInfo.value.uiAmountString);
  } catch {
    console.log(
      "  ⚠ Vault LP token balance: 0 (no account or pool doesn't exist)",
    );
  }

  // Token ordering for Raydium: smaller pubkey is token0
  const isBaseToken0 =
    v5Dao.baseMint.toBuffer().compare(v5Dao.quoteMint.toBuffer()) < 0;
  const token0Mint = isBaseToken0 ? v5Dao.baseMint : v5Dao.quoteMint;
  const token1Mint = isBaseToken0 ? v5Dao.quoteMint : v5Dao.baseMint;

  const [poolToken0Vault] = getRaydiumCpmmPoolVaultAddr(
    raydiumPoolState,
    token0Mint,
    false,
  );
  const [poolToken1Vault] = getRaydiumCpmmPoolVaultAddr(
    raydiumPoolState,
    token1Mint,
    false,
  );

  console.log(
    "  Token ordering:",
    isBaseToken0 ? "base=token0, quote=token1" : "quote=token0, base=token1",
  );

  // CRITICAL: Verify all pool addresses exist on mainnet
  console.log("\n=== VERIFYING RAYDIUM POOL ON MAINNET ===");
  console.log("Pool Token0 Vault:", poolToken0Vault.toBase58());
  console.log("Pool Token1 Vault:", poolToken1Vault.toBase58());
  console.log("V5 Vault LP ATA:", v5VaultLpAta.toBase58());

  const [
    poolStateInfo,
    lpMintInfo,
    v5VaultLpAtaInfo,
    token0VaultInfo,
    token1VaultInfo,
  ] = await Promise.all([
    provider.connection.getAccountInfo(raydiumPoolState),
    provider.connection.getAccountInfo(raydiumLpMint),
    provider.connection.getAccountInfo(v5VaultLpAta),
    provider.connection.getAccountInfo(poolToken0Vault),
    provider.connection.getAccountInfo(poolToken1Vault),
  ]);

  console.log("\nAccount existence check:");
  console.log("  ✓ Pool State exists:", poolStateInfo !== null);
  console.log("  ✓ LP Mint exists:", lpMintInfo !== null);
  console.log("  ✓ V5 Vault LP ATA exists:", v5VaultLpAtaInfo !== null);
  console.log("  ✓ Pool Token0 Vault exists:", token0VaultInfo !== null);
  console.log("  ✓ Pool Token1 Vault exists:", token1VaultInfo !== null);

  if (!poolStateInfo || !lpMintInfo) {
    throw new Error(
      "❌ CRITICAL: Raydium pool does not exist on mainnet!\n" +
        `Pool State (${raydiumPoolState.toBase58()}): ${poolStateInfo ? "EXISTS" : "NOT FOUND"}\n` +
        `LP Mint (${raydiumLpMint.toBase58()}): ${lpMintInfo ? "EXISTS" : "NOT FOUND"}\n` +
        "The launchpad may not have created a Raydium pool, or this DAO uses a different liquidity mechanism.",
    );
  }

  if (!token0VaultInfo || !token1VaultInfo) {
    throw new Error(
      "❌ CRITICAL: Pool vaults do not exist on mainnet!\n" +
        `Token0 Vault (${poolToken0Vault.toBase58()}): ${token0VaultInfo ? "EXISTS" : "NOT FOUND"}\n` +
        `Token1 Vault (${poolToken1Vault.toBase58()}): ${token1VaultInfo ? "EXISTS" : "NOT FOUND"}`,
    );
  }

  console.log("\n✅ All Raydium pool accounts verified on mainnet!");

  // Calculate expected withdrawal amounts from LP
  let expectedBaseFromLp = BigInt(0);
  let expectedQuoteFromLp = BigInt(0);

  if (lpBalance > 0n) {
    try {
      // Fetch pool vault balances and LP supply to calculate proportional withdrawal
      const [token0VaultBalance, token1VaultBalance, lpMintInfo] =
        await Promise.all([
          provider.connection.getTokenAccountBalance(poolToken0Vault),
          provider.connection.getTokenAccountBalance(poolToken1Vault),
          getMint(provider.connection, raydiumLpMint),
        ]);

      const poolToken0Amount = BigInt(token0VaultBalance.value.amount);
      const poolToken1Amount = BigInt(token1VaultBalance.value.amount);
      const lpSupply = lpMintInfo.supply;

      // Calculate proportional share: (lpBalance / lpSupply) * poolAmount
      const token0Share = (lpBalance * poolToken0Amount) / lpSupply;
      const token1Share = (lpBalance * poolToken1Amount) / lpSupply;

      // Assign based on token ordering
      if (isBaseToken0) {
        expectedBaseFromLp = token0Share;
        expectedQuoteFromLp = token1Share;
      } else {
        expectedBaseFromLp = token1Share;
        expectedQuoteFromLp = token0Share;
      }

      console.log(
        "  Expected base from LP withdrawal:",
        (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
      );
      console.log(
        "  Expected quote from LP withdrawal:",
        (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
      );
    } catch (e) {
      console.log("  ⚠ Could not calculate LP withdrawal amounts:", e);
    }
  }

  // Step 5: Check mint authority
  console.log("\n[5] Checking base mint authority...");
  const currentMintAuthority = baseMintInfo.mintAuthority;

  if (currentMintAuthority) {
    console.log("  Current mint authority:", currentMintAuthority.toBase58());
    if (currentMintAuthority.equals(v5VaultPda)) {
      console.log("  ✓ Mint authority is the V5 vault (will be transferred)");
    } else {
      console.log(
        "  ⚠ Mint authority is NOT the V5 vault - cannot transfer via proposal",
      );
    }
  } else {
    console.log("  ⚠ No mint authority (token is immutable)");
  }

  let canTransferMetadataAuthority = false;

  // Step 7: Build vault transaction instructions
  console.log("\n[7] Building vault transaction instructions...");

  const vaultInstructions: anchor.web3.TransactionInstruction[] = [];

  // Add compute budget instructions to vault transaction for Squads Explorer simulation
  // These need to be included in the vault instructions for proper simulation
  vaultInstructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
  );
  vaultInstructions.push(
    ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
  );

  // 7a. Withdraw LP and provide liquidity to V6 AMM atomically (if any LP)
  if (lpBalance > 0n) {
    const helperProgram = new anchor.Program(
      RaydiumMigrationHelperIDL,
      RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
      provider,
    );

    // Get V6 futarchy AMM accounts
    // Note: position_authority is v6VaultPda - the V6 vault will own the AMM position
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        V6_DAO_ADDRESS.toBuffer(),
        v6VaultPda.toBuffer(), // position_authority (the V6 vault owns the AMM position)
      ],
      futarchyV6.getProgramId(),
    );

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      futarchyV6.getProgramId(),
    );

    // Reuse Meteora DAMM v2 PDAs for the new pool creation (derived earlier for ATA creation)
    const meteoraPdas = meteoraPdasForAtas;
    console.log("  Meteora Pool PDA:", meteoraPdas.pool.toBase58());
    console.log(
      "  Meteora Position NFT Mint:",
      meteoraPdas.positionNftMint.toBase58(),
    );

    const withdrawAndProvideLiquidityIx = await helperProgram.methods
      .withdrawAndProvideLiquidity(
        new BN(lpBalance.toString()),
        new BN(0), // min_raydium_amount_0 - no slippage protection for governance
        new BN(0), // min_raydium_amount_1
        new BN(0), // min_futarchy_liquidity
      )
      .accounts({
        vaultAuthority: v5VaultPda,
        // Raydium withdrawal accounts
        poolState: raydiumPoolState,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        lpMint: raydiumLpMint,
        vaultLpToken: v5VaultLpAta,
        vaultToken0: isBaseToken0 ? v5VaultBaseAta : v5VaultQuoteAta,
        vaultToken1: isBaseToken0 ? v5VaultQuoteAta : v5VaultBaseAta,
        poolToken0Vault: poolToken0Vault,
        poolToken1Vault: poolToken1Vault,
        // V6 Futarchy AMM accounts
        dao: V6_DAO_ADDRESS,
        baseMint: v5Dao.baseMint,
        quoteMint: v5Dao.quoteMint,
        ammPosition: ammPosition,
        ammBaseVault: ammBaseVault,
        ammQuoteVault: ammQuoteVault,
        v6VaultBaseAta: v6VaultBaseAta,
        v6VaultQuoteAta: v6VaultQuoteAta,
        v6VaultPda: v6VaultPda,
        eventAuthority: eventAuthority,
        // Migration signer accounts (PDA that holds tokens during Meteora CPI)
        migrationSigner: meteoraPdas.migrationSigner,
        migrationSignerBaseAta: meteoraPdas.migrationSignerBaseAta,
        migrationSignerQuoteAta: meteoraPdas.migrationSignerQuoteAta,
        // Meteora DAMM v2 accounts
        meteoraAccounts: {
          dammV2Program: DAMM_V2_PROGRAM_ID,
          config: MIGRATION_METEORA_CONFIG,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          positionNftAccount: meteoraPdas.positionNftAccount,
          pool: meteoraPdas.pool,
          position: meteoraPdas.position,
          positionNftMint: meteoraPdas.positionNftMint,
          baseMint: v5Dao.baseMint,
          quoteMint: v5Dao.quoteMint,
          tokenAVault: meteoraPdas.tokenAVault,
          tokenBVault: meteoraPdas.tokenBVault,
          poolCreatorAuthority: meteoraPdas.poolCreatorAuthority,
          poolAuthority: meteoraPdas.poolAuthority,
          dammV2EventAuthority: meteoraPdas.dammV2EventAuthority,
        },
        // Programs
        raydiumProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        futarchyProgram: futarchyV6.getProgramId(),
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        memoProgram: MEMO_PROGRAM_ID,
      })
      .instruction();

    vaultInstructions.push(withdrawAndProvideLiquidityIx);
    console.log(
      "  Added: Withdraw LP → 90% to Futarchy AMM, 10% to Meteora DAMM v2",
    );
    console.log(
      "  Instruction accounts:",
      withdrawAndProvideLiquidityIx.keys.length,
    );
    console.log("    LP tokens to withdraw:", lpBalance.toString());
    console.log("    → Expected withdrawal from Raydium:");
    console.log(
      "      Base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "      Quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );
    console.log("    → 90% to Futarchy V6 AMM:");
    console.log(
      "      Base:",
      ((Number(expectedBaseFromLp) * 0.9) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "      Quote:",
      ((Number(expectedQuoteFromLp) * 0.9) / quoteMultiplier).toLocaleString(),
    );
    console.log("    → 10% to Meteora DAMM v2 pool:");
    console.log(
      "      Base:",
      ((Number(expectedBaseFromLp) * 0.1) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "      Quote:",
      ((Number(expectedQuoteFromLp) * 0.1) / quoteMultiplier).toLocaleString(),
    );
    console.log("    → Treasury (existing balance, transferred to V6):");
    console.log(
      "      Base:",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "      Quote:",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
    );
  }

  // Calculate total amounts for logging (existing + LP withdrawal)
  const totalBaseToTransfer = baseBalance + expectedBaseFromLp;
  const totalQuoteToTransfer = quoteBalance + expectedQuoteFromLp;

  // 7d. Transfer mint authority from V5 vault to V6 vault
  if (currentMintAuthority && currentMintAuthority.equals(v5VaultPda)) {
    vaultInstructions.push(
      createSetAuthorityInstruction(
        v5Dao.baseMint,
        v5VaultPda,
        AuthorityType.MintTokens,
        v6VaultPda,
      ),
    );
    console.log("  Added: Transfer mint authority to V6 vault");
  }

  // 7e. Transfer metadata update authority from V5 vault to V6 vault
  const [metadataAddr] = getMetadataAddr(v5Dao.baseMint);
  try {
    const metadataAccountInfo =
      await provider.connection.getAccountInfo(metadataAddr);
    if (metadataAccountInfo) {
      const metadataSerializer = getMetadataAccountDataSerializer();
      const [metadata] = metadataSerializer.deserialize(
        metadataAccountInfo.data,
      );
      const updateAuthority = new PublicKey(metadata.updateAuthority);
      if (updateAuthority.equals(v5VaultPda)) {
        // Use UMI to build the metadata update instruction
        const umi = createUmi(provider.connection.rpcEndpoint);
        // Create a noop signer for the vault - actual signing happens in Squads execution
        const vaultSigner = createNoopSigner(
          UmiPublicKey(v5VaultPda.toBase58()),
        );
        const umiUpdateIxs = updateMetadataAccountV2(umi, {
          metadata: UmiPublicKey(metadataAddr.toBase58()),
          updateAuthority: vaultSigner, // Current authority (will be signer in vault tx)
          newUpdateAuthority: UmiPublicKey(v6VaultPda.toBase58()),
        }).getInstructions();

        for (const umiIx of umiUpdateIxs) {
          vaultInstructions.push(toWeb3JsInstruction(umiIx));
        }
        canTransferMetadataAuthority = true;
        console.log("  Added: Transfer metadata update authority to V6 vault");
      }
    }
  } catch (e: any) {
    console.log(
      "  ⚠ Could not add metadata authority transfer:",
      e.message || e,
    );
  }

  console.log("Total vault instructions:", vaultInstructions.length);

  // Step 7.5: Detailed instruction debugging
  console.log("\n[7.5] Detailed instruction analysis...");
  const uniqueProgramIds = new Set<string>();
  for (let i = 0; i < vaultInstructions.length; i++) {
    const ix = vaultInstructions[i];
    uniqueProgramIds.add(ix.programId.toBase58());
    console.log(`\n  Instruction ${i + 1}/${vaultInstructions.length}:`);
    console.log(`    Program ID: ${ix.programId.toBase58()}`);
    console.log(`    Data length: ${ix.data.length} bytes`);
    console.log(`    Accounts (${ix.keys.length}):`);
    ix.keys.forEach((key, idx) => {
      console.log(
        `      [${idx}] ${key.pubkey.toBase58()} ${key.isSigner ? "(signer)" : ""} ${key.isWritable ? "(writable)" : "(readonly)"}`,
      );
    });
  }

  // Verify all program IDs exist on-chain
  console.log("\n  Verifying program IDs exist on-chain...");
  for (const programId of uniqueProgramIds) {
    const programInfo = await provider.connection.getAccountInfo(
      new PublicKey(programId),
    );
    if (!programInfo) {
      throw new Error(`❌ Program ID ${programId} does not exist on-chain!`);
    }
    if (!programInfo.executable) {
      throw new Error(`❌ Program ID ${programId} is not executable!`);
    }
    console.log(`    ✓ ${programId} (executable)`);
  }

  // Create lookup table to compress transaction (mirrors test's createLookupTableForTransaction)
  const tempTx = new Transaction().add(...vaultInstructions);

  // use a different authority for the lookup table to avoid conflicts
  const lookupAuthority = Keypair.generate();
  const slot = await provider.connection.getSlot();

  const [createTableIx, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: lookupAuthority.publicKey,
      payer: payer.publicKey,
      recentSlot: slot - 1,
    });

  // Extract all unique accounts from the transaction (mirrors test exactly)
  const accountsToAdd = tempTx.instructions.map((instruction) =>
    instruction.keys.map((key) => key.pubkey),
  );
  // Deduplicate by base58 string, not object identity
  const accountStrings = new Set<string>();
  const uniqueAccounts: PublicKey[] = [];
  for (const account of accountsToAdd.flat()) {
    const accountStr = account.toBase58();
    if (!accountStrings.has(accountStr)) {
      accountStrings.add(accountStr);
      uniqueAccounts.push(account);
    }
  }
  console.log("uniqueAccounts", uniqueAccounts.length);

  // Create the lookup table
  const createLutTx = new Transaction().add(createTableIx);
  createLutTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  createLutTx.feePayer = payer.publicKey;
  createLutTx.partialSign(lookupAuthority);
  const signedCreateLutTx = await provider.wallet.signTransaction(createLutTx);
  const createLutSig = await provider.connection.sendRawTransaction(
    signedCreateLutTx.serialize(),
  );
  await provider.connection.confirmTransaction(createLutSig);
  console.log("  ✓ LUT created:", lookupTableAddress.toBase58());

  // Wait for LUT to be available (increased wait time for proper activation)
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Extend the lookup table with all unique accounts
  const addressesPerExtend = 20;
  for (let i = 0; i < uniqueAccounts.length; i += addressesPerExtend) {
    const batch = uniqueAccounts.slice(i, i + addressesPerExtend);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: lookupAuthority.publicKey,
      payer: payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: batch,
    });

    const extendLutTx = new Transaction().add(extendTableIx);
    extendLutTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    extendLutTx.feePayer = payer.publicKey;
    extendLutTx.partialSign(lookupAuthority);
    const signedExtendLutTx =
      await provider.wallet.signTransaction(extendLutTx);
    const extendLutSig = await provider.connection.sendRawTransaction(
      signedExtendLutTx.serialize(),
    );
    await provider.connection.confirmTransaction(extendLutSig);
    console.log(
      `  ✓ Extended LUT batch ${Math.floor(i / addressesPerExtend) + 1}/${Math.ceil(uniqueAccounts.length / addressesPerExtend)}`,
    );

    // Wait for extension to be available (increased wait time)
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Wait for final extension to be available
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Fetch the raw account data and deserialize it manually (like the test does)
  // This ensures the AddressLookupTableAccount is constructed correctly for the Squads SDK
  const rawLutAccount =
    await provider.connection.getAccountInfo(lookupTableAddress);
  if (!rawLutAccount) {
    throw new Error("Failed to fetch lookup table account");
  }

  const migrationLut = new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(rawLutAccount.data),
  });

  // Verify LUT is activated (not deactivating)
  if (
    migrationLut.state.deactivationSlot !== undefined &&
    migrationLut.state.deactivationSlot < BigInt(2 ** 32 - 1)
  ) {
    throw new Error(
      `LUT is deactivating at slot ${migrationLut.state.deactivationSlot}!`,
    );
  }

  console.log(
    "Migration LUT created with",
    migrationLut.state.addresses.length,
    "addresses",
  );
  console.log("LUT last extended slot:", migrationLut.state.lastExtendedSlot);
  console.log("LUT authority:", migrationLut.state.authority?.toBase58());

  // Verify LUT contents
  console.log("\n=== VERIFYING LUT CONTENTS ===");
  for (let i = 0; i < migrationLut.state.addresses.length; i++) {
    console.log(`  [${i}]:`, migrationLut.state.addresses[i].toBase58());
  }

  // Create transaction message (don't compile to V0 - pass plain message + LUT separately to Squads)
  const transactionMessage = new TransactionMessage({
    payerKey: v5VaultPda,
    recentBlockhash: "",
    instructions: vaultInstructions,
  });

  // Verify all instruction accounts are in the LUT
  console.log("\n=== VERIFYING ALL ACCOUNTS IN LUT ===");
  const lutAddresses = migrationLut.state.addresses.map((a) => a.toBase58());
  let missingAccounts = 0;
  for (const ix of vaultInstructions) {
    for (const key of ix.keys) {
      const keyStr = key.pubkey.toBase58();
      if (!lutAddresses.includes(keyStr)) {
        console.warn(`  ⚠️  Account ${keyStr} NOT in LUT!`);
        missingAccounts++;
      }
    }
  }
  if (missingAccounts === 0) {
    console.log("  ✓ All instruction accounts are in the LUT");
  } else {
    throw new Error(`${missingAccounts} accounts are missing from the LUT!`);
  }

  // Get transaction index
  const v5MultisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    provider.connection,
    v5MultisigPda,
  );
  const transactionIndex = BigInt(
    Number(v5MultisigAccount.transactionIndex) + 1,
  );

  // Create vault transaction with plain message + LUT accounts
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: v5MultisigPda,
    transactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: transactionMessage,
    addressLookupTableAccounts: [migrationLut],
  });

  console.log("\n📊 VaultTransactionCreate instruction:");
  console.log("  Accounts:", vaultTxCreateIx.keys.length);
  console.log("  Data size:", vaultTxCreateIx.data.length, "bytes");

  // Create proposal (no approve yet - that happens through autocrat)
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: v5MultisigPda,
    transactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  const [squadsProposalPda] = multisig.getProposalPda({
    multisigPda: v5MultisigPda,
    transactionIndex,
  });

  // Create Squads proposal using V0 VersionedTransaction with LUT for compression
  const { blockhash } = await provider.connection.getLatestBlockhash();

  const squadsMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [vaultTxCreateIx, proposalCreateIx],
  }).compileToV0Message([migrationLut]);

  const squadsTx = new VersionedTransaction(squadsMessage);

  const squadsTxSize = squadsTx.serialize().length;
  console.log("\n📊 Squads proposal transaction (create vault tx + proposal):");
  console.log("  Size:", squadsTxSize, "bytes (limit: 1232)");
  if (squadsTxSize > 1232) {
    console.log("  ❌ OVER LIMIT by", squadsTxSize - 1232, "bytes");
  }

  // Sign with PERMISSIONLESS_ACCOUNT first
  squadsTx.sign([PERMISSIONLESS_ACCOUNT]);
  // Then sign with wallet
  const signedSquadsTx = await provider.wallet.signTransaction(squadsTx);
  const squadsSig = await provider.connection.sendRawTransaction(
    signedSquadsTx.serialize(),
    {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    },
  );
  console.log("  Squads tx signature:", squadsSig);
  await provider.connection.confirmTransaction(squadsSig);

  console.log("Squads proposal created");

  // Wait a bit for the transaction to be fully confirmed
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const [metaDaoProposal] = getProposalAddr(
    AUTOCRAT_PROGRAM_ID,
    squadsProposalPda,
  );

  if (FULL_PROPOSAL) {
    // Step 8: Build V5 futarchy proposal market transactions (5 txs max for Jito bundle)
    console.log("\n[8] Building V5 futarchy proposal markets...");
    console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());

    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      question,
    } = autocratClient.getProposalPdas(
      metaDaoProposal,
      v5Dao.baseMint,
      v5Dao.quoteMint,
      V5_DAO_ADDRESS,
    );

    // Build 5 transactions for Jito bundle
    const txns: Transaction[] = [];

    // Transaction 1: Initialize question
    const questionTx = await vaultClient
      .initializeQuestionIx(
        sha256(`Will ${metaDaoProposal} pass?/FAIL/PASS`),
        metaDaoProposal,
        2,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 }),
      ])
      .transaction();
    txns.push(questionTx);

    // Transaction 2: Initialize vaults and AMMs
    const vaultsTx = await vaultClient
      .initializeVaultIx(question, v5Dao.baseMint, 2)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 420_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          vaultClient.initializeVaultIx(question, v5Dao.quoteMint, 2),
          ammClient.initializeAmmIx(
            passBaseMint,
            passQuoteMint,
            v5Dao.twapStartDelaySlots,
            v5Dao.twapInitialObservation,
            v5Dao.twapMaxObservationChangePerUpdate,
          ),
          ammClient.initializeAmmIx(
            failBaseMint,
            failQuoteMint,
            v5Dao.twapStartDelaySlots,
            v5Dao.twapInitialObservation,
            v5Dao.twapMaxObservationChangePerUpdate,
          ),
        ),
      )
      .transaction();
    txns.push(vaultsTx);

    // Transaction 3: Split tokens
    const splitTokensTx = await vaultClient
      .splitTokensIx(question, baseVault, v5Dao.baseMint, minBaseLiquidity, 2)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 220_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          vaultClient.splitTokensIx(
            question,
            quoteVault,
            v5Dao.quoteMint,
            minQuoteLiquidity,
            2,
          ),
        ),
      )
      .transaction();
    txns.push(splitTokensTx);

    // Transaction 4: Add liquidity to AMMs
    const addLiquidityTx = await ammClient
      .addLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        minQuoteLiquidity,
        minBaseLiquidity,
        new BN(0),
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 170_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          ammClient.addLiquidityIx(
            failAmm,
            failBaseMint,
            failQuoteMint,
            minQuoteLiquidity,
            minBaseLiquidity,
            new BN(0),
          ),
        ),
      )
      .transaction();
    txns.push(addLiquidityTx);

    // Transaction 5: Initialize proposal
    const lpTokens = minQuoteLiquidity;
    const proposalTx = await autocratClient
      .initializeProposalIx(
        "Migrate DAO from v5 to v6 (Raydium LP)",
        squadsProposalPda,
        V5_DAO_ADDRESS,
        v5Dao.baseMint,
        v5Dao.quoteMint,
        lpTokens,
        lpTokens,
        question,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .transaction();
    txns.push(proposalTx);

    console.log("  Total transactions to bundle:", txns.length);

    // Step 9: Bundle and send futarchy txs with Jito
    console.log("\n[9] Bundling and sending futarchy txs with Jito...");

    const signedTxns = await prepareBundle(txns);
    const bundle = await sendBundle(signedTxns);

    console.log("\n" + "=".repeat(60));
    console.log("BUNDLE SUBMITTED");
    console.log("=".repeat(60));
    console.log("Bundle ID:", bundle.result);

    // Wait a moment and check status
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const bundleStatus = await getBundleStatuses(bundle.result);
    console.log("Bundle status:", JSON.stringify(bundleStatus, null, 2));
  } else {
    console.log("\n[8] Skipping futarchy markets (Squads only mode)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPLETE");
  console.log("=".repeat(60));

  console.log("\nSUMMARY:");
  console.log("  V5 DAO:", V5_DAO_ADDRESS.toBase58());
  console.log("  V6 DAO:", V6_DAO_ADDRESS.toBase58());
  console.log(
    "\n  *** SQUADS PROPOSAL PDA:",
    squadsProposalPda.toBase58(),
    "***",
  );
  console.log("  Squads Multisig:", v5MultisigPda.toBase58());
  console.log("  Transaction Index:", transactionIndex);
  console.log("  Address Lookup Table:", lookupTableAddress.toBase58());
  if (FULL_PROPOSAL) {
    console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());
  }
  console.log("\nMIGRATION ACTIONS (when proposal passes):");
  if (lpBalance > 0n) {
    console.log("  - Withdraw Raydium LP tokens:", lpBalance.toString());
    console.log(
      "    → Expected base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    → Expected quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );
    console.log("  - Create Meteora DAMM v2 pool with 10% of withdrawn tokens");
    console.log(
      "    → Base to Meteora:",
      ((Number(expectedBaseFromLp) * 0.1) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    → Quote to Meteora:",
      ((Number(expectedQuoteFromLp) * 0.1) / quoteMultiplier).toLocaleString(),
    );
    console.log(
      "  - Provide 90% of withdrawn tokens as liquidity to Futarchy V6 AMM",
    );
    console.log(
      "    → Base to Futarchy:",
      ((Number(expectedBaseFromLp) * 0.9) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    → Quote to Futarchy:",
      ((Number(expectedQuoteFromLp) * 0.9) / quoteMultiplier).toLocaleString(),
    );
  }
  if (totalBaseToTransfer > 0n) {
    console.log(
      "  - Transfer",
      (Number(totalBaseToTransfer) / baseMultiplier).toLocaleString(),
      "base tokens (treasury balance) to V6 vault",
    );
  }
  if (totalQuoteToTransfer > 0n) {
    console.log(
      "  - Transfer",
      (Number(totalQuoteToTransfer) / quoteMultiplier).toLocaleString(),
      "quote tokens (treasury balance) to V6 vault",
    );
  }
  if (currentMintAuthority && currentMintAuthority.equals(v5VaultPda)) {
    console.log("  - Transfer mint authority to V6 vault");
  }
  if (canTransferMetadataAuthority) {
    console.log("  - Transfer metadata update authority to V6 vault");
  }
  console.log(
    "\nNOTE: The V6 DAO must already be initialized before running this script.",
  );
  console.log(
    "      The vault transaction only executes if the proposal passes.",
  );
  console.log("\nIMPORTANT - EXECUTION:");
  console.log(
    "      When executing this proposal, you MUST use a V0 transaction with the",
  );
  console.log(
    "      Address Lookup Table above to stay under the 1232 byte transaction limit.",
  );
  console.log("      The execute transaction should:");
  console.log(
    "      1. Add ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })",
  );
  console.log(
    "      2. Add ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 })",
  );
  console.log("      3. Add vaultTransactionExecute instruction");
  console.log(
    "      4. Use TransactionMessage.compileToV0Message([lookupTableAccount])",
  );
  console.log(
    "      5. Create VersionedTransaction and sign with required signers",
  );
  if (!FULL_PROPOSAL) {
    console.log(
      "\n  ⚠ SQUADS ONLY MODE: Go simulate the proposal in Squads before running with FULL_PROPOSAL=true",
    );
  }
}

async function prepareBundle(
  transactions: Transaction[],
): Promise<Transaction[]> {
  console.log("  Preparing bundle with", transactions.length, "transactions");

  const tipAccounts = await getTipAccounts();
  const tipFloor = await getTipFloor();
  const tipAccount =
    tipAccounts[Math.floor(Math.random() * tipAccounts.length)];

  console.log(
    "  Tip floor:",
    Math.round(tipFloor * LAMPORTS_PER_SOL),
    "lamports",
  );
  console.log("  Tip account:", tipAccount);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(tipAccount),
    lamports: Math.round(tipFloor * LAMPORTS_PER_SOL),
  });

  const { blockhash } = await provider.connection.getLatestBlockhash();

  for (const transaction of transactions) {
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
  }

  // Add tip to last transaction
  const lastTransaction = transactions[transactions.length - 1];
  lastTransaction.add(transferInstruction);

  // Sign all transactions with payer
  const signedTxns = await provider.wallet.signAllTransactions([
    ...transactions,
  ]);

  console.log("  Transactions signed");
  return signedTxns;
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
