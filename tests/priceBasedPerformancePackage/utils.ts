import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
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
