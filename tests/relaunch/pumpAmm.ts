import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import {
  getPumpCreatorVaultAuthorityAddr,
  getPumpPoolV2Addr,
  parsePumpGlobalConfig,
  PumpGlobalConfigAccount,
  PUMP_AMM_EVENT_AUTHORITY,
  PUMP_AMM_FEE_CONFIG,
  PUMP_AMM_GLOBAL_CONFIG,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEES_PROGRAM_ID,
  PUMP_PROGRAM_ID,
} from "@metadaoproject/programs";

const TOKEN_ACCOUNT_RENT = 2_039_280n;

export const PUMP_GLOBAL_VOLUME_ACCUMULATOR = PublicKey.findProgramAddressSync(
  [Buffer.from("global_volume_accumulator")],
  PUMP_AMM_PROGRAM_ID,
)[0];

// Stable coin creator used by fabricated pools so creator-vault ATAs are
// deterministic across tests.
export const PUMP_TEST_COIN_CREATOR = Keypair.fromSeed(
  new Uint8Array(Buffer.from("relaunch-fixture-coin-creator!!!")),
).publicKey;

export function getPumpPoolAuthorityAddr(baseMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-authority"), baseMint.toBuffer()],
    PUMP_PROGRAM_ID,
  )[0];
}

export function getPumpPoolAddr({
  index,
  creator,
  baseMint,
  quoteMint,
}: {
  index: number;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
}): [PublicKey, number] {
  const indexBuf = Buffer.alloc(2);
  indexBuf.writeUInt16LE(index);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      indexBuf,
      creator.toBuffer(),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
    ],
    PUMP_AMM_PROGRAM_ID,
  );
}

export function getCanonicalPumpPoolAddr(
  baseMint: PublicKey,
  quoteMint: PublicKey,
): [PublicKey, number] {
  return getPumpPoolAddr({
    index: 0,
    creator: getPumpPoolAuthorityAddr(baseMint),
    baseMint,
    quoteMint,
  });
}

