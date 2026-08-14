import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { ProgramTestContext } from "solana-bankrun";
import {
  OPENBOOK_PROGRAM_ID,
  RAYDIUM_AMM_AUTHORITY,
  RAYDIUM_AMM_PROGRAM_ID,
} from "@metadaoproject/programs";
import { writeTokenAccount } from "./pumpAmm.js";

export { OPENBOOK_PROGRAM_ID, RAYDIUM_AMM_AUTHORITY, RAYDIUM_AMM_PROGRAM_ID };

const AMM_INFO_LEN = 752;
const POOL_RENT = 6_124_800n; // rent-exempt minimum for 752 bytes
const MINT_RENT = 1_461_600n; // rent-exempt minimum for 82 bytes

export type WriteRaydiumPoolParams = {
  context: ProgramTestContext;
  oldMint: PublicKey;
  tokenReserve: bigint;
  quoteReserve: bigint;
  // Which AMM side holds the old token. Pump migrations put the token on the
  // pc side with WSOL as coin; "coin" fabricates the flipped orientation.
  tokenSide?: "pc" | "coin";
  // Overrides below fabricate non-canonical pools for negative tests.
  owner?: PublicKey;
  quoteMint?: PublicKey;
  status?: bigint;
  marketProgram?: PublicKey;
  lpAmount?: bigint;
  lpSupply?: bigint;
};

export type RaydiumPool = {
  pool: PublicKey;
  coinMint: PublicKey;
  pcMint: PublicKey;
  coinVault: PublicKey;
  pcVault: PublicKey;
  lpMint: PublicKey;
};

// AmmInfo layout (752 bytes, packed, no discriminator). The swap path reads
// status, nonce, the vault/mint fields, swap fees, and need_take_pnl; the
// rest are orderbook-era plumbing whose defaults below copy the live MOBY
// pool (AemYRZmJryzAQ9Z4RLfUBLnPRUY5ecooc94EJvemfti4, 2026-08-12).
//
//   offset size field                          value written
//        0    8 status                         6 (SwapOnly) unless overridden
//        8    8 nonce                          254 (derives the 5Q544… authority)
//       16    8 order_num                      7
//       24    8 depth                          3
//       32    8 coin_decimals                  per orientation (WSOL 9, token 6)
//       40    8 pc_decimals                    per orientation
//       48    8 state                          1
//       56    8 reset_flag                     0
//       64    8 min_size                       10_000_000
//       72    8 vol_max_cut_ratio              500
//       80    8 amount_wave                    5_000_000
//       88    8 coin_lot_size                  10_000_000
//       96    8 pc_lot_size                    10_000_000
//      104    8 min_price_multiplier           1
//      112    8 max_price_multiplier           1_000_000_000
//      120    8 sys_decimal_value              1_000_000_000
//      128   64 fees                           5/10000, 25/10000, 12/100, 25/10000
//      192  144 state_data                     zero (need_take_pnl, PnL + swap stats)
//      336   32 coin_vault
//      368   32 pc_vault
//      400   32 coin_mint
//      432   32 pc_mint
//      464   32 lp_mint
//      496   32 open_orders                    zero (unread by the V2 path)
//      528   32 market                         zero (unread by the V2 path)
//      560   32 market_program                 OpenBook unless overridden
//      592   32 target_orders                  zero (unread by the V2 path)
//      624   64 padding1                       zero
//      688   32 amm_owner                      zero (unread by swaps)
//      720    8 lp_amount                      ~4_045e9 unless overridden
//      728    8 client_order_id                0
//      736    8 recent_epoch                   0
//      744    8 padding2                       0
//
// Fabricates the pool plus funded vaults and LP mint directly via setAccount.
// Deliberate rather than initialize2: canonicality is fingerprint-based
// (owner + shape), and real pool creation would drag in OpenBook markets the
// V2 swap path never touches.
export function writeRaydiumPool({
  context,
  oldMint,
  tokenReserve,
  quoteReserve,
  tokenSide = "pc",
  owner = RAYDIUM_AMM_PROGRAM_ID,
  quoteMint = token.NATIVE_MINT,
  status = 6n,
  marketProgram = OPENBOOK_PROGRAM_ID,
  lpAmount = 4_045_000_000_000n,
  lpSupply = 2_000_000_000n,
}: WriteRaydiumPoolParams): RaydiumPool {
  const pool = Keypair.generate().publicKey;
  const coinVault = Keypair.generate().publicKey;
  const pcVault = Keypair.generate().publicKey;
  const lpMint = Keypair.generate().publicKey;

  const tokenAsPc = tokenSide === "pc";
  const coinMint = tokenAsPc ? quoteMint : oldMint;
  const pcMint = tokenAsPc ? oldMint : quoteMint;
  const coinReserve = tokenAsPc ? quoteReserve : tokenReserve;
  const pcReserve = tokenAsPc ? tokenReserve : quoteReserve;

  const data = Buffer.alloc(AMM_INFO_LEN);
  const u64Fields: [number, bigint][] = [
    [0, status],
    [8, 254n], // nonce
    [16, 7n], // order_num
    [24, 3n], // depth
    [32, tokenAsPc ? 9n : 6n], // coin_decimals
    [40, tokenAsPc ? 6n : 9n], // pc_decimals
    [48, 1n], // state
    [64, 10_000_000n], // min_size
    [72, 500n], // vol_max_cut_ratio
    [80, 5_000_000n], // amount_wave
    [88, 10_000_000n], // coin_lot_size
    [96, 10_000_000n], // pc_lot_size
    [104, 1n], // min_price_multiplier
    [112, 1_000_000_000n], // max_price_multiplier
    [120, 1_000_000_000n], // sys_decimal_value
    [128, 5n], // min_separate_numerator
    [136, 10_000n], // min_separate_denominator
    [144, 25n], // trade_fee_numerator
    [152, 10_000n], // trade_fee_denominator
    [160, 12n], // pnl_numerator
    [168, 100n], // pnl_denominator
    [176, 25n], // swap_fee_numerator
    [184, 10_000n], // swap_fee_denominator
    [720, lpAmount],
  ];
  for (const [offset, value] of u64Fields) {
    data.writeBigUInt64LE(value, offset);
  }
  const pubkeyFields: [number, PublicKey][] = [
    [336, coinVault],
    [368, pcVault],
    [400, coinMint],
    [432, pcMint],
    [464, lpMint],
    [560, marketProgram],
  ];
  for (const [offset, key] of pubkeyFields) {
    key.toBuffer().copy(data, offset);
  }

  context.setAccount(pool, {
    data,
    owner,
    lamports: Number(POOL_RENT),
    executable: false,
  });

  writeTokenAccount(context, {
    address: coinVault,
    mint: coinMint,
    owner: RAYDIUM_AMM_AUTHORITY,
    amount: coinReserve,
  });
  writeTokenAccount(context, {
    address: pcVault,
    mint: pcMint,
    owner: RAYDIUM_AMM_AUTHORITY,
    amount: pcReserve,
  });

  const lpMintData = Buffer.alloc(token.MINT_SIZE);
  token.MintLayout.encode(
    {
      mintAuthorityOption: 1,
      mintAuthority: RAYDIUM_AMM_AUTHORITY,
      supply: lpSupply,
      decimals: 9,
      isInitialized: true,
      freezeAuthorityOption: 0,
      freezeAuthority: PublicKey.default,
    },
    lpMintData,
  );
  context.setAccount(lpMint, {
    data: lpMintData,
    owner: token.TOKEN_PROGRAM_ID,
    lamports: Number(MINT_RENT),
    executable: false,
  });

  return { pool, coinMint, pcMint, coinVault, pcVault, lpMint };
}

function swapAccountMetas(
  pool: RaydiumPool,
  userSourceTokenAccount: PublicKey,
  userDestinationTokenAccount: PublicKey,
  userSourceOwner: PublicKey,
) {
  return [
    { pubkey: token.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: pool.pool, isSigner: false, isWritable: true },
    { pubkey: RAYDIUM_AMM_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: pool.coinVault, isSigner: false, isWritable: true },
    { pubkey: pool.pcVault, isSigner: false, isWritable: true },
    { pubkey: userSourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userDestinationTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userSourceOwner, isSigner: true, isWritable: false },
  ];
}

// swap_base_in_v2(amount_in, minimum_amount_out) — tag 16, exact input.
// Direction is inferred from the source/destination account mints.
export function raydiumSwapBaseInV2Ix({
  pool,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userSourceOwner,
  amountIn,
  minimumAmountOut,
}: {
  pool: RaydiumPool;
  userSourceTokenAccount: PublicKey;
  userDestinationTokenAccount: PublicKey;
  userSourceOwner: PublicKey;
  amountIn: bigint;
  minimumAmountOut: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(1 + 8 + 8);
  data.writeUInt8(16, 0);
  data.writeBigUInt64LE(amountIn, 1);
  data.writeBigUInt64LE(minimumAmountOut, 9);

  return new TransactionInstruction({
    programId: RAYDIUM_AMM_PROGRAM_ID,
    keys: swapAccountMetas(
      pool,
      userSourceTokenAccount,
      userDestinationTokenAccount,
      userSourceOwner,
    ),
    data,
  });
}

// swap_base_out_v2(max_amount_in, amount_out) — tag 17, exact output; only
// the needed input is pulled from the source account.
export function raydiumSwapBaseOutV2Ix({
  pool,
  userSourceTokenAccount,
  userDestinationTokenAccount,
  userSourceOwner,
  maxAmountIn,
  amountOut,
}: {
  pool: RaydiumPool;
  userSourceTokenAccount: PublicKey;
  userDestinationTokenAccount: PublicKey;
  userSourceOwner: PublicKey;
  maxAmountIn: bigint;
  amountOut: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(1 + 8 + 8);
  data.writeUInt8(17, 0);
  data.writeBigUInt64LE(maxAmountIn, 1);
  data.writeBigUInt64LE(amountOut, 9);

  return new TransactionInstruction({
    programId: RAYDIUM_AMM_PROGRAM_ID,
    keys: swapAccountMetas(
      pool,
      userSourceTokenAccount,
      userDestinationTokenAccount,
      userSourceOwner,
    ),
    data,
  });
}
