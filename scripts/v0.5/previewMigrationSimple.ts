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
} from "@metadaoproject/futarchy/v0.5";

import { FutarchyClient as FutarchyClientV6 } from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
const V5_DAO_ADDRESS = new PublicKey(
  "9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo",
);

// V6 DAO to migrate TO (must already be initialized)
// 6jQt41FAvrBhz9hErkHaDuQbKd9bKCLAn4sdED3MRg8y
// the above is the test dao v6
const V6_DAO_ADDRESS = new PublicKey(
  "6jQt41FAvrBhz9hErkHaDuQbKd9bKCLAn4sdED3MRg8y",
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
  console.log("PREVIEW: MIGRATE V5 DAO TO V6 DAO (Simple)");
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

  // Check if migration has already been run
  console.log("\n[3.5] Checking migration status...");
  const migrationStatus = await checkMigrationStatus(
    v5VaultPda,
    v6VaultPda,
    v5Dao.baseMint,
    v5Dao.quoteMint,
    baseDecimals,
    quoteDecimals,
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

  // Step 4: Get vault token balances to transfer
  console.log("\n[4] Fetching V5 vault token balances...");
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

  // Step 5: Check mint authority
  console.log("\n[5] Checking base mint authority...");
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

  // Step 6: Check metadata update authority
  console.log("\n[6] Checking metadata update authority...");
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

  console.log("\nAddresses:");
  console.log("  V5 DAO:", V5_DAO_ADDRESS.toBase58());
  console.log("  V6 DAO:", V6_DAO_ADDRESS.toBase58());
  console.log("  Next Squads Proposal PDA:", squadsProposalPda.toBase58());
  console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());

  console.log("\nMigration actions (when proposal passes):");
  if (baseBalance > 0n) {
    console.log(
      "  • Transfer",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
      "base tokens to V6 vault",
    );
  } else {
    console.log("  • No base tokens to transfer");
  }
  if (quoteBalance > 0n) {
    console.log(
      "  • Transfer",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
      "quote tokens to V6 vault",
    );
  } else {
    console.log("  • No quote tokens to transfer");
  }
  if (canTransferMintAuthority) {
    console.log("  • Transfer mint authority to V6 vault");
  }
  if (canTransferMetadataAuthority) {
    console.log("  • Transfer metadata update authority to V6 vault");
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
    console.log("Run the full migration script when ready.");
  } else {
    console.log("✗ NOT READY - Fix issues above before migrating");
  }
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
