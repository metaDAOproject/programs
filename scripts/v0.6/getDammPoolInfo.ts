import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import {
  CpAmm,
  getUnClaimLpFee,
  getTotalLockedLiquidity,
} from "@meteora-ag/cp-amm-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  FutarchyClient,
  DAMM_V2_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
  LAUNCHPAD_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.6";
import { getSquadsPdasFromDao } from "../utils/squads.js";

const DAO_ADDRESS = new PublicKey(
  "GxpJkPEsPmuRCCTNnfZaDKg4X3gf4ZPgmqgFqtibaPtK",
);

const provider = anchor.AnchorProvider.env();
const futarchy = FutarchyClient.createClient({ provider });

// DAMM v2 seed prefixes
const POOL_PREFIX = Buffer.from("pool");
const POSITION_PREFIX = Buffer.from("position");
const POSITION_NFT_ACCOUNT_PREFIX = Buffer.from("position_nft_account");
const TOKEN_VAULT_PREFIX = Buffer.from("token_vault");

function maxKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBytes = left.toBuffer();
  const rightBytes = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBytes[i] > rightBytes[i]) return leftBytes;
    if (leftBytes[i] < rightBytes[i]) return rightBytes;
  }
  return leftBytes;
}

function minKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBytes = left.toBuffer();
  const rightBytes = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBytes[i] < rightBytes[i]) return leftBytes;
    if (leftBytes[i] > rightBytes[i]) return rightBytes;
  }
  return leftBytes;
}

