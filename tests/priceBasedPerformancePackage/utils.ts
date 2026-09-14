import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { LimitsParams, Tranche } from "@metadaoproject/programs";

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
  writeU128(data, aggregator, 0);
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

function writeU128(data: Buffer, value: bigint, offset: number) {
  data.writeBigUInt64LE(value & ((1n << 64n) - 1n), offset);
  data.writeBigUInt64LE(value >> 64n, offset + 8);
}

// Offsets of the spot pool inside a Dao account, the same in both PoolState
// variants: the discriminator and variant tag take 9 bytes, then the TwapOracle
// (aggregator at 0, last updated timestamp at 16, last observation at 48, 100
// bytes in all) and the quote and base reserves.
const DAO_SPOT_POOL_OFFSET = 9;
const DAO_AGGREGATOR_OFFSET = DAO_SPOT_POOL_OFFSET;
const DAO_LAST_UPDATED_OFFSET = DAO_SPOT_POOL_OFFSET + 16;
const DAO_LAST_OBSERVATION_OFFSET = DAO_SPOT_POOL_OFFSET + 48;
const DAO_QUOTE_RESERVES_OFFSET = DAO_SPOT_POOL_OFFSET + 100;
const DAO_BASE_RESERVES_OFFSET = DAO_SPOT_POOL_OFFSET + 108;

// Patches a Dao's spot pool in place. Fields left out keep their stored values;
// setting the aggregator also stamps the last updated timestamp, like the mock.
export async function setDaoOracle(
  ctx: Mocha.Context,
  dao: PublicKey,
  {
    aggregator,
    lastUpdatedTimestamp,
    lastObservation,
    reserves,
  }: {
    aggregator?: bigint;
    lastUpdatedTimestamp?: bigint;
    lastObservation?: bigint;
    reserves?: { base: bigint; quote: bigint };
  },
): Promise<void> {
  const account = await ctx.banksClient.getAccount(dao);
  const data = Buffer.from(account.data);

  if (aggregator !== undefined) {
    writeU128(data, aggregator, DAO_AGGREGATOR_OFFSET);
  }
  if (aggregator !== undefined || lastUpdatedTimestamp !== undefined) {
    data.writeBigInt64LE(
      lastUpdatedTimestamp ?? (await ctx.banksClient.getClock()).unixTimestamp,
      DAO_LAST_UPDATED_OFFSET,
    );
  }
  if (lastObservation !== undefined) {
    writeU128(data, lastObservation, DAO_LAST_OBSERVATION_OFFSET);
  }
  if (reserves !== undefined) {
    data.writeBigUInt64LE(reserves.quote, DAO_QUOTE_RESERVES_OFFSET);
    data.writeBigUInt64LE(reserves.base, DAO_BASE_RESERVES_OFFSET);
  }

  ctx.context.setAccount(dao, { ...account, data });

  // Read the Dao back through the SDK so stale offsets fail loudly
  const state = (await ctx.futarchy.getDao(dao)).amm.state as any;
  const pool = state.spot?.spot ?? state.futarchy.spot;
  if (
    (aggregator !== undefined &&
      pool.oracle.aggregator.toString() !== aggregator.toString()) ||
    (lastObservation !== undefined &&
      pool.oracle.lastObservation.toString() !== lastObservation.toString()) ||
    (reserves !== undefined &&
      (pool.quoteReserves.toString() !== reserves.quote.toString() ||
        pool.baseReserves.toString() !== reserves.base.toString()))
  ) {
    throw new Error("setDaoOracle wrote to the wrong offsets");
  }
}

// Creates a Dao on `tokenMint` and a package that uses it as its oracle at byte
// offset 9, where the spot pool's TwapOracle starts.
export async function setupPackageOnDao(
  ctx: Mocha.Context,
  {
    tokenMint,
    quoteMint,
    recipient,
    limits,
    tranches,
    minUnlockTimestamp,
  }: {
    tokenMint: PublicKey;
    quoteMint: PublicKey;
    recipient: PublicKey;
    limits?: LimitsParams;
    tranches?: Tranche[];
    minUnlockTimestamp?: BN;
  },
): Promise<{ dao: PublicKey; performancePackage: PublicKey }> {
  const dao = await ctx.setupBasicDao({ baseMint: tokenMint, quoteMint });
  const performancePackage = await ctx.setupBasicPerformancePackage({
    tokenMint,
    oracleAccount: dao,
    byteOffset: 9,
    recipient,
    limits,
    tranches,
    minUnlockTimestamp,
  });

  return { dao, performancePackage };
}