export function getUserVolumeAccumulatorAddr(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

async function fetchGlobalConfig(
  banksClient: BanksClient,
): Promise<PumpGlobalConfigAccount> {
  const globalConfig = await banksClient.getAccount(PUMP_AMM_GLOBAL_CONFIG);
  return parsePumpGlobalConfig(Buffer.from(globalConfig!.data));
}

function packTokenAccount({
  mint,
  owner,
  amount,
}: {
  mint: PublicKey;
  owner: PublicKey;
  amount: bigint;
}): Buffer {
  const isNative = mint.equals(token.NATIVE_MINT);
  const data = Buffer.alloc(token.ACCOUNT_SIZE);
  token.AccountLayout.encode(
    {
      mint,
      owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: token.AccountState.Initialized,
      isNativeOption: isNative ? 1 : 0,
      isNative: isNative ? TOKEN_ACCOUNT_RENT : 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  return data;
}

// Writes a token account at `address` via setAccount. WSOL accounts get
// amount-backed lamports so the token program can move lamports alongside
// native transfers.
export function writeTokenAccount(
  context: ProgramTestContext,
  {
    address,
    mint,
    owner,
    amount,
    tokenProgram = token.TOKEN_PROGRAM_ID,
  }: {
    address: PublicKey;
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    tokenProgram?: PublicKey;
  },
) {
  const isNative = mint.equals(token.NATIVE_MINT);
  context.setAccount(address, {
    data: packTokenAccount({ mint, owner, amount }),
    owner: tokenProgram,
    lamports: Number(TOKEN_ACCOUNT_RENT + (isNative ? amount : 0n)),
    executable: false,
  });
}

export type WritePumpPoolParams = {
  context: ProgramTestContext;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseReserve: bigint;
  quoteReserve: bigint;
  baseTokenProgram?: PublicKey;
  // Overrides below fabricate non-canonical pools for negative tests.
  index?: number;
  creator?: PublicKey;
  owner?: PublicKey;
  coinCreator?: PublicKey;
};

export type PumpPool = {
  pool: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseTokenProgram: PublicKey;
  poolBaseTokenAccount: PublicKey;
  poolQuoteTokenAccount: PublicKey;
  coinCreator: PublicKey;
};

// Pool account layout
//
//   offset size field                     type
//        0    8 discriminator             [241,154,109,4,17,177,109,188]
//        8    1 pool_bump                 u8
//        9    2 index                     u16 LE (0 = canonical)
//       11   32 creator                   Pubkey (pool-authority PDA when canonical)
//       43   32 base_mint                 Pubkey
//       75   32 quote_mint                Pubkey
//      107   32 lp_mint                   Pubkey (["pool_lp_mint", pool] PDA)
//      139   32 pool_base_token_account   Pubkey (ATA of pool, base token program)
//      171   32 pool_quote_token_account  Pubkey (ATA of pool, classic SPL)
//      203    8 lp_supply                 u64 LE (unread by swaps)
//      211   32 coin_creator              Pubkey
//      243    1 is_mayhem_mode            bool
//      244    1 is_cashback_coin          bool
//      245   16 virtual_quote_reserves    i128 LE (0 = legacy behavior)
//      261   40 (reserved)                zero on mainnet pools
//      301      total
//
// Fabricates a pump_amm Pool plus funded vaults directly via setAccount.
// Deliberate even with the real program loaded: only the pump bonding-curve
// program can sign for the canonical creator PDA, so a real create_pool can
// never produce the canonical fingerprint in tests.
export async function writePumpPool({
  context,
  baseMint,
  quoteMint,
  baseReserve,
  quoteReserve,
  baseTokenProgram = token.TOKEN_PROGRAM_ID,
  index = 0,
  creator,
  owner = PUMP_AMM_PROGRAM_ID,
  coinCreator = PUMP_TEST_COIN_CREATOR,
}: WritePumpPoolParams): Promise<PumpPool> {
  creator = creator ?? getPumpPoolAuthorityAddr(baseMint);
  const [pool, poolBump] = getPumpPoolAddr({
    index,
    creator,
    baseMint,
    quoteMint,
  });

  const poolBaseTokenAccount = token.getAssociatedTokenAddressSync(
    baseMint,
    pool,
    true,
    baseTokenProgram,
  );
  const poolQuoteTokenAccount = token.getAssociatedTokenAddressSync(
    quoteMint,
    pool,
    true,
  );
  const lpMint = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_lp_mint"), pool.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];

  const data = Buffer.alloc(301);
  let offset = 0;
  Buffer.from([241, 154, 109, 4, 17, 177, 109, 188]).copy(data, offset); // Pool discriminator
  offset += 8;
  data.writeUInt8(poolBump, offset);
  offset += 1;
  data.writeUInt16LE(index, offset);
  offset += 2;
  for (const key of [
    creator,
    baseMint,
    quoteMint,
    lpMint,
    poolBaseTokenAccount,
    poolQuoteTokenAccount,
  ]) {
    key.toBuffer().copy(data, offset);
    offset += 32;
  }
  data.writeBigUInt64LE(1_000_000_000n, offset); // lp_supply, unread by swaps
  offset += 8;
  coinCreator.toBuffer().copy(data, offset);
  offset += 32;
  // is_mayhem_mode, is_cashback_coin, virtual_quote_reserves and the 40
  // reserved tail bytes stay zeroed.

  context.setAccount(pool, {
    data,
    owner,
    lamports: 2_985_840,
    executable: false,
  });

  writeTokenAccount(context, {
    address: poolBaseTokenAccount,
    mint: baseMint,
    owner: pool,
    amount: baseReserve,
    tokenProgram: baseTokenProgram,
  });
  writeTokenAccount(context, {
    address: poolQuoteTokenAccount,
    mint: quoteMint,
    owner: pool,
    amount: quoteReserve,
  });

  // Fee destinations must exist before swaps: the coin creator's quote vault
  // ATA and the protocol fee recipient's quote ATA. Skip any that another
  // fabricated pool already wrote so accrued balances survive.
  const creatorVaultAta = token.getAssociatedTokenAddressSync(
    quoteMint,
    getPumpCreatorVaultAuthorityAddr(coinCreator),
    true,
  );
  if (!(await context.banksClient.getAccount(creatorVaultAta))) {
    writeTokenAccount(context, {
      address: creatorVaultAta,
      mint: quoteMint,
      owner: getPumpCreatorVaultAuthorityAddr(coinCreator),
      amount: 0n,
    });
  }
  const { protocolFeeRecipients, buybackFeeRecipients } =
    await fetchGlobalConfig(context.banksClient);
  for (const recipient of [protocolFeeRecipients[0], ...buybackFeeRecipients]) {
    const recipientAta = token.getAssociatedTokenAddressSync(
      quoteMint,
      recipient,
      true,
    );
    if (!(await context.banksClient.getAccount(recipientAta))) {
      writeTokenAccount(context, {
        address: recipientAta,
        mint: quoteMint,
        owner: recipient,
        amount: 0n,
      });
    }
  }

  return {
    pool,
    baseMint,
    quoteMint,
    baseTokenProgram,
    poolBaseTokenAccount,
    poolQuoteTokenAccount,
    coinCreator,
  };
}

function swapAccountMetas(
  pool: PumpPool,
  user: PublicKey,
  protocolFeeRecipient: PublicKey,
) {
  const userBaseTokenAccount = token.getAssociatedTokenAddressSync(
    pool.baseMint,
    user,
    true,
    pool.baseTokenProgram,
  );
  const userQuoteTokenAccount = token.getAssociatedTokenAddressSync(
    pool.quoteMint,
    user,
    true,
  );
  const protocolFeeRecipientTokenAccount = token.getAssociatedTokenAddressSync(
    pool.quoteMint,
    protocolFeeRecipient,
    true,
  );
  const coinCreatorVaultAuthority = getPumpCreatorVaultAuthorityAddr(
    pool.coinCreator,
  );
  const coinCreatorVaultAta = token.getAssociatedTokenAddressSync(
    pool.quoteMint,
    coinCreatorVaultAuthority,
    true,
  );

  return [
    { pubkey: pool.pool, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: PUMP_AMM_GLOBAL_CONFIG, isSigner: false, isWritable: false },
    { pubkey: pool.baseMint, isSigner: false, isWritable: false },
    { pubkey: pool.quoteMint, isSigner: false, isWritable: false },
    { pubkey: userBaseTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userQuoteTokenAccount, isSigner: false, isWritable: true },
    { pubkey: pool.poolBaseTokenAccount, isSigner: false, isWritable: true },
    { pubkey: pool.poolQuoteTokenAccount, isSigner: false, isWritable: true },
    { pubkey: protocolFeeRecipient, isSigner: false, isWritable: false },
    {
      pubkey: protocolFeeRecipientTokenAccount,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: pool.baseTokenProgram, isSigner: false, isWritable: false },
    { pubkey: token.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    {
      pubkey: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: PUMP_AMM_EVENT_AUTHORITY, isSigner: false, isWritable: false },
    { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: coinCreatorVaultAta, isSigner: false, isWritable: true },
    { pubkey: coinCreatorVaultAuthority, isSigner: false, isWritable: false },
  ];
}

// sell(base_amount_in, min_quote_amount_out) — 21 accounts plus the same
// remaining-account tail as buy: pool_v2, then a buyback fee recipient with
// its quote ATA (mirrors pump's own SDK; required once buyback fees have
// accrued).
export function pumpSellIx({
  pool,
  user,
  protocolFeeRecipient,
  buybackFeeRecipient,
  baseAmountIn,
  minQuoteAmountOut,
}: {
  pool: PumpPool;
  user: PublicKey;
  protocolFeeRecipient: PublicKey;
  buybackFeeRecipient: PublicKey;
  baseAmountIn: bigint;
  minQuoteAmountOut: bigint;
}): TransactionInstruction {
  const data = Buffer.alloc(8 + 8 + 8);
  Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]).copy(data, 0);
  data.writeBigUInt64LE(baseAmountIn, 8);
  data.writeBigUInt64LE(minQuoteAmountOut, 16);

  const keys = [
    ...swapAccountMetas(pool, user, protocolFeeRecipient),
    { pubkey: PUMP_AMM_FEE_CONFIG, isSigner: false, isWritable: false },
    { pubkey: PUMP_FEES_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: getPumpPoolV2Addr(pool.baseMint),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: buybackFeeRecipient, isSigner: false, isWritable: false },
    {
      pubkey: token.getAssociatedTokenAddressSync(
        pool.quoteMint,
        buybackFeeRecipient,
        true,
      ),
      isSigner: false,
      isWritable: true,
    },
  ];

  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM_ID,
    keys,
    data,
  });
}

