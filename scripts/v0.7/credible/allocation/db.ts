/**
 * Fund events for the boost calculation, read directly from the indexer Postgres.
 *
 * Standalone equivalent of futarchyDb.accelerated.findFundingEvents for a single
 * v0.7 launch — a plain `pg` query so this project carries no workspace deps.
 * Returns the per-transaction fund events used to expand multi-contribution
 * funders into an accurate cumulative timeline. Optional: the boost falls back
 * to chain-only data if this can't run.
 */
import { Client } from "pg";
import BN from "bn.js";

import type { FundEvent } from "./ac/accumulator";
import { log } from "./logger";

const logger = log.child({ module: "db" });

interface FundRow {
  funderAddr: string;
  quoteAmount: string;
  timestamp: Date;
}

/**
 * Fetch all fund events for a v0.7 launch, oldest first.
 *
 * @param pgUrl — Postgres connection string (FUTARCHY_PG_URL)
 * @param launchAddr — base58 launch address
 * @returns fund events in the shape the accumulator boost expects
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
