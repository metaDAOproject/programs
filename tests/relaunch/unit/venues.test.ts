import { PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BankrunProvider } from "anchor-bankrun";
import { BanksClient } from "solana-bankrun";
import { setupRelaunch } from "../utils.js";
import {
  getCanonicalPumpPoolAddr,
  getUserVolumeAccumulatorAddr,
  pumpBuyIx,
  pumpInitUserVolumeAccumulatorIx,
  pumpSellIx,
  writePumpPool,
  PumpPool,
} from "../pumpAmm.js";
import {
  FIXTURE_USDC_SWAP_POOL,
  setupWhirlpool,
  whirlpoolSwapV2Ix,
  wrapSol,
} from "../whirlpool.js";
import {
  getPumpCreatorVaultAuthorityAddr,
  getPumpFeeRecipients,
  MAINNET_USDC,
} from "@metadaoproject/programs";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC
const SELL_AMOUNT = 10_000n * 10n ** 6n; // 10k old tokens

async function tokenBalance(
  banksClient: BanksClient,
  address: PublicKey,
  tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
): Promise<bigint> {
  const raw = await banksClient.getAccount(address);
  if (!raw) return 0n;
  return token.unpackAccount(
    address,
    { ...raw, data: Buffer.from(raw.data) } as any,
    tokenProgram,
  ).amount;
}