// buy(base_amount_out, max_quote_amount_in, track_volume) — sell's accounts
// plus the two volume accumulators, 23 total, then the remaining accounts:
// pool_v2 and (required for buys, unlike sells) one buyback fee recipient
// with its quote ATA. Any member of the global config's buyback list works.
export function pumpBuyIx({
  pool,
  user,
  protocolFeeRecipient,
  buybackFeeRecipient,
  baseAmountOut,
  maxQuoteAmountIn,
  trackVolume = false,
}: {
  pool: PumpPool;
  user: PublicKey;
  protocolFeeRecipient: PublicKey;
  buybackFeeRecipient: PublicKey;
  baseAmountOut: bigint;
  maxQuoteAmountIn: bigint;
  trackVolume?: boolean;
}): TransactionInstruction {
  const data = Buffer.alloc(8 + 8 + 8 + 1);
  Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]).copy(data, 0);
  data.writeBigUInt64LE(baseAmountOut, 8);
  data.writeBigUInt64LE(maxQuoteAmountIn, 16);
  data.writeUInt8(trackVolume ? 1 : 0, 24);

  const keys = [
    ...swapAccountMetas(pool, user, protocolFeeRecipient),
    {
      pubkey: PUMP_GLOBAL_VOLUME_ACCUMULATOR,
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: getUserVolumeAccumulatorAddr(user),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: PUMP_AMM_FEE_CONFIG, isSigner: false, isWritable: false },
    { pubkey: PUMP_FEES_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: getPumpPoolV2Addr(pool.baseMint),
      isSigner: false,
      isWritable: false,
    },
    { pubkey: buybackFeeRecipient, isSigner: false, isWritable: false },
    {
      pubkey: token.getAssociatedTokenAddressSync(
        pool.quoteMint,
        buybackFeeRecipient,
        true,
      ),
      isSigner: false,
      isWritable: true,
    },
  ];

  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM_ID,
    keys,
    data,
  });
}

export function pumpInitUserVolumeAccumulatorIx({
  payer,
  user,
}: {
  payer: PublicKey;
  user: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: PUMP_AMM_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: user, isSigner: false, isWritable: false },
      {
        pubkey: getUserVolumeAccumulatorAddr(user),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: PUMP_AMM_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_AMM_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([94, 6, 202, 115, 255, 96, 232, 183]),
  });
}
