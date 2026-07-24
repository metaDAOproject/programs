/**
 * Indexer Postgres reads for Rip Cars allocation:
 *   - fund events (boost timeline)
 *   - ownership scores (floor track)
 */
import { Client } from "pg";
import BN from "bn.js";

import type { FundEvent } from "./allocation";
import { log } from "./logger";

const logger = log.child({ module: "db" });

interface FundRow {
  funderAddr: string;
  quoteAmount: string;
  timestamp: Date;
}

/**
 * Fetch all fund events for a v0.7 launch, oldest first.
 */
export async function fetchFundEvents(
  pgUrl: string,
  launchAddr: string,
): Promise<FundEvent[]> {
  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  try {
    const result = await client.query<FundRow>(
      `SELECT funder_addr   AS "funderAddr",
              quote_amount::text AS "quoteAmount",
              timestamp
       FROM v0_7_funds
       WHERE launch_addr = $1
       ORDER BY timestamp ASC`,
      [launchAddr],
    );
    logger.info(
      { launchAddr, rows: result.rows.length },
      "Fetched fund events",
    );
    return result.rows.map((r) => ({
      funderAddr: r.funderAddr,
      amount: new BN(r.quoteAmount),
      timestamp: new BN(Math.floor(r.timestamp.getTime() / 1000)),
    }));
  } finally {
    await client.end();
  }
}

/**
 * Fetch ownership scores keyed by wallet address.
 * @param scoreColumn — `ownership_points` or `total_usd_value_days`
 */
export async function fetchOwnershipScores(
  pgUrl: string,
  scoreColumn: "ownership_points" | "total_usd_value_days",
): Promise<Map<string, number>> {
  if (
    scoreColumn !== "ownership_points" &&
    scoreColumn !== "total_usd_value_days"
  ) {
    throw new Error(
      `SCORE_COLUMN must be ownership_points or total_usd_value_days (got '${scoreColumn}')`,
    );
  }
  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  try {
    const result = await client.query<{ owner: string; score: number }>(
      `SELECT owner, COALESCE(${scoreColumn}, 0)::float8 AS score
       FROM futarchy.ownership_scores`,
    );
    const out = new Map<string, number>();
    for (const row of result.rows) out.set(row.owner, row.score);
    logger.info({ scores: out.size, scoreColumn }, "Fetched ownership scores");
    return out;
  } finally {
    await client.end();
  }
}