export default function suite() {
  before(function () {
    this.bankrunProvider = new BankrunProvider(this.context);
  });

  const sellIntoPumpPool = async function (
    this: Mocha.Context,
    pool: PumpPool,
    quoteTokenAccount: PublicKey,
  ) {
    const { protocolFeeRecipient, buybackFeeRecipient } =
      await getPumpFeeRecipients(this.connection);
    const feeAtas = [
      protocolFeeRecipient,
      buybackFeeRecipient,
      getPumpCreatorVaultAuthorityAddr(pool.coinCreator),
    ].map((owner) =>
      token.getAssociatedTokenAddressSync(pool.quoteMint, owner, true),
    );
    const payerOldTokenAccount = token.getAssociatedTokenAddressSync(
      pool.baseMint,
      this.payer.publicKey,
      true,
      pool.baseTokenProgram,
    );

    const baseBefore = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
      pool.baseTokenProgram,
    );
    const quoteBefore = await tokenBalance(this.banksClient, quoteTokenAccount);
    const poolQuoteBefore = await tokenBalance(
      this.banksClient,
      pool.poolQuoteTokenAccount,
    );
    const feesBefore = await Promise.all(
      feeAtas.map((ata) => tokenBalance(this.banksClient, ata)),
    );

    const tx = new Transaction().add(
      pumpSellIx({
        pool,
        user: this.payer.publicKey,
        protocolFeeRecipient,
        buybackFeeRecipient,
        baseAmountIn: SELL_AMOUNT,
        minQuoteAmountOut: 0n,
      }),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);

    const baseAfter = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
      pool.baseTokenProgram,
    );
    const quoteAfter = await tokenBalance(this.banksClient, quoteTokenAccount);
    const poolBaseAfter = await tokenBalance(
      this.banksClient,
      pool.poolBaseTokenAccount,
      pool.baseTokenProgram,
    );

    assert.equal((baseBefore - baseAfter).toString(), SELL_AMOUNT.toString());
    assert.equal(
      poolBaseAfter.toString(),
      (POOL_BASE_RESERVE + SELL_AMOUNT).toString(),
    );

    // ~0.99 quote units gross on these reserves; fees shave a little more.
    const quoteReceived = quoteAfter - quoteBefore;
    assert.isTrue(quoteReceived > 900_000_000n && quoteReceived < 990_099_010n);

    // Everything the pool paid out landed with the seller or the fee ATAs.
    const poolQuoteAfter = await tokenBalance(
      this.banksClient,
      pool.poolQuoteTokenAccount,
    );
    const feesAfter = await Promise.all(
      feeAtas.map((ata) => tokenBalance(this.banksClient, ata)),
    );
    const feesPaid = feesAfter.reduce(
      (sum, after, i) => sum + (after - feesBefore[i]),
      0n,
    );
    assert.equal(
      (poolQuoteBefore - poolQuoteAfter).toString(),
      (quoteReceived + feesPaid).toString(),
    );

    return quoteReceived;
  };

  it("pump_amm sell and buy execute against a fabricated WSOL-quoted pool", async function () {
    const { oldMint, oldTokenProgram } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });

    const pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: oldTokenProgram,
    });
    assert.isTrue(
      pool.pool.equals(getCanonicalPumpPoolAddr(oldMint, token.NATIVE_MINT)[0]),
    );

    const wsolAta = await wrapSol(this.bankrunProvider, this.payer, 0n);
    await sellIntoPumpPool.call(this, pool, wsolAta);

    // Exact-output buy of the same 10k tokens, capped by max_quote_in.
    const { protocolFeeRecipient, buybackFeeRecipient } =
      await getPumpFeeRecipients(this.connection);
    await wrapSol(this.bankrunProvider, this.payer, 2n * 10n ** 9n);

    const payerOldTokenAccount = token.getAssociatedTokenAddressSync(
      oldMint,
      this.payer.publicKey,
      true,
      oldTokenProgram,
    );
    const baseBefore = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
      oldTokenProgram,
    );
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);

    const buyTx = new Transaction();
    if (
      !(await this.banksClient.getAccount(
        getUserVolumeAccumulatorAddr(this.payer.publicKey),
      ))
    ) {
      buyTx.add(
        pumpInitUserVolumeAccumulatorIx({
          payer: this.payer.publicKey,
          user: this.payer.publicKey,
        }),
      );
    }
    buyTx.add(
      pumpBuyIx({
        pool,
        user: this.payer.publicKey,
        protocolFeeRecipient,
        buybackFeeRecipient,
        baseAmountOut: SELL_AMOUNT,
        maxQuoteAmountIn: 2n * 10n ** 9n,
      }),
    );
    buyTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    buyTx.feePayer = this.payer.publicKey;
    buyTx.sign(this.payer);
    await this.banksClient.processTransaction(buyTx);

    const baseAfter = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
      oldTokenProgram,
    );
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);

    assert.equal((baseAfter - baseBefore).toString(), SELL_AMOUNT.toString());
    const wsolSpent = wsolBefore - wsolAfter;
    assert.isTrue(wsolSpent > 900_000_000n && wsolSpent <= 2n * 10n ** 9n);
  });

  it("pump_amm sell executes against a fabricated USDC-quoted pool", async function () {
    const { oldMint, oldTokenProgram } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });

    const pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: MAINNET_USDC,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: USDC_POOL_QUOTE_RESERVE,
      baseTokenProgram: oldTokenProgram,
    });

    const usdcAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    await sellIntoPumpPool.call(this, pool, usdcAta);
  });

  it("pump_amm sell executes against a Token-2022-base pool", async function () {
    const { oldMint, oldTokenProgram } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
    });

    const pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: oldTokenProgram,
    });

    const wsolAta = await wrapSol(this.bankrunProvider, this.payer, 0n);
    await sellIntoPumpPool.call(this, pool, wsolAta);
  });

  it("whirlpool fixture pool sits at the pinned address and swaps WSOL to USDC", async function () {
    const fixture = await setupWhirlpool({
      provider: this.bankrunProvider,
      payer: this.payer,
    });

    // The relaunch program's usdc_swap_pool constant pins this exact
    // address — the fixture pool recreates the mainnet pool's PDA because
    // it derives from the dumped mainnet config.
    assert.equal(
      fixture.whirlpool.toBase58(),
      "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE",
    );
    assert.isTrue(fixture.whirlpool.equals(FIXTURE_USDC_SWAP_POOL));

    const wsolAta = await wrapSol(this.bankrunProvider, this.payer, 10n ** 9n);
    const usdcAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);
    const usdcBefore = await tokenBalance(this.banksClient, usdcAta);

    const swapIx = await whirlpoolSwapV2Ix(fixture, {
      tokenAuthority: this.payer.publicKey,
      tokenOwnerAccountA: wsolAta,
      tokenOwnerAccountB: usdcAta,
      amountIn: 10n ** 9n, // 1 SOL
      minAmountOut: 95n * 10n ** 6n,
      aToB: true,
    });
    const tx = new Transaction().add(swapIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);

    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    const usdcAfter = await tokenBalance(this.banksClient, usdcAta);

    assert.equal((wsolBefore - wsolAfter).toString(), (10n ** 9n).toString());
    // ~100 USDC per SOL at the default sqrt price, minus the 0.04% fee and
    // a little price impact.
    const usdcReceived = usdcAfter - usdcBefore;
    assert.isTrue(
      usdcReceived > 95n * 10n ** 6n && usdcReceived < 100n * 10n ** 6n,
    );
  });
}
