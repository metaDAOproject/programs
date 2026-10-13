import { Connection, PublicKey } from "@solana/web3.js";
import { WHIRLPOOL_PROGRAM_ID } from "../../constants.js";

// Orca Whirlpool SOL/USDC 0.04% — the swap venue pinned by the relaunch
// program's `usdc_swap_pool` constant.
export const USDC_SWAP_POOL = new PublicKey(
  "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
);

// SPL Memo, required by whirlpool's v2 instructions.
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const TICKS_PER_ARRAY = 88;

export function getWhirlpoolOracleAddr(whirlpool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("oracle"), whirlpool.toBuffer()],
    WHIRLPOOL_PROGRAM_ID,
  )[0];
}

export function getWhirlpoolTickArrayAddr(
  whirlpool: PublicKey,
  startTickIndex: number,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      whirlpool.toBuffer(),
      Buffer.from(startTickIndex.toString()),
    ],
    WHIRLPOOL_PROGRAM_ID,
  )[0];
}

// The three tick arrays a swap walks, starting from the array holding the
// current tick and continuing in the swap's direction.
export function getWhirlpoolSwapTickArrayAddrs(
  whirlpool: PublicKey,
  tickCurrentIndex: number,
  tickSpacing: number,
  aToB: boolean,
): [PublicKey, PublicKey, PublicKey] {
  const span = tickSpacing * TICKS_PER_ARRAY;
  const currentStart = Math.floor(tickCurrentIndex / span) * span;
  const direction = aToB ? -1 : 1;
  return [0, 1, 2].map((k) =>
    getWhirlpoolTickArrayAddr(whirlpool, currentStart + k * direction * span),
  ) as [PublicKey, PublicKey, PublicKey];
}

export type WhirlpoolAccount = {
  tickSpacing: number;
  sqrtPrice: bigint;
  tickCurrentIndex: number;
  tokenMintA: PublicKey;
  tokenVaultA: PublicKey;
  tokenMintB: PublicKey;
  tokenVaultB: PublicKey;
};

// The prefix of whirlpool's `Whirlpool` account that the swap helpers read:
//
//   offset size field
//        0    8 discriminator
//        8   32 whirlpools_config
//       40    1 whirlpool_bump
//       41    2 tick_spacing
//       43    2 fee_tier_index_seed
//       45    2 fee_rate
//       47    2 protocol_fee_rate
//       49   16 liquidity
//       65   16 sqrt_price
//       81    4 tick_current_index (i32)
//       85    8 protocol_fee_owed_a
//       93    8 protocol_fee_owed_b
//      101   32 token_mint_a
//      133   32 token_vault_a
//      165   16 fee_growth_global_a
//      181   32 token_mint_b
//      213   32 token_vault_b
export function parseWhirlpool(data: Buffer): WhirlpoolAccount {
  return {
    tickSpacing: data.readUInt16LE(41),
    sqrtPrice: data.readBigUInt64LE(65) + (data.readBigUInt64LE(73) << 64n),
    tickCurrentIndex: data.readInt32LE(81),
    tokenMintA: new PublicKey(data.subarray(101, 133)),
    tokenVaultA: new PublicKey(data.subarray(133, 165)),
    tokenMintB: new PublicKey(data.subarray(181, 213)),
    tokenVaultB: new PublicKey(data.subarray(213, 245)),
  };
}

/** Fetches and parses a whirlpool (the pinned USDC swap pool by default). */
export async function fetchWhirlpool(
  connection: Connection,
  whirlpool: PublicKey = USDC_SWAP_POOL,
): Promise<WhirlpoolAccount> {
  const info = await connection.getAccountInfo(whirlpool);
  if (info === null) {
    throw new Error(`whirlpool ${whirlpool.toBase58()} does not exist`);
  }
  return parseWhirlpool(info.data);
}