async function main() {
  console.log("=".repeat(60));
  console.log("DAMM V2 POOL INFO");
  console.log("=".repeat(60));

  // 1. Fetch DAO data
  console.log("\nDAO Address:", DAO_ADDRESS.toBase58());
  const dao = await futarchy.getDao(DAO_ADDRESS);
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  console.log("\n--- DAO INFO ---");
  console.log("Base Mint:", dao.baseMint.toBase58());
  console.log("Quote Mint:", dao.quoteMint.toBase58());
  console.log("Squads Multisig:", multisigPda.toBase58());
  console.log("Vault PDA:", vaultPda.toBase58());

  // 2. Derive all PDAs
  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), dao.baseMint.toBuffer()],
    LAUNCHPAD_PROGRAM_ID,
  );

  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      POOL_PREFIX,
      MAINNET_METEORA_CONFIG.toBuffer(),
      maxKey(dao.baseMint, dao.quoteMint),
      minKey(dao.baseMint, dao.quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );

  const [positionAddress] = PublicKey.findProgramAddressSync(
    [POSITION_PREFIX, positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [positionNftAccount] = PublicKey.findProgramAddressSync(
    [POSITION_NFT_ACCOUNT_PREFIX, positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [tokenAVault] = PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_PREFIX, dao.baseMint.toBuffer(), poolAddress.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  const [tokenBVault] = PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_PREFIX, dao.quoteMint.toBuffer(), poolAddress.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  console.log("\n--- DERIVED PDAs ---");
  console.log("Pool Address:", poolAddress.toBase58());
  console.log("Position NFT Mint:", positionNftMint.toBase58());
  console.log("Position Address:", positionAddress.toBase58());
  console.log("Position NFT Account:", positionNftAccount.toBase58());
  console.log("Token A Vault:", tokenAVault.toBase58());
  console.log("Token B Vault:", tokenBVault.toBase58());

  // 3. Fetch on-chain state
  console.log("\n--- ON-CHAIN STATE ---");
  const cpAmm = new CpAmm(provider.connection);

  let poolState;
  try {
    poolState = await cpAmm.fetchPoolState(poolAddress);
    console.log("\nPool State:");
    console.log("  Sqrt Price:", poolState.sqrtPrice.toString());
    console.log("  Token A Mint:", poolState.tokenAMint.toBase58());
    console.log("  Token B Mint:", poolState.tokenBMint.toBase58());
    console.log("  Liquidity:", poolState.liquidity.toString());
    console.log(
      "  Base Fee:",
      poolState.poolFees?.baseFee?.cliffFeeNumerator?.toString() || "N/A",
    );
  } catch (e) {
    console.log("\nPool State: NOT FOUND (pool may not exist for this DAO)");
    console.log("\n" + "=".repeat(60));
    return;
  }

  try {
    const positionState = await cpAmm.fetchPositionState(positionAddress);
    const vestings = await cpAmm.getAllVestingsByPosition(positionAddress);
    let lockedLiquidity = new BN(0);
    for (const v of vestings) {
      lockedLiquidity = lockedLiquidity.add(getTotalLockedLiquidity(v.account));
    }
    const totalLiquidity = positionState.unlockedLiquidity.add(lockedLiquidity);

    console.log("\nPosition State:");
    console.log("  Total Liquidity:", totalLiquidity.toString());
    console.log(
      "  Unlocked Liquidity:",
      positionState.unlockedLiquidity.toString(),
    );
    console.log("  Locked Liquidity:", lockedLiquidity.toString());
    console.log("  Vesting Schedules:", vestings.length);

    // Claimable fees section
    console.log("\n--- CLAIMABLE FEES ---");
    const unclaimedFees = getUnClaimLpFee(poolState, positionState);
    const feeAHuman = unclaimedFees.feeTokenA.toNumber() / 1e6;
    const feeBHuman = unclaimedFees.feeTokenB.toNumber() / 1e6;
    const fmt = { minimumFractionDigits: 6, maximumFractionDigits: 6 };
    console.log("  Your LP fees (claimable):");
    console.log("    Base:", feeAHuman.toLocaleString(undefined, fmt));
    console.log("    Quote:", feeBHuman.toLocaleString(undefined, fmt));

    // Protocol fees (Meteora's cut) - check both field naming conventions
    const ps = poolState as any;
    const protocolFeeA =
      (ps.protocolAFee?.toNumber?.() ?? ps.protocol_a_fee?.toNumber?.() ?? 0) /
      1e6;
    const protocolFeeB =
      (ps.protocolBFee?.toNumber?.() ?? ps.protocol_b_fee?.toNumber?.() ?? 0) /
      1e6;
    const totalProtocolFeeA =
      (ps.totalProtocolAFee?.toNumber?.() ??
        ps.total_protocol_a_fee?.toNumber?.() ??
        0) / 1e6;
    const totalProtocolFeeB =
      (ps.totalProtocolBFee?.toNumber?.() ??
        ps.total_protocol_b_fee?.toNumber?.() ??
        0) / 1e6;
    console.log("  Protocol fees (Meteora's unclaimed):");
    console.log("    Base:", protocolFeeA.toLocaleString(undefined, fmt));
    console.log("    Quote:", protocolFeeB.toLocaleString(undefined, fmt));
    if (totalProtocolFeeA > 0 || totalProtocolFeeB > 0) {
      console.log("  Total protocol fees (cumulative):");
      console.log(
        "    Base:",
        totalProtocolFeeA.toLocaleString(undefined, fmt),
      );
      console.log(
        "    Quote:",
        totalProtocolFeeB.toLocaleString(undefined, fmt),
      );
    }

    if (unclaimedFees.rewards.length > 0) {
      unclaimedFees.rewards.forEach((reward, i) => {
        if (reward.gt(new BN(0))) {
          console.log(
            `  Reward ${i} claimable:`,
            (reward.toNumber() / 1e6).toLocaleString(undefined, fmt),
          );
        }
      });
    }
    if (
      unclaimedFees.feeTokenA.gt(new BN(0)) ||
      unclaimedFees.feeTokenB.gt(new BN(0))
    ) {
      console.log("  ✓ Fees can be claimed via claimPositionFee instruction");
    } else {
      console.log("  (no fees to claim)");
    }

    // Calculate withdrawal amounts for different percentages
    console.log("\n--- WITHDRAWAL ESTIMATES (unlocked only) ---");
    for (const pct of [10, 25, 50, 90, 100]) {
      const liquidityToRemove = positionState.unlockedLiquidity
        .mul(new BN(pct))
        .div(new BN(100));
      const quote = cpAmm.getWithdrawQuote({
        liquidityDelta: liquidityToRemove,
        sqrtPrice: poolState.sqrtPrice,
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
      });
      const tokenAHuman = quote.outAmountA.toNumber() / 1e6;
      const tokenBHuman = quote.outAmountB.toNumber() / 1e6;
      const withFeesA = tokenAHuman + feeAHuman;
      const withFeesB = tokenBHuman + feeBHuman;
      console.log(`  ${pct}% withdrawal:`);
      console.log(
        `    Without fees - Base: ${tokenAHuman.toLocaleString(undefined, fmt)} | Quote: ${tokenBHuman.toLocaleString(undefined, fmt)}`,
      );
      console.log(
        `    With fees    - Base: ${withFeesA.toLocaleString(undefined, fmt)} | Quote: ${withFeesB.toLocaleString(undefined, fmt)}`,
      );
    }

    // Also show what total liquidity would yield
    if (lockedLiquidity.gt(new BN(0))) {
      console.log("\n--- IF ALL LIQUIDITY WERE UNLOCKED ---");
      const totalQuote = cpAmm.getWithdrawQuote({
        liquidityDelta: totalLiquidity.mul(new BN(90)).div(new BN(100)),
        sqrtPrice: poolState.sqrtPrice,
        minSqrtPrice: poolState.sqrtMinPrice,
        maxSqrtPrice: poolState.sqrtMaxPrice,
      });
      const totalAHuman = totalQuote.outAmountA.toNumber() / 1e6;
      const totalBHuman = totalQuote.outAmountB.toNumber() / 1e6;
      console.log(`  90% of total liquidity:`);
      console.log(
        `    Token A (base): ${totalAHuman.toLocaleString(undefined, fmt)}`,
      );
      console.log(
        `    Token B (quote): ${totalBHuman.toLocaleString(undefined, fmt)}`,
      );
    }

    // Show combined total (withdrawal + fees)
    console.log("\n--- TOTAL RECOVERABLE ---");
    const fullWithdrawQuote = cpAmm.getWithdrawQuote({
      liquidityDelta: positionState.unlockedLiquidity,
      sqrtPrice: poolState.sqrtPrice,
      minSqrtPrice: poolState.sqrtMinPrice,
      maxSqrtPrice: poolState.sqrtMaxPrice,
    });
    const withdrawA = fullWithdrawQuote.outAmountA.toNumber() / 1e6;
    const withdrawB = fullWithdrawQuote.outAmountB.toNumber() / 1e6;
    const combinedA = withdrawA + feeAHuman;
    const combinedB = withdrawB + feeBHuman;
    console.log(`  Without fees:`);
    console.log(
      `    Token A (base): ${withdrawA.toLocaleString(undefined, fmt)}`,
    );
    console.log(
      `    Token B (quote): ${withdrawB.toLocaleString(undefined, fmt)}`,
    );
    console.log(`  With fees:`);
    console.log(
      `    Token A (base): ${combinedA.toLocaleString(undefined, fmt)}`,
    );
    console.log(
      `    Token B (quote): ${combinedB.toLocaleString(undefined, fmt)}`,
    );

    // Show pool vault balances and other LP tokens
    console.log("\n--- POOL VAULT BALANCES ---");
    const poolBaseVaultInfo =
      await provider.connection.getParsedAccountInfo(tokenAVault);
    const poolQuoteVaultInfo =
      await provider.connection.getParsedAccountInfo(tokenBVault);
    if (poolBaseVaultInfo.value && poolQuoteVaultInfo.value) {
      const poolBaseBalance = (poolBaseVaultInfo.value.data as any).parsed.info
        .tokenAmount.uiAmount;
      const poolQuoteBalance = (poolQuoteVaultInfo.value.data as any).parsed
        .info.tokenAmount.uiAmount;
      console.log(
        `  Pool base vault: ${poolBaseBalance.toLocaleString(undefined, fmt)}`,
      );
      console.log(
        `  Pool quote vault: ${poolQuoteBalance.toLocaleString(undefined, fmt)}`,
      );

      const otherBaseTokens = poolBaseBalance - combinedA;
      const otherQuoteTokens = poolQuoteBalance - combinedB;
      console.log(`\n--- TOKENS NOT RECOVERABLE BY YOU ---`);
      console.log(`  Base: ${otherBaseTokens.toLocaleString(undefined, fmt)}`);
      console.log(
        `  Quote: ${otherQuoteTokens.toLocaleString(undefined, fmt)}`,
      );
      console.log(
        `  (mostly Meteora protocol fees: ${protocolFeeA.toLocaleString(undefined, fmt)} base, ${protocolFeeB.toLocaleString(undefined, fmt)} quote)`,
      );
      const remainderBase = otherBaseTokens - protocolFeeA;
      const remainderQuote = otherQuoteTokens - protocolFeeB;
      if (remainderBase > 0.01 || remainderQuote > 0.01) {
        console.log(
          `  Other LPs or dust: ${remainderBase.toLocaleString(undefined, fmt)} base, ${remainderQuote.toLocaleString(undefined, fmt)} quote`,
        );
      }
    }

    // Calculate tokens for specific liquidity delta
    console.log("\n--- SPECIFIC LIQUIDITY DELTA CALCULATION ---");
    const specificLiquidityDelta = new BN("18299969710500660840000000000");
    const specificQuote = cpAmm.getWithdrawQuote({
      liquidityDelta: specificLiquidityDelta,
      sqrtPrice: poolState.sqrtPrice,
      minSqrtPrice: poolState.sqrtMinPrice,
      maxSqrtPrice: poolState.sqrtMaxPrice,
    });
    const specificTokenA = specificQuote.outAmountA.toNumber() / 1e6;
    const specificTokenB = specificQuote.outAmountB.toNumber() / 1e6;
    console.log(`  Liquidity Delta: ${specificLiquidityDelta.toString()}`);
    console.log(
      `  Token A (base): ${specificTokenA.toLocaleString(undefined, fmt)}`,
    );
    console.log(
      `  Token B (quote): ${specificTokenB.toLocaleString(undefined, fmt)}`,
    );

    // Fetch DAO vault token balances (separate from pool)
    console.log("\n--- DAO VAULT BALANCES ---");
    const tokenAccounts =
      await provider.connection.getParsedTokenAccountsByOwner(vaultPda, {
        programId: TOKEN_PROGRAM_ID,
      });
    let vaultBaseBalance = 0;
    let vaultQuoteBalance = 0;
    for (const { account } of tokenAccounts.value) {
      const parsed = account.data.parsed.info;
      const mint = parsed.mint;
      const balance = parsed.tokenAmount.uiAmount;
      if (mint === dao.baseMint.toBase58()) {
        vaultBaseBalance += balance;
        console.log(`  Base token: ${balance.toLocaleString(undefined, fmt)}`);
      } else if (mint === dao.quoteMint.toBase58()) {
        vaultQuoteBalance += balance;
        console.log(`  Quote token: ${balance.toLocaleString(undefined, fmt)}`);
      }
    }
    if (vaultBaseBalance === 0) console.log(`  Base token: 0`);
    if (vaultQuoteBalance === 0) console.log(`  Quote token: (no account)`);

    console.log("\n--- AFTER WITHDRAWAL + FEE CLAIM ---");
    console.log(
      `  Vault will have base: ${(vaultBaseBalance + combinedA).toLocaleString(undefined, fmt)}`,
    );
    console.log(
      `  Vault will have quote: ${(vaultQuoteBalance + combinedB).toLocaleString(undefined, fmt)}`,
    );
  } catch (e) {
    console.log("\nPosition State: NOT FOUND (position may not exist)");
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
