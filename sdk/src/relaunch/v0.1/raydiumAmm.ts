import { Connection, PublicKey } from "@solana/web3.js";

// Raydium's legacy "Standard" AMM v4, where pre-PumpSwap pump graduations
// live.
export const RAYDIUM_AMM_PROGRAM_ID = new PublicKey(
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
);

// The global authority PDA over every AMM v4 vault: ["amm authority"].
export const RAYDIUM_AMM_AUTHORITY = new PublicKey(
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
);

// OpenBook v1. Stored as market_program by every orderbook-era AMM v4 pool.
export const OPENBOOK_PROGRAM_ID = new PublicKey(
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
);

// AmmInfo is a fixed-size packed struct with no discriminator, so the exact
// length is the shape check.
export const AMM_INFO_LEN = 752;

export type RaydiumPoolAccount = {
  status: bigint;
  coinVault: PublicKey;
  pcVault: PublicKey;
  coinMint: PublicKey;
  pcMint: PublicKey;
  lpMint: PublicKey;
  marketProgram: PublicKey;
  lpAmount: bigint;
};

// The subset of AmmInfo the client reads, at the same fixed offsets the
// program's RaydiumPool::try_parse uses.
export function parseRaydiumPool(data: Buffer): RaydiumPoolAccount {
  if (data.length !== AMM_INFO_LEN) {
    throw new Error(
      `expected a ${AMM_INFO_LEN}-byte AMM v4 pool account, got ${data.length} bytes`,
    );
  }
  return {
    status: data.readBigUInt64LE(0),
    coinVault: new PublicKey(data.subarray(336, 368)),
    pcVault: new PublicKey(data.subarray(368, 400)),
    coinMint: new PublicKey(data.subarray(400, 432)),
    pcMint: new PublicKey(data.subarray(432, 464)),
    lpMint: new PublicKey(data.subarray(464, 496)),
    marketProgram: new PublicKey(data.subarray(560, 592)),
    lpAmount: data.readBigUInt64LE(720),
  };
}

/** Fetches and parses `pool` as a Raydium AMM v4 pool account. */
export async function fetchRaydiumPool(
  connection: Connection,
  pool: PublicKey,
): Promise<RaydiumPoolAccount> {
  const info = await connection.getAccountInfo(pool);
  if (info === null) {
    throw new Error(`raydium pool ${pool.toBase58()} does not exist`);
  }
  return parseRaydiumPool(info.data);
}
