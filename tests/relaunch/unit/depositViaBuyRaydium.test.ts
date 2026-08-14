import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BanksClient } from "solana-bankrun";
import {
  getDepositRecordAddr,
  getPumpFeeRecipients,
  RelaunchClient,
} from "@metadaoproject/programs";
import { setupRelaunch } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";
import { writeRaydiumPool, RaydiumPool } from "../raydiumAmm.js";
import { wrapSol } from "../whirlpool.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const BASE_OUT = 10_000n * 10n ** 6n; // 10k old tokens

async function tokenBalance(
  banksClient: BanksClient,
  address: PublicKey,
): Promise<bigint> {
  const raw = await banksClient.getAccount(address);
  if (!raw) return 0n;
  return token.unpackAccount(address, {
    ...raw,
    data: Buffer.from(raw.data),
  } as any).amount;
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}

// The exact input the AMM pulls for an exact-output buy: the constant-product
// input, ceil-rounded, with the 25 bps fee ceil-rounded on top of it (the fee
// stays in the pool).
function raydiumExactOutInput(
  amountOut: bigint,
  inReserve: bigint,
  outReserve: bigint,
): bigint {
  const inBeforeFee = ceilDiv(inReserve * amountOut, outReserve - amountOut);
  return ceilDiv(inBeforeFee * 10_000n, 9_975n);
}

