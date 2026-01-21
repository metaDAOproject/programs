import "dotenv/config";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { getAssociatedTokenAddressSync, getMint } from "@solana/spl-token";
import { getMetadataAccountDataSerializer } from "@metaplex-foundation/mpl-token-metadata";

import {
  AutocratClient,
  AUTOCRAT_PROGRAM_ID,
  getProposalAddr,
  getMetadataAddr,
  LAUNCHPAD_PROGRAM_ID,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getRaydiumCpmmPoolVaultAddr,
} from "@metadaoproject/futarchy/v0.5";

import {
  FutarchyClient as FutarchyClientV6,
  DAMM_V2_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";

// Raydium Migration Helper program ID
const RAYDIUM_MIGRATION_HELPER_PROGRAM_ID = new PublicKey(
  "migR87BnBEkJbbDECLzRxhmNsQ44WMzhDCpCJhfPvR1",
);

// Helper functions for Meteora PDA derivation
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
  // migration_signer PDA - used to sign for token transfers in Meteora CPI
  const [migrationSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_signer"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  // position_nft_mint is seeded by our migration helper program
  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  // pool is seeded by DAMM v2 program
  const [pool] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      MAINNET_METEORA_CONFIG.toBuffer(),
      maxKey(baseMint, quoteMint),
      minKey(baseMint, quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );

  return {
    migrationSigner,
    positionNftMint,
    pool,
  };
}

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
// v5 launch addy 7DzBXBYSKhrXHPWT6mAKq394vKupaKaqLn9bK1wscpBz
// test raydium v5 - 5j4BeewbwoepQCXGsvk8nnkbi4DCXaw5XEzT9XUnzQ6
// new test-dao considering meteora split in lp
// 9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo
const V5_DAO_ADDRESS = new PublicKey(
  "9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo",
);

// V6 DAO to migrate TO (must already be initialized)
// test raydium v6 - F3APFzjG4ekCohguP7emX2pEwE3CoVQR9s8zwNYfZq4R
// New test-dao for meteora
// Cn2wML7SWX2x5mroSKp5eSd9QEkBRjccAXqQ9YWiwZNx
const V6_DAO_ADDRESS = new PublicKey(
  "Cn2wML7SWX2x5mroSKp5eSd9QEkBRjccAXqQ9YWiwZNx",
);
// =========================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// V5 clients
const autocratClient = AutocratClient.createClient({ provider });

// V6 client
const futarchyV6 = FutarchyClientV6.createClient({ provider });

async function checkMigrationStatus(
  v5VaultPda: PublicKey,
  v6VaultPda: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  baseDecimals: number,
  quoteDecimals: number,
  raydiumLpMint: PublicKey | null,
): Promise<{
  migrationDetected: boolean;
  migrationSuccessful: boolean;
  details: string[];
}> {
  const details: string[] = [];
  let migrationDetected = false;
  let migrationSuccessful = true; // Assume success, set to false if any check fails

  const baseMultiplier = Math.pow(10, baseDecimals);
  const quoteMultiplier = Math.pow(10, quoteDecimals);

  // Check 1: Mint authority - is it on V6 vault?
  const baseMintInfo = await getMint(provider.connection, baseMint);
  const currentMintAuthority = baseMintInfo.mintAuthority;

  if (currentMintAuthority?.equals(v6VaultPda)) {
    details.push("✓ Mint authority is on V6 vault");
    migrationDetected = true;
  } else if (currentMintAuthority?.equals(v5VaultPda)) {
    details.push("• Mint authority is still on V5 vault (not migrated)");
    migrationSuccessful = false;
  } else if (currentMintAuthority) {
    details.push(
      `⚠ Mint authority is on unknown address: ${currentMintAuthority.toBase58()}`,
    );
  } else {
    details.push("• No mint authority (immutable token)");
  }

  // Check 2: Metadata update authority - is it on V6 vault?
  const [metadataAddr] = getMetadataAddr(baseMint);
  try {
    const metadataAccountInfo =
      await provider.connection.getAccountInfo(metadataAddr);
    if (metadataAccountInfo) {
      const metadataSerializer = getMetadataAccountDataSerializer();
      const [metadata] = metadataSerializer.deserialize(
        metadataAccountInfo.data,
      );
      const updateAuthority = new PublicKey(metadata.updateAuthority);

      if (updateAuthority.equals(v6VaultPda)) {
        details.push("✓ Metadata update authority is on V6 vault");
        migrationDetected = true;
      } else if (updateAuthority.equals(v5VaultPda)) {
        details.push(
          "• Metadata update authority is still on V5 vault (not migrated)",
        );
        migrationSuccessful = false;
      } else {
        details.push(
          `⚠ Metadata update authority is on unknown address: ${updateAuthority.toBase58()}`,
        );
      }
    }
  } catch {
    details.push("• No metadata found");
  }

  // Check 3: V6 vault token balances (indicates successful transfer)
  const v6VaultBaseAta = getAssociatedTokenAddressSync(
    baseMint,
    v6VaultPda,
    true,
  );
  const v6VaultQuoteAta = getAssociatedTokenAddressSync(
    quoteMint,
    v6VaultPda,
    true,
  );

  try {
    const baseInfo =
      await provider.connection.getTokenAccountBalance(v6VaultBaseAta);
    const balance = BigInt(baseInfo.value.amount);
    if (balance > 0n) {
      details.push(
        `✓ V6 vault has ${(Number(balance) / baseMultiplier).toLocaleString()} base tokens`,
      );
      migrationDetected = true;
    }
  } catch {
    // No account means no tokens transferred yet
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(v6VaultQuoteAta);
    const balance = BigInt(quoteInfo.value.amount);
    if (balance > 0n) {
      details.push(
        `✓ V6 vault has ${(Number(balance) / quoteMultiplier).toLocaleString()} quote tokens`,
      );
      migrationDetected = true;
    }
  } catch {
    // No account means no tokens transferred yet
  }

  // Check 4: V5 vault is empty (indicates complete migration)
  const v5VaultBaseAta = getAssociatedTokenAddressSync(
    baseMint,
    v5VaultPda,
    true,
  );
  const v5VaultQuoteAta = getAssociatedTokenAddressSync(
    quoteMint,
    v5VaultPda,
    true,
  );

  let v5BaseBalance = 0n;
  let v5QuoteBalance = 0n;

  try {
    const baseInfo =
      await provider.connection.getTokenAccountBalance(v5VaultBaseAta);
    v5BaseBalance = BigInt(baseInfo.value.amount);
  } catch {
    // No account
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(v5VaultQuoteAta);
    v5QuoteBalance = BigInt(quoteInfo.value.amount);
  } catch {
    // No account
  }

  // Check 5: LP tokens withdrawn (Raydium-specific)
  if (raydiumLpMint) {
    const v5VaultLpAta = getAssociatedTokenAddressSync(
      raydiumLpMint,
      v5VaultPda,
      true,
    );
    try {
      const lpInfo =
        await provider.connection.getTokenAccountBalance(v5VaultLpAta);
      const lpBalance = BigInt(lpInfo.value.amount);
      if (lpBalance === 0n) {
        details.push("✓ LP tokens have been withdrawn from V5 vault");
        migrationDetected = true;
      } else if (migrationDetected) {
        details.push(
          `⚠ V5 vault still has ${lpInfo.value.uiAmountString} LP tokens`,
        );
      }
    } catch {
      // No LP account - might mean withdrawn or never had any
      if (migrationDetected) {
        details.push("✓ No LP token account in V5 vault");
      }
    }
  }

  if (migrationDetected) {
    if (v5BaseBalance > 0n) {
      details.push(
        `⚠ V5 vault still has ${(Number(v5BaseBalance) / baseMultiplier).toLocaleString()} base tokens remaining`,
      );
    }
    if (v5QuoteBalance > 0n) {
      details.push(
        `⚠ V5 vault still has ${(Number(v5QuoteBalance) / quoteMultiplier).toLocaleString()} quote tokens remaining`,
      );
    }
    if (v5BaseBalance === 0n && v5QuoteBalance === 0n) {
      details.push("✓ V5 vault is empty");
    }
  }

  // If nothing detected as migrated, it hasn't been run
  if (!migrationDetected) {
    migrationSuccessful = false;
  }

  return { migrationDetected, migrationSuccessful, details };
}

async function main() {
  console.log("=".repeat(60));
  console.log("PREVIEW: MIGRATE V5 DAO TO V6 DAO (Raydium LP)");
  console.log("=".repeat(60));
  console.log("\nThis is a dry run - no transactions will be submitted.\n");

  // Step 1: Fetch V5 DAO data
  console.log("[1] Fetching V5 DAO data...");
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
    console.log("  ✗ V6 DAO not found at", V6_DAO_ADDRESS.toBase58());
    console.log(
      "  Make sure the V6 DAO is already initialized before running migration.",
    );
    return;
  }

  // Verify mints match
  if (!v6Dao.baseMint.equals(v5Dao.baseMint)) {
    console.log("  ✗ Base mint mismatch!");
    console.log("    V5:", v5Dao.baseMint.toBase58());
    console.log("    V6:", v6Dao.baseMint.toBase58());
    return;
  }
  if (!v6Dao.quoteMint.equals(v5Dao.quoteMint)) {
    console.log("  ✗ Quote mint mismatch!");
    console.log("    V5:", v5Dao.quoteMint.toBase58());
    console.log("    V6:", v6Dao.quoteMint.toBase58());
    return;
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

  const baseMintInfo = await getMint(provider.connection, v5Dao.baseMint);
  const quoteMintInfo = await getMint(provider.connection, v5Dao.quoteMint);
  const baseDecimals = baseMintInfo.decimals;
  const quoteDecimals = quoteMintInfo.decimals;

  console.log("  Base token decimals:", baseDecimals);
  console.log("  Quote token decimals:", quoteDecimals);

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

  // Step 4: Fetch Raydium CPMM pool info and LP balance
  console.log("\n[4] Fetching Raydium CPMM pool info...");

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
  let poolExists = false;
  try {
    const lpInfo =
      await provider.connection.getTokenAccountBalance(v5VaultLpAta);
    lpBalance = BigInt(lpInfo.value.amount);
    poolExists = true;
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

  // Check if migration has already been run
  console.log("\n[4.5] Checking migration status...");
  const migrationStatus = await checkMigrationStatus(
    v5VaultPda,
    v6VaultPda,
    v5Dao.baseMint,
    v5Dao.quoteMint,
    baseDecimals,
    quoteDecimals,
    poolExists ? raydiumLpMint : null,
  );

  if (migrationStatus.migrationDetected) {
    console.log("\n" + "=".repeat(60));
    if (migrationStatus.migrationSuccessful) {
      console.log("✓ MIGRATION ALREADY COMPLETED SUCCESSFULLY");
    } else {
      console.log("⚠ MIGRATION PARTIALLY COMPLETED");
    }
    console.log("=".repeat(60));
    console.log("\nMigration status details:");
    for (const detail of migrationStatus.details) {
      console.log("  " + detail);
    }
    console.log("\n" + "=".repeat(60));

    if (migrationStatus.migrationSuccessful) {
      console.log("No further action needed - migration is complete.");
      return;
    } else {
      console.log("Migration may need manual intervention.");
      console.log("Continuing with preview to show current state...\n");
    }
  } else {
    console.log("  Migration has not been run yet.");
  }

  // Check payer's wallet balances
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
    console.log("  ⚠ Your base token account doesn't exist");
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(payerQuoteAta);
    payerQuoteBalance = BigInt(quoteInfo.value.amount);
  } catch {
    console.log("  ⚠ Your quote token account doesn't exist");
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
  const hasEnoughBase = payerBaseBalance >= BigInt(minBaseLiquidity.toString());
  const hasEnoughQuote =
    payerQuoteBalance >= BigInt(minQuoteLiquidity.toString());

  if (!hasEnoughBase) {
    const needed = (
      minBaseLiquidity.toNumber() / baseMultiplier
    ).toLocaleString();
    const have = (Number(payerBaseBalance) / baseMultiplier).toLocaleString();
    console.log(`  ✗ Insufficient base tokens! Need ${needed}, have ${have}`);
  } else {
    console.log("  ✓ Sufficient base tokens for proposal liquidity");
  }

  if (!hasEnoughQuote) {
    const needed = (
      minQuoteLiquidity.toNumber() / quoteMultiplier
    ).toLocaleString();
    const have = (Number(payerQuoteBalance) / quoteMultiplier).toLocaleString();
    console.log(`  ✗ Insufficient quote tokens! Need ${needed}, have ${have}`);
  } else {
    console.log("  ✓ Sufficient quote tokens for proposal liquidity");
  }

  // Step 5: Get vault token balances to transfer
  console.log("\n[5] Fetching V5 vault token balances...");
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

  let baseBalance = BigInt(0);
  let quoteBalance = BigInt(0);

  try {
    const baseInfo =
      await provider.connection.getTokenAccountBalance(v5VaultBaseAta);
    baseBalance = BigInt(baseInfo.value.amount);
    console.log(
      "  Vault base token balance:",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Vault base token balance: 0 (no account)");
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(v5VaultQuoteAta);
    quoteBalance = BigInt(quoteInfo.value.amount);
    console.log(
      "  Vault quote token balance:",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Vault quote token balance: 0 (no account)");
  }

  // Calculate total amounts to transfer (existing + LP withdrawal)
  const totalBaseToTransfer = baseBalance + expectedBaseFromLp;
  const totalQuoteToTransfer = quoteBalance + expectedQuoteFromLp;

  if (lpBalance > 0n) {
    console.log(
      "\n  Total base to transfer (vault + LP):",
      (Number(totalBaseToTransfer) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "  Total quote to transfer (vault + LP):",
      (Number(totalQuoteToTransfer) / quoteMultiplier).toLocaleString(),
    );
  }

  // Step 6: Check mint authority
  console.log("\n[6] Checking base mint authority...");
  const currentMintAuthority = baseMintInfo.mintAuthority;
  let canTransferMintAuthority = false;

  if (currentMintAuthority) {
    console.log("  Current mint authority:", currentMintAuthority.toBase58());
    if (currentMintAuthority.equals(v5VaultPda)) {
      console.log("  ✓ Mint authority is the V5 vault (will be transferred)");
      canTransferMintAuthority = true;
    } else {
      console.log(
        "  ⚠ Mint authority is NOT the V5 vault - cannot transfer via proposal",
      );
    }
  } else {
    console.log("  ⚠ No mint authority (token is immutable)");
  }

  // Step 7: Check metadata update authority
  console.log("\n[7] Checking metadata update authority...");
  const [metadataAddr] = getMetadataAddr(v5Dao.baseMint);
  let canTransferMetadataAuthority = false;

  try {
    const metadataAccountInfo =
      await provider.connection.getAccountInfo(metadataAddr);
    if (metadataAccountInfo) {
      const metadataSerializer = getMetadataAccountDataSerializer();
      const [metadata] = metadataSerializer.deserialize(
        metadataAccountInfo.data,
      );
      const updateAuthority = new PublicKey(metadata.updateAuthority);
      console.log("  Metadata address:", metadataAddr.toBase58());
      console.log("  Current update authority:", updateAuthority.toBase58());
      if (updateAuthority.equals(v5VaultPda)) {
        console.log(
          "  ✓ Metadata update authority is the V5 vault (will be transferred)",
        );
        canTransferMetadataAuthority = true;
      } else {
        console.log(
          "  ⚠ Metadata update authority is NOT the V5 vault - cannot transfer via proposal",
        );
      }
    } else {
      console.log("  ⚠ No metadata found for base mint");
    }
  } catch (e: any) {
    console.log("  ⚠ Could not fetch metadata:", e.message || e);
  }

  // Preview what will happen
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION PREVIEW");
  console.log("=".repeat(60));

  // Get next transaction index
  const v5MultisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      v5MultisigPda,
    );
  const currentTransactionIndex = Number(
    v5MultisigAccountInfo.transactionIndex,
  );
  const transactionIndex = currentTransactionIndex + 1;

  const [squadsProposalPda] = multisig.getProposalPda({
    multisigPda: v5MultisigPda,
    transactionIndex: BigInt(transactionIndex),
  });

  const [metaDaoProposal] = getProposalAddr(
    AUTOCRAT_PROGRAM_ID,
    squadsProposalPda,
  );

  // Get Meteora PDAs
  const meteoraPdas = getMeteoraPdas(v5Dao.baseMint, v5Dao.quoteMint);

  console.log("\nAddresses:");
  console.log("  V5 DAO:", V5_DAO_ADDRESS.toBase58());
  console.log("  V6 DAO:", V6_DAO_ADDRESS.toBase58());
  console.log("  Next Squads Proposal PDA:", squadsProposalPda.toBase58());
  console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());
  console.log("  Meteora DAMM v2 Pool:", meteoraPdas.pool.toBase58());
  console.log(
    "  Meteora Position NFT Mint:",
    meteoraPdas.positionNftMint.toBase58(),
  );

  console.log("\nMigration actions (when proposal passes):");
  if (lpBalance > 0n) {
    console.log("  1. Withdraw Raydium LP tokens:", lpBalance.toString());
    console.log(
      "     → Expected base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "     → Expected quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );

    // Calculate 90/10 split
    const baseToMeteora = Number(expectedBaseFromLp) / 10;
    const quoteToMeteora = Number(expectedQuoteFromLp) / 10;
    const baseToFutarchy = Number(expectedBaseFromLp) - baseToMeteora;
    const quoteToFutarchy = Number(expectedQuoteFromLp) - quoteToMeteora;

    console.log(
      "\n  2. Create Meteora DAMM v2 pool (10% of withdrawn tokens):",
    );
    console.log(
      "     → Base to Meteora:",
      (baseToMeteora / baseMultiplier).toLocaleString(),
    );
    console.log(
      "     → Quote to Meteora:",
      (quoteToMeteora / quoteMultiplier).toLocaleString(),
    );

    console.log(
      "\n  3. Provide liquidity to Futarchy V6 AMM (90% of withdrawn tokens):",
    );
    console.log(
      "     → Base to Futarchy:",
      (baseToFutarchy / baseMultiplier).toLocaleString(),
    );
    console.log(
      "     → Quote to Futarchy:",
      (quoteToFutarchy / quoteMultiplier).toLocaleString(),
    );

    console.log("\n  4. Transfer remaining vault balance to V6 treasury:");
    if (baseBalance > 0n) {
      console.log(
        "     → Base:",
        (Number(baseBalance) / baseMultiplier).toLocaleString(),
      );
    }
    if (quoteBalance > 0n) {
      console.log(
        "     → Quote:",
        (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
      );
    }
    if (baseBalance === 0n && quoteBalance === 0n) {
      console.log("     → No additional vault balance to transfer");
    }
  } else {
    console.log("  • No LP tokens to withdraw");
    if (totalBaseToTransfer > 0n) {
      console.log(
        "  • Transfer",
        (Number(totalBaseToTransfer) / baseMultiplier).toLocaleString(),
        "base tokens to V6 vault",
      );
    } else {
      console.log("  • No base tokens to transfer");
    }
    if (totalQuoteToTransfer > 0n) {
      console.log(
        "  • Transfer",
        (Number(totalQuoteToTransfer) / quoteMultiplier).toLocaleString(),
        "quote tokens to V6 vault",
      );
    } else {
      console.log("  • No quote tokens to transfer");
    }
  }
  if (canTransferMintAuthority) {
    console.log("\n  5. Transfer mint authority to V6 vault");
  }
  if (canTransferMetadataAuthority) {
    console.log("  6. Transfer metadata update authority to V6 vault");
  }

  console.log("\nProposal liquidity (from your wallet):");
  console.log(
    "  • Base tokens:",
    (minBaseLiquidity.toNumber() / baseMultiplier).toLocaleString(),
  );
  console.log(
    "  • Quote tokens:",
    (minQuoteLiquidity.toNumber() / quoteMultiplier).toLocaleString(),
  );

  // Ready check
  console.log("\n" + "=".repeat(60));
  const isReady = hasEnoughBase && hasEnoughQuote;
  if (isReady) {
    console.log("✓ READY TO MIGRATE");
    console.log(
      "Run the full migration script (migrateToV6Raydium.ts) when ready.",
    );
  } else {
    console.log("✗ NOT READY - Fix issues above before migrating");
  }
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
