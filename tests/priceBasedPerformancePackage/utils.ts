import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

const OLD_PERFORMANCE_PACKAGE_SIZE = 520;

// Rewrites a package as the 520-byte v0.6.0 layout, rent-exempt at that size.
export async function writeOldLayoutPackage(
  ctx: Mocha.Context,
  performancePackage: PublicKey,
): Promise<void> {
  const account = await ctx.banksClient.getAccount(performancePackage);
  const rent = await ctx.banksClient.getRent();
  ctx.context.setAccount(performancePackage, {
    ...account,
    lamports: Number(rent.minimumBalance(BigInt(OLD_PERFORMANCE_PACKAGE_SIZE))),
    data: account.data.slice(0, OLD_PERFORMANCE_PACKAGE_SIZE),
  });
}

// Writes a 24-byte mock oracle: aggregator u128 at 0, last updated timestamp i64 at 16.
export async function setMockOracle(
  ctx: Mocha.Context,
  oracle: PublicKey,
  {
    aggregator,
    lastUpdatedTimestamp,
  }: { aggregator: bigint; lastUpdatedTimestamp?: bigint },
): Promise<void> {
  const data = Buffer.alloc(24);
  data.writeBigUInt64LE(aggregator & ((1n << 64n) - 1n), 0);
  data.writeBigUInt64LE(aggregator >> 64n, 8);
  data.writeBigInt64LE(
    lastUpdatedTimestamp ?? (await ctx.banksClient.getClock()).unixTimestamp,
    16,
  );
  ctx.context.setAccount(oracle, {
    executable: false,
    owner: SystemProgram.programId,
    lamports: 1_000_000_000,
    data,
  });
}

// Starts an unlock, advances one TWAP length, and completes it at a TWAP of `twapPrice`.
export async function runUnlockCycle(
  ctx: Mocha.Context,
  {
    performancePackage,
    oracleAccount,
    recipient,
    twapPrice,
  }: {
    performancePackage: PublicKey;
    oracleAccount: PublicKey;
    recipient: Keypair;
    twapPrice: bigint;
  },
): Promise<void> {
  const { twapLengthSeconds, seqNum } =
    await ctx.priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );
  // The sequence number differs on every cycle, so using it as the compute-unit
  // price makes each transaction hash unique and avoids duplicate-processing errors.
  const uniqueTxIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: seqNum.toNumber(),
  });
  const startAggregator = BigInt(1e12);

  await setMockOracle(ctx, oracleAccount, { aggregator: startAggregator });
  await ctx.priceBasedPerformancePackage
    .startUnlockIx({
      performancePackage,
      oracleAccount,
      recipient: recipient.publicKey,
    })
    .preInstructions([uniqueTxIx])
    .signers([recipient])
    .rpc();

  await ctx.advanceBySeconds(twapLengthSeconds);
  await setMockOracle(ctx, oracleAccount, {
    aggregator: startAggregator + twapPrice * BigInt(twapLengthSeconds),
  });
  await ctx.priceBasedPerformancePackage
    .completeUnlockIx({ performancePackage, oracleAccount })
    .preInstructions([uniqueTxIx])
    .rpc();
}