export default function suite() {
  let client: RelaunchClient;

  before(function () {
    client = this.relaunch;
  });

  const setupLiveRelaunch = async function (
    this: Mocha.Context,
    { start = true }: { start?: boolean } = {},
  ): Promise<{
    relaunch: PublicKey;
    pool: RaydiumPool;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    payerOldTokenAccount: PublicKey;
  }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = writeRaydiumPool({
      context: this.context,
      oldMint: setup.oldMint,
      tokenReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    const { relaunch } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    });

    if (start) {
      await client.startDepositsIx({ relaunch }).rpc();
    }

    return { ...setup, pool, relaunch };
  };

  const depositViaBuyRaydiumIx = ({
    relaunch,
    pool,
    oldMint,
    baseOut,
    maxQuoteIn,
  }: {
    relaunch: PublicKey;
    pool: RaydiumPool;
    oldMint: PublicKey;
    baseOut: bigint;
    maxQuoteIn: bigint;
  }) =>
    client.depositViaBuyRaydiumIx({
      relaunch,
      oldMint,
      sourceQuoteMint: token.NATIVE_MINT,
      sourcePool: pool.pool,
      ammCoinVault: pool.coinVault,
      ammPcVault: pool.pcVault,
      baseOut: new BN(baseOut.toString()),
      maxQuoteIn: new BN(maxQuoteIn.toString()),
    });

  it("buys exact base_out off the Raydium pool, credits it, and refunds exactly the unspent quote", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    const wsolAta = await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);
    const maxQuoteIn = 2n * 10n ** 9n;

    await depositViaBuyRaydiumIx({
      relaunch,
      pool,
      oldMint,
      baseOut: BASE_OUT,
      maxQuoteIn,
    }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), BASE_OUT.toString());
    assert.equal(storedRelaunch.seqNum.toString(), "2");

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.relaunch.equals(relaunch));
    assert.isTrue(record.depositor.equals(this.payer.publicKey));
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());
    assert.isFalse(record.claimed);
    assert.equal(record.seqNum.toString(), "0");
    const [, recordBump] = getDepositRecordAddr({
      programId: client.getProgramId(),
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.pdaBump, recordBump);

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // Default orientation puts the token on the pc side, WSOL on coin.
    const poolTokenBalance = await tokenBalance(this.banksClient, pool.pcVault);
    assert.equal(
      poolTokenBalance.toString(),
      (POOL_BASE_RESERVE - BASE_OUT).toString(),
    );

    // The exact refund: the buy consumed exactly the exact-out input and
    // everything above it returned to the depositor.
    const predictedIn = raydiumExactOutInput(
      BASE_OUT,
      WSOL_POOL_QUOTE_RESERVE,
      POOL_BASE_RESERVE,
    );
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    assert.equal((wsolBefore - wsolAfter).toString(), predictedIn.toString());

    // The fee stays in the pool: the coin vault gains the full input.
    const poolQuoteBalance = await tokenBalance(
      this.banksClient,
      pool.coinVault,
    );
    assert.equal(
      poolQuoteBalance.toString(),
      (WSOL_POOL_QUOTE_RESERVE + predictedIn).toString(),
    );

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(quoteVaultBalance.toString(), "0");
  });

  it("computes max_quote_in from pool reserves when omitted", async function () {
    const { relaunch } = await setupLiveRelaunch.call(this);
    // Pre-fund past any computable cap so the wrap path stays out of the
    // picture and the spend is a clean delta.
    const wsolAta = await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);

    await client.depositViaBuy({
      relaunch,
      baseOut: new BN(BASE_OUT.toString()),
    });

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    const { oldTokenVault } = await client.fetchRelaunch(relaunch);
    const vaultBalance = await tokenBalance(this.banksClient, oldTokenVault);
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The computed cap is the exact-out input plus the default 100 bps of
    // slippage; the CPI pulls exactly the formula input and the cushion
    // never leaves the depositor.
    const predictedIn = raydiumExactOutInput(
      BASE_OUT,
      WSOL_POOL_QUOTE_RESERVE,
      POOL_BASE_RESERVE,
    );
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    assert.equal((wsolBefore - wsolAfter).toString(), predictedIn.toString());
  });

  it("wraps the depositor's SOL shortfall", async function () {
    const { relaunch } = await setupLiveRelaunch.call(this);

    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      this.payer.publicKey,
    );
    // Whatever WSOL is left over from earlier tests, this max_quote_in
    // forces a 2-SOL shortfall that the convenience method must wrap.
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);
    const maxQuoteIn = wsolBefore + 2n * 10n ** 9n;

    await client.depositViaBuy({
      relaunch,
      baseOut: new BN(BASE_OUT.toString()),
      maxQuoteIn: new BN(maxQuoteIn.toString()),
    });

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    const { oldTokenVault } = await client.fetchRelaunch(relaunch);
    const vaultBalance = await tokenBalance(this.banksClient, oldTokenVault);
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The wrap topped the ATA up to exactly max_quote_in before the buy
    // spent from it, so the remainder is max_quote_in minus the exact-out
    // input.
    const predictedIn = raydiumExactOutInput(
      BASE_OUT,
      WSOL_POOL_QUOTE_RESERVE,
      POOL_BASE_RESERVE,
    );
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    assert.equal((maxQuoteIn - wsolAfter).toString(), predictedIn.toString());
  });

  it("accumulates buy-deposits and direct deposits in the same record", async function () {
    const { relaunch, pool, oldMint, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);

    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(100_000_000), // 100 tokens
      })
      .rpc();
    await depositViaBuyRaydiumIx({
      relaunch,
      pool,
      oldMint,
      baseOut: 50n * 10n ** 6n, // 50 tokens
      maxQuoteIn: 10n ** 9n,
    }).rpc();
    // A second buy exercises the existing-record branch.
    await depositViaBuyRaydiumIx({
      relaunch,
      pool,
      oldMint,
      baseOut: 25n * 10n ** 6n, // 25 tokens
      maxQuoteIn: 10n ** 9n,
    }).rpc();

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), "175000000");
    assert.equal(record.seqNum.toString(), "2");

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "175000000");
    assert.equal(storedRelaunch.seqNum.toString(), "4");

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(vaultBalance.toString(), "175000000");
  });

  it("fails when max_quote_in is too tight", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    const wsolAta = await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);

    const predictedIn = raydiumExactOutInput(
      BASE_OUT,
      WSOL_POOL_QUOTE_RESERVE,
      POOL_BASE_RESERVE,
    );
    try {
      await depositViaBuyRaydiumIx({
        relaunch,
        pool,
        oldMint,
        baseOut: BASE_OUT,
        maxQuoteIn: predictedIn - 1n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {}

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "0");

    const depositRecord = client.getDepositRecordAddress({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isNull(await this.banksClient.getAccount(depositRecord));

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(vaultBalance.toString(), "0");

    // The whole transaction reverted, including the quote pull.
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    assert.equal(wsolAfter.toString(), wsolBefore.toString());
  });

  it("fails to buy zero tokens", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyRaydiumIx({
        relaunch,
        pool,
        oldMint,
        baseOut: 0n,
        maxQuoteIn: 10n ** 9n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidAmount");
    }
  });

  it("fails with a zero max_quote_in", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyRaydiumIx({
        relaunch,
        pool,
        oldMint,
        baseOut: BASE_OUT,
        maxQuoteIn: 0n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidAmount");
    }
  });

  it("fails before deposits start", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this, {
      start: false,
    });
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyRaydiumIx({
        relaunch,
        pool,
        oldMint,
        baseOut: BASE_OUT,
        maxQuoteIn: 10n ** 9n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotLive");
    }
  });

  it("fails after the deposit window closes", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);
    await this.advanceBySeconds(ONE_WEEK);

    try {
      await depositViaBuyRaydiumIx({
        relaunch,
        pool,
        oldMint,
        baseOut: BASE_OUT,
        maxQuoteIn: 10n ** 9n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "DepositWindowClosed");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "0");
  });

  it("refunds buy-credited tokens as old tokens after the relaunch fails", async function () {
    const { relaunch, pool, oldMint, payerOldTokenAccount } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);

    await depositViaBuyRaydiumIx({
      relaunch,
      pool,
      oldMint,
      baseOut: BASE_OUT,
      maxQuoteIn: 2n * 10n ** 9n,
    }).rpc();

    // 10k tokens misses the 10% threshold of the 1B supply.
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);

    const oldBalanceBefore = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
    );

    await client.claimRefund({ relaunch });

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.claimed);

    // The buy is not unwound: the depositor is refunded the old tokens the
    // buy acquired.
    const oldBalanceAfter = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      (oldBalanceAfter - oldBalanceBefore).toString(),
      BASE_OUT.toString(),
    );

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(vaultBalance.toString(), "0");
  });

  it("fails when the pump-venue deposit_via_buy is called on a Raydium-source relaunch", async function () {
    const { relaunch, pool, oldMint, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    const { protocolFeeRecipient, buybackFeeRecipient } =
      await getPumpFeeRecipients(this.connection);

    try {
      // The pump-specific accounts are unchecked until the CPI, so arbitrary
      // stand-ins get the instruction as far as the venue gate.
      await client
        .depositViaBuyIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          poolBaseTokenAccount: pool.pcVault,
          poolQuoteTokenAccount: pool.coinVault,
          coinCreator: Keypair.generate().publicKey,
          protocolFeeRecipient,
          buybackFeeRecipient,
          baseOut: new BN(BASE_OUT.toString()),
          maxQuoteIn: new BN((10n ** 9n).toString()),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "WrongSourceVenue");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "0");
  });

  it("fails when deposit_via_buy_raydium is called on a PumpSwap-source relaunch", async function () {
    const { oldMint } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: token.TOKEN_PROGRAM_ID,
    });
    const { relaunch } = await client.initializeRelaunch({
      oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    });
    await client.startDepositsIx({ relaunch }).rpc();
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await client
        .depositViaBuyRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.poolQuoteTokenAccount,
          ammPcVault: pool.poolBaseTokenAccount,
          baseOut: new BN(BASE_OUT.toString()),
          maxQuoteIn: new BN((10n ** 9n).toString()),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "WrongSourceVenue");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "0");
  });
}