// Starts an unlock, advances one TWAP length, and completes it at a TWAP of
// `twapPrice`. Oracle values go to the 24-byte mock unless `writeOracle` says
// otherwise, as it does when the oracle is a Dao.
export async function runUnlockCycle(
  ctx: Mocha.Context,
  {
    performancePackage,
    oracleAccount,
    recipient,
    twapPrice,
    writeOracle = (values) => setMockOracle(ctx, oracleAccount, values),
  }: {
    performancePackage: PublicKey;
    oracleAccount: PublicKey;
    recipient: Keypair;
    twapPrice: bigint;
    writeOracle?: (values: { aggregator: bigint }) => Promise<void>;
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

  await writeOracle({ aggregator: startAggregator });
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
  await writeOracle({
    aggregator: startAggregator + twapPrice * BigInt(twapLengthSeconds),
  });
  await ctx.priceBasedPerformancePackage
    .completeUnlockIx({ performancePackage, oracleAccount })
    .preInstructions([uniqueTxIx])
    .rpc();
}

// The sellable package: two tranches of 2,580,000 tokens on a Dao whose pool
// opens at $0.0728 per token. The first tranche unlocks against the Dao's TWAP
// and the second stays locked.
export const SELLABLE_TRANCHE_AMOUNT = 2_580_000 * 10 ** 6;
const SELLABLE_FIRST_THRESHOLD = new BN(5e10);
const SELLABLE_LOCKED_THRESHOLD = new BN(2e12);
const SELLABLE_POOL_BASE = 10_000_000 * 10 ** 6;
const SELLABLE_POOL_QUOTE = 728_000 * 10 ** 6;
// Kept by the payer for oracle-stamping buys
const PAYER_RESERVE = 1_000 * 10 ** 6;
const ORACLE_STAMP_BUY = 1 * 10 ** 6;
const ONE_DAY = 24 * 60 * 60;

let uniqueTxCount = 0;

// A distinct compute-unit price gives otherwise identical transactions
// different hashes, so a repeat is not rejected as already processed.
export function uniqueTxIx(): TransactionInstruction {
  uniqueTxCount += 1;
  return ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: uniqueTxCount,
  });
}

// A small buy from the payer, which moves the Dao oracle's last updated
// timestamp to now.
export async function stampDaoOracle(
  ctx: Mocha.Context,
  {
    dao,
    tokenMint,
    quoteMint,
  }: { dao: PublicKey; tokenMint: PublicKey; quoteMint: PublicKey },
): Promise<void> {
  await ctx.futarchy
    .spotSwapIx({
      dao,
      baseMint: tokenMint,
      quoteMint,
      swapType: "buy",
      inputAmount: new BN(ORACLE_STAMP_BUY),
    })
    .preInstructions([uniqueTxIx()])
    .rpc();
}

// Unlocks the first tranche off the Dao's own TWAP: the oracle is stamped
// right before start_unlock and again one TWAP length later for
// complete_unlock.
export async function unlockFirstTrancheOnDao(
  ctx: Mocha.Context,
  {
    performancePackage,
    dao,
    tokenMint,
    quoteMint,
    recipient,
  }: {
    performancePackage: PublicKey;
    dao: PublicKey;
    tokenMint: PublicKey;
    quoteMint: PublicKey;
    recipient: Keypair;
  },
): Promise<void> {
  await stampDaoOracle(ctx, { dao, tokenMint, quoteMint });
  await ctx.priceBasedPerformancePackage
    .startUnlockIx({
      performancePackage,
      oracleAccount: dao,
      recipient: recipient.publicKey,
    })
    .preInstructions([uniqueTxIx()])
    .signers([recipient])
    .rpc();

  const { twapLengthSeconds } =
    await ctx.priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );
  await ctx.advanceBySeconds(twapLengthSeconds);
  await stampDaoOracle(ctx, { dao, tokenMint, quoteMint });
  await ctx.priceBasedPerformancePackage
    .completeUnlockIx({ performancePackage, oracleAccount: dao })
    .preInstructions([uniqueTxIx()])
    .rpc();
}

// Creates fresh mints, a Dao with a seeded pool and a package on it holding
// two tranches of SELLABLE_TRANCHE_AMOUNT, then unlocks the first tranche.
// Without `limits` the package is uncapped.
export async function setupSellablePackage(
  ctx: Mocha.Context,
  { recipient, limits }: { recipient: Keypair; limits?: LimitsParams },
): Promise<{
  tokenMint: PublicKey;
  quoteMint: PublicKey;
  dao: PublicKey;
  performancePackage: PublicKey;
}> {
  const tokenMint = await ctx.createMint(ctx.payer.publicKey, 6);
  const quoteMint = await ctx.createMint(ctx.payer.publicKey, 6);
  await ctx.mintTo(
    tokenMint,
    ctx.payer.publicKey,
    ctx.payer,
    SELLABLE_POOL_BASE + 2 * SELLABLE_TRANCHE_AMOUNT + PAYER_RESERVE,
  );
  await ctx.mintTo(
    quoteMint,
    ctx.payer.publicKey,
    ctx.payer,
    SELLABLE_POOL_QUOTE + PAYER_RESERVE,
  );

  const { dao, performancePackage } = await setupPackageOnDao(ctx, {
    tokenMint,
    quoteMint,
    recipient: recipient.publicKey,
    tranches: [
      {
        priceThreshold: SELLABLE_FIRST_THRESHOLD,
        tokenAmount: new BN(SELLABLE_TRANCHE_AMOUNT),
      },
      {
        priceThreshold: SELLABLE_LOCKED_THRESHOLD,
        tokenAmount: new BN(SELLABLE_TRANCHE_AMOUNT),
      },
    ],
    limits,
  });

  await ctx.futarchy
    .provideLiquidityIx({
      dao,
      baseMint: tokenMint,
      quoteMint,
      quoteAmount: new BN(SELLABLE_POOL_QUOTE),
      maxBaseAmount: new BN(SELLABLE_POOL_BASE),
    })
    .rpc();

  // The Dao's TWAP only starts recording after its one-day start delay
  await ctx.advanceBySeconds(ONE_DAY + 1);
  await unlockFirstTrancheOnDao(ctx, {
    performancePackage,
    dao,
    tokenMint,
    quoteMint,
    recipient,
  });

  return { tokenMint, quoteMint, dao, performancePackage };
}
