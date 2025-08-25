import { 
  AmmClient, 
  AUTOCRAT_PROGRAM_ID, 
  AutocratClient, 
  ConditionalVaultClient,
  CONDITIONAL_VAULT_PROGRAM_ID,
  getConditionalTokenMintAddr 
} from "@metadaoproject/futarchy/v0.4";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

const DAO_KEY = new PublicKey("DT5R38eyHSbn5RnFNiDtK1UdJmcYKLsDCToNBJyz575h");

async function main() {
  console.log("User:", payer.publicKey.toBase58());
  console.log("========================================\n");

  const dao = await autocratClient.getDao(DAO_KEY);

  const amm1Key = new PublicKey("732fxJAr9sN6WWJ947KyVt7RUVzhCpmAoC4fSfuJMjda");
  const amm2Key = new PublicKey("2zRgRnDmrBHS3GhkQZmJqhbfGu2iczRorRd8Z4oYEGby");

  const baseVaultKey = new PublicKey("B9CLxZd7ef9Te3aYZnSNyHupDwkPo1XkThrn86z4f32V");
  const quoteVaultKey = new PublicKey("Fa8cRqS2pGSt6vTbwnq6ycJSdcyBLuYMDaT72FMqZK5E");

  const amm1 = await ammClient.getAmm(amm1Key);
  const amm2 = await ammClient.getAmm(amm2Key);

  const baseVault = await vaultClient.fetchVault(baseVaultKey);
  const quoteVault = await vaultClient.fetchVault(quoteVaultKey);

  // Get conditional token mint addresses
  const [passBaseMint] = getConditionalTokenMintAddr(CONDITIONAL_VAULT_PROGRAM_ID, baseVaultKey, 0);
  const [failBaseMint] = getConditionalTokenMintAddr(CONDITIONAL_VAULT_PROGRAM_ID, baseVaultKey, 1);
  const [passQuoteMint] = getConditionalTokenMintAddr(CONDITIONAL_VAULT_PROGRAM_ID, quoteVaultKey, 0);
  const [failQuoteMint] = getConditionalTokenMintAddr(CONDITIONAL_VAULT_PROGRAM_ID, quoteVaultKey, 1);

  // Step 1: Remove liquidity from AMMs if any exists
  console.log("STEP 1: Checking and removing liquidity from AMMs");
  console.log("--------------------------------------------------");
  
  try {
    const passLpTokenAccount = getAssociatedTokenAddressSync(amm1.lpMint, payer.publicKey, true);
    const failLpTokenAccount = getAssociatedTokenAddressSync(amm2.lpMint, payer.publicKey, true);
    
    const passLpAmount = await provider.connection.getTokenAccountBalance(passLpTokenAccount);
    const failLpAmount = await provider.connection.getTokenAccountBalance(failLpTokenAccount);

    console.log(`Pass AMM LP Balance: ${passLpAmount.value.uiAmountString || '0'}`);
    console.log(`Fail AMM LP Balance: ${failLpAmount.value.uiAmountString || '0'}`);

    if (Number(passLpAmount.value.amount) > 0) {
      console.log("Removing liquidity from Pass AMM...");
      const withdrawLP = await ammClient.removeLiquidityIx(
        amm1Key, 
        amm1.baseMint, 
        amm1.quoteMint, 
        new BN(passLpAmount.value.amount.toString()), 
        new BN(0), 
        new BN(0)
      ).rpc();
      console.log(`✓ Pass AMM liquidity removed. Tx: ${withdrawLP}`);
    } else {
      console.log("⚠ No liquidity in Pass AMM to remove");
    }

    if (Number(failLpAmount.value.amount) > 0) {
      console.log("Removing liquidity from Fail AMM...");
      const withdrawLpQuote = await ammClient.removeLiquidityIx(
        amm2Key, 
        amm2.baseMint, 
        amm2.quoteMint, 
        new BN(failLpAmount.value.amount.toString()), 
        new BN(0), 
        new BN(0)
      ).rpc();
      console.log(`✓ Fail AMM liquidity removed. Tx: ${withdrawLpQuote}`);
    } else {
      console.log("⚠ No liquidity in Fail AMM to remove");
    }
  } catch (error) {
    console.log("✗ Error removing liquidity:", error.message);
    console.log("  Continuing to next step...");
  }

  console.log("\n");

  // Step 2: Check all conditional token balances
  console.log("STEP 2: Checking conditional token balances");
  console.log("--------------------------------------------");

  let passBaseBalance, failBaseBalance, passQuoteBalance, failQuoteBalance;

  try {
    // Get all conditional token accounts
    const passBaseAccount = getAssociatedTokenAddressSync(passBaseMint, payer.publicKey, true);
    const failBaseAccount = getAssociatedTokenAddressSync(failBaseMint, payer.publicKey, true);
    const passQuoteAccount = getAssociatedTokenAddressSync(passQuoteMint, payer.publicKey, true);
    const failQuoteAccount = getAssociatedTokenAddressSync(failQuoteMint, payer.publicKey, true);

    // Check balances
    passBaseBalance = await provider.connection.getTokenAccountBalance(passBaseAccount).catch(() => ({ value: { amount: "0", uiAmountString: "0" }}));
    failBaseBalance = await provider.connection.getTokenAccountBalance(failBaseAccount).catch(() => ({ value: { amount: "0", uiAmountString: "0" }}));
    passQuoteBalance = await provider.connection.getTokenAccountBalance(passQuoteAccount).catch(() => ({ value: { amount: "0", uiAmountString: "0" }}));
    failQuoteBalance = await provider.connection.getTokenAccountBalance(failQuoteAccount).catch(() => ({ value: { amount: "0", uiAmountString: "0" }}));

    console.log(`Pass Base Tokens: ${passBaseBalance.value.uiAmountString || '0'}`);
    console.log(`Fail Base Tokens: ${failBaseBalance.value.uiAmountString || '0'}`);
    console.log(`Pass Quote Tokens: ${passQuoteBalance.value.uiAmountString || '0'}`);
    console.log(`Fail Quote Tokens: ${failQuoteBalance.value.uiAmountString || '0'}`);
  } catch (error) {
    console.log("✗ Error checking conditional token balances:", error.message);
  }

  console.log("\n");

  // Step 3: Merge conditional tokens
  console.log("STEP 3: Merging conditional tokens");
  console.log("-----------------------------------");

  try {
    // Calculate mergeable amounts (minimum of pass/fail for each asset)
    const baseToMerge = BN.min(
      new BN(passBaseBalance?.value.amount || "0"),
      new BN(failBaseBalance?.value.amount || "0")
    );
    
    const quoteToMerge = BN.min(
      new BN(passQuoteBalance?.value.amount || "0"),
      new BN(failQuoteBalance?.value.amount || "0")
    );

    console.log(`Base tokens to merge: ${baseToMerge.toString()}`);
    console.log(`Quote tokens to merge: ${quoteToMerge.toString()}`);

    if (baseToMerge.gt(new BN(0))) {
      console.log("Merging base conditional tokens...");
      const mergeBase = await vaultClient.mergeTokensIx(
        baseVault.question, 
        baseVaultKey, 
        dao.tokenMint, 
        baseToMerge, 
        2, 
        payer.publicKey
      ).rpc();
      console.log(`✓ Base tokens merged. Tx: ${mergeBase}`);
    } else {
      console.log("⚠ No base tokens to merge (need equal pass/fail amounts)");
    }

    if (quoteToMerge.gt(new BN(0))) {
      console.log("Merging quote conditional tokens...");
      const mergeQuote = await vaultClient.mergeTokensIx(
        quoteVault.question, 
        quoteVaultKey, 
        dao.usdcMint, 
        quoteToMerge, 
        2, 
        payer.publicKey
      ).rpc();
      console.log(`✓ Quote tokens merged. Tx: ${mergeQuote}`);
    } else {
      console.log("⚠ No quote tokens to merge (need equal pass/fail amounts)");
    }

    // Show remaining unmerged tokens
    const unmergableBase = BN.max(
      new BN(passBaseBalance?.value.amount || "0").sub(baseToMerge),
      new BN(failBaseBalance?.value.amount || "0").sub(baseToMerge)
    );
    const unmergableQuote = BN.max(
      new BN(passQuoteBalance?.value.amount || "0").sub(quoteToMerge),
      new BN(failQuoteBalance?.value.amount || "0").sub(quoteToMerge)
    );

    if (unmergableBase.gt(new BN(0)) || unmergableQuote.gt(new BN(0))) {
      console.log("\n⚠ Unmerged conditional tokens remaining:");
      if (unmergableBase.gt(new BN(0))) {
        console.log(`  - Base: ${unmergableBase.toString()} (waiting for proposal resolution)`);
      }
      if (unmergableQuote.gt(new BN(0))) {
        console.log(`  - Quote: ${unmergableQuote.toString()} (waiting for proposal resolution)`);
      }
    }
  } catch (error) {
    console.log("✗ Error merging tokens:", error.message);
    console.log("  Continuing to next step...");
  }

  console.log("\n");

  // Step 4: Attempt to redeem tokens if proposal is resolved
  console.log("STEP 4: Attempting to redeem for underlying tokens");
  console.log("---------------------------------------------------");

  

  console.log("\n========================================");
  console.log("Recovery process complete!");
  console.log("Check your wallet for recovered funds.");
}

main().catch(console.error);