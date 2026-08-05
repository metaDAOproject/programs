import * as anchor from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { BN } from "bn.js";
import * as fs from "fs";
import { MAINNET_USDC, WHIRLPOOL_PROGRAM_ID } from "@metadaoproject/programs";

// The mainnet WhirlpoolsConfig the pinned SOL/USDC pool lives under, loaded
// into bankrun as a dumped fixture (initialize_config is admin-gated on the
// current program, and reusing the real config makes the fixture pool's PDA
// land at the exact mainnet USDC_SWAP_POOL address).
export const WHIRLPOOLS_CONFIG = new PublicKey(
  "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ",
);

// Mirrors the pinned mainnet SOL/USDC 0.04% pool's parameters.
export const TICK_SPACING = 4;

const TICKS_PER_ARRAY = 88;
const TICK_ARRAY_SPAN = TICK_SPACING * TICKS_PER_ARRAY;
// Whirlpool's global tick bounds; both are divisible by TICK_SPACING, so a
// full-range position can sit exactly on them.
const MIN_TICK = -443636;
const MAX_TICK = 443636;

export const MIN_SQRT_PRICE = 4_295_048_016n;
export const MAX_SQRT_PRICE = 79226673515401279992447579055n;

function bigintSqrt(n: bigint): bigint {
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// sqrt(0.1) << 64: raw price 0.1 USDC-per-lamport-ish units — i.e. 100 USDC
// per SOL at 9/6 decimals.
export const DEFAULT_SQRT_PRICE = bigintSqrt((1n << 128n) / 10n);

export function getWhirlpoolAddr({
  config = WHIRLPOOLS_CONFIG,
  tokenMintA = token.NATIVE_MINT,
  tokenMintB = MAINNET_USDC,
  tickSpacing = TICK_SPACING,
}: {
  config?: PublicKey;
  tokenMintA?: PublicKey;
  tokenMintB?: PublicKey;
  tickSpacing?: number;
} = {}): PublicKey {
  const spacingBuf = Buffer.alloc(2);
  spacingBuf.writeUInt16LE(tickSpacing);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("whirlpool"),
      config.toBuffer(),
      tokenMintA.toBuffer(),
      tokenMintB.toBuffer(),
      spacingBuf,
    ],
    WHIRLPOOL_PROGRAM_ID,
  )[0];
}

// Identical to the relaunch program's `usdc_swap_pool` constant: the pool
// PDA under the dumped mainnet config is the mainnet pool address.
export const FIXTURE_USDC_SWAP_POOL = getWhirlpoolAddr();

export function getFeeTierAddr(config: PublicKey): PublicKey {
  const spacingBuf = Buffer.alloc(2);
  spacingBuf.writeUInt16LE(TICK_SPACING);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_tier"), config.toBuffer(), spacingBuf],
    WHIRLPOOL_PROGRAM_ID,
  )[0];
}

// The mainnet fee tier for tick spacing 4 (0.04%), also a dumped fixture.
export const WHIRLPOOL_FEE_TIER = getFeeTierAddr(WHIRLPOOLS_CONFIG);

export function getOracleAddr(whirlpool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("oracle"), whirlpool.toBuffer()],
    WHIRLPOOL_PROGRAM_ID,
  )[0];
}

export function getTickArrayAddr(
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

export function getPositionAddr(positionMint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), positionMint.toBuffer()],
    WHIRLPOOL_PROGRAM_ID,
  );
}

export function startTickIndex(tick: number): number {
  return Math.floor(tick / TICK_ARRAY_SPAN) * TICK_ARRAY_SPAN;
}

function sqrtPriceToTick(sqrtPrice: bigint): number {
  const sqrtPriceFloat = Number(sqrtPrice) / 2 ** 64;
  return Math.floor((2 * Math.log(sqrtPriceFloat)) / Math.log(1.0001));
}

export function whirlpoolProgram(
  provider: anchor.AnchorProvider,
): anchor.Program {
  const idl = JSON.parse(
    fs.readFileSync("./tests/fixtures/whirlpool.json", "utf-8"),
  );
  return new anchor.Program(idl, WHIRLPOOL_PROGRAM_ID, provider);
}

