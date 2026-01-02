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

import { FutarchyClient as FutarchyClientV6 } from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";

// will be used for Omnipair as they were the only v5 launch and as such have liquidity locked up in raydium

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
const V5_DAO_ADDRESS = new PublicKey(
  "Bc3pKPnSbSX8W2hTXbsFsybh1GeRtu3Qqpfu9ZLxg6Km",
);

// V6 DAO to migrate TO (must already be initialized)
// 3uQ1F8ZWS4yRHAxSNiYo1K8Dpb4q7WZFCCGVykdpAkm4
// the above is our v6 dao's future state
const V6_DAO_ADDRESS = new PublicKey(
  "3uQ1F8ZWS4yRHAxSNiYo1K8Dpb4q7WZFCCGVykdpAkm4",
);
// =========================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// V5 clients
const autocratClient = AutocratClient.createClient({ provider });

// V6 client
const futarchyV6 = FutarchyClientV6.createClient({ provider });

async function main() {
  console.log("=".repeat(60));
  console.log("PREVIEW: MIGRATE V5 DAO TO V6 DAO");
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

  // Calculate totals
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
  if (lpBalance > 0n) {
    console.log("  • Withdraw Raydium LP tokens:", lpBalance.toString());
    console.log(
      "    → Expected base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    → Expected quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );
  }
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