export async function wrapSol(
  provider: anchor.AnchorProvider,
  payer: Signer,
  lamports: bigint,
): Promise<PublicKey> {
  const wsolAta = token.getAssociatedTokenAddressSync(
    token.NATIVE_MINT,
    payer.publicKey,
  );
  const tx = new Transaction().add(
    token.createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      wsolAta,
      payer.publicKey,
      token.NATIVE_MINT,
    ),
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: wsolAta,
      lamports: Number(lamports),
    }),
    token.createSyncNativeInstruction(wsolAta),
  );
  await provider.sendAndConfirm!(tx, [payer]);
  return wsolAta;
}

export type WhirlpoolFixture = {
  program: anchor.Program;
  config: PublicKey;
  whirlpool: PublicKey;
  oracle: PublicKey;
  tokenVaultA: PublicKey;
  tokenVaultB: PublicKey;
  tickArrayStarts: number[];
};

// Builds a real WSOL/USDC whirlpool through the program's own instructions
// under the dumped mainnet config: pool + tick arrays + a full-range
// position. The payer funds both sides (WSOL is wrapped here; USDC must
// already be in the payer's ATA).
export async function setupWhirlpool({
  provider,
  payer,
  sqrtPrice = DEFAULT_SQRT_PRICE,
  solAmount = 1_000n * 10n ** 9n,
  usdcAmount = 100_000n * 10n ** 6n,
}: {
  provider: anchor.AnchorProvider;
  payer: Signer;
  sqrtPrice?: bigint;
  solAmount?: bigint;
  usdcAmount?: bigint;
}): Promise<WhirlpoolFixture> {
  const program = whirlpoolProgram(provider);
  const config = WHIRLPOOLS_CONFIG;
  const feeTier = WHIRLPOOL_FEE_TIER;
  const whirlpool = getWhirlpoolAddr({ config });
  const oracle = getOracleAddr(whirlpool);
  const tokenVaultA = Keypair.generate();
  const tokenVaultB = Keypair.generate();

  await program.methods
    .initializePool(
      { whirlpoolBump: 0 }, // ignored by the program; PDA is re-derived
      TICK_SPACING,
      new BN(sqrtPrice.toString()),
    )
    .accounts({
      whirlpoolsConfig: config,
      tokenMintA: token.NATIVE_MINT,
      tokenMintB: MAINNET_USDC,
      funder: payer.publicKey,
      whirlpool,
      tokenVaultA: tokenVaultA.publicKey,
      tokenVaultB: tokenVaultB.publicKey,
      feeTier,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([tokenVaultA, tokenVaultB])
    .rpc();

  // Seed tick arrays around the current price (three on each side keeps
  // moderate swaps in both directions inside initialized arrays) plus the
  // two arrays holding the full-range position's boundary ticks.
  const currentStart = startTickIndex(sqrtPriceToTick(sqrtPrice));
  const tickArrayStarts = [
    ...[-3, -2, -1, 0, 1, 2, 3].map((k) => currentStart + k * TICK_ARRAY_SPAN),
    startTickIndex(MIN_TICK),
    startTickIndex(MAX_TICK),
  ].filter((start, i, all) => all.indexOf(start) === i);

  const tickArrayIxs: TransactionInstruction[] = [];
  for (const start of tickArrayStarts) {
    tickArrayIxs.push(
      await program.methods
        .initializeTickArray(start)
        .accounts({
          whirlpool,
          funder: payer.publicKey,
          tickArray: getTickArrayAddr(whirlpool, start),
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
    );
  }
  const tickArrayTx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    ...tickArrayIxs,
  );
  await provider.sendAndConfirm!(tickArrayTx, [payer]);

  // Full-range position funded by the payer.
  const positionMint = Keypair.generate();
  const [position, positionBump] = getPositionAddr(positionMint.publicKey);
  const positionTokenAccount = token.getAssociatedTokenAddressSync(
    positionMint.publicKey,
    payer.publicKey,
  );

  await program.methods
    .openPosition({ positionBump }, MIN_TICK, MAX_TICK)
    .accounts({
      funder: payer.publicKey,
      owner: payer.publicKey,
      position,
      positionMint: positionMint.publicKey,
      positionTokenAccount,
      whirlpool,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([positionMint])
    .rpc();

  // For a full-range position, amountA ≈ L / sqrtP and amountB ≈ L * sqrtP
  // (float sqrtP). The program computes exact requirements from on-chain
  // state; the 1% headroom on the maxes absorbs rounding.
  const sqrtPriceFloat = Number(sqrtPrice) / 2 ** 64;
  const liquidity = BigInt(
    Math.floor(
      Math.min(
        Number(solAmount) * sqrtPriceFloat,
        Number(usdcAmount) / sqrtPriceFloat,
      ),
    ),
  );
  const tokenMaxA = (solAmount * 101n) / 100n;
  const tokenMaxB = (usdcAmount * 101n) / 100n;

  const wsolAta = await wrapSol(provider, payer, tokenMaxA);
  const usdcAta = token.getAssociatedTokenAddressSync(
    MAINNET_USDC,
    payer.publicKey,
  );

  await program.methods
    .increaseLiquidity(
      new BN(liquidity.toString()),
      new BN(tokenMaxA.toString()),
      new BN(tokenMaxB.toString()),
    )
    .accounts({
      whirlpool,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      positionAuthority: payer.publicKey,
      position,
      positionTokenAccount,
      tokenOwnerAccountA: wsolAta,
      tokenOwnerAccountB: usdcAta,
      tokenVaultA: tokenVaultA.publicKey,
      tokenVaultB: tokenVaultB.publicKey,
      tickArrayLower: getTickArrayAddr(whirlpool, startTickIndex(MIN_TICK)),
      tickArrayUpper: getTickArrayAddr(whirlpool, startTickIndex(MAX_TICK)),
    })
    .rpc();

  return {
    program,
    config,
    whirlpool,
    oracle,
    tokenVaultA: tokenVaultA.publicKey,
    tokenVaultB: tokenVaultB.publicKey,
    tickArrayStarts,
  };
}

// Builds a swap_v2 instruction with the three tick arrays derived from the
// pool's live tick, walking in the swap's direction.
export async function whirlpoolSwapV2Ix(
  fixture: WhirlpoolFixture,
  {
    tokenAuthority,
    tokenOwnerAccountA,
    tokenOwnerAccountB,
    amountIn,
    minAmountOut,
    aToB,
  }: {
    tokenAuthority: PublicKey;
    tokenOwnerAccountA: PublicKey;
    tokenOwnerAccountB: PublicKey;
    amountIn: bigint;
    minAmountOut: bigint;
    aToB: boolean;
  },
): Promise<TransactionInstruction> {
  const pool = await fixture.program.account.whirlpool.fetch(fixture.whirlpool);
  const currentStart = startTickIndex(pool.tickCurrentIndex as number);
  const direction = aToB ? -1 : 1;
  const tickArrays = [0, 1, 2].map((k) =>
    getTickArrayAddr(
      fixture.whirlpool,
      currentStart + k * direction * TICK_ARRAY_SPAN,
    ),
  );

  return fixture.program.methods
    .swapV2(
      new BN(amountIn.toString()),
      new BN(minAmountOut.toString()),
      new BN((aToB ? MIN_SQRT_PRICE : MAX_SQRT_PRICE).toString()),
      true, // amount specified is input
      aToB,
      null, // no supplemental tick arrays / transfer hook accounts
    )
    .accounts({
      tokenProgramA: token.TOKEN_PROGRAM_ID,
      tokenProgramB: token.TOKEN_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      tokenAuthority,
      whirlpool: fixture.whirlpool,
      tokenMintA: token.NATIVE_MINT,
      tokenMintB: MAINNET_USDC,
      tokenOwnerAccountA,
      tokenVaultA: fixture.tokenVaultA,
      tokenOwnerAccountB,
      tokenVaultB: fixture.tokenVaultB,
      tickArray0: tickArrays[0],
      tickArray1: tickArrays[1],
      tickArray2: tickArrays[2],
      oracle: fixture.oracle,
    })
    .instruction();
}
