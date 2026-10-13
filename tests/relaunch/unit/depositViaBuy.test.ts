import { PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BanksClient } from "solana-bankrun";
import {
  getDepositRecordAddr,
  getPumpFeeRecipients,
  MAINNET_USDC,
  RelaunchClient,
} from "@metadaoproject/programs";
import { setupRelaunch } from "../utils.js";
import {
  getUserVolumeAccumulatorAddr,
  writePumpPool,
  PumpPool,
} from "../pumpAmm.js";
import { wrapSol } from "../whirlpool.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const BASE_OUT = 10_000n * 10n ** 6n; // 10k old tokens

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

// The constant-product input for an exact-output buy, before fees.
function grossQuoteIn(quoteReserve: bigint, baseOut: bigint): bigint {
  return (quoteReserve * baseOut) / (POOL_BASE_RESERVE - baseOut);
}

export default function suite() {
  let client: RelaunchClient;
  let protocolFeeRecipient: PublicKey;
  let buybackFeeRecipient: PublicKey;

  before(async function () {
    client = this.relaunch;
    // Both recipients come from the loaded global-config fixture, so one
    // fetch serves the whole suite.
    ({ protocolFeeRecipient, buybackFeeRecipient } = await getPumpFeeRecipients(
      this.connection,
    ));
  });

  const setupLiveRelaunch = async function (
    this: Mocha.Context,
    {
      quoteMint = token.NATIVE_MINT,
      oldTokenProgram = token.TOKEN_PROGRAM_ID,
      start = true,
    }: {
      quoteMint?: PublicKey;
      oldTokenProgram?: PublicKey;
      start?: boolean;
    } = {},
  ): Promise<{
    relaunch: PublicKey;
    pool: PumpPool;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    payerOldTokenAccount: PublicKey;
  }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldTokenProgram,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: quoteMint.equals(token.NATIVE_MINT)
        ? WSOL_POOL_QUOTE_RESERVE
        : USDC_POOL_QUOTE_RESERVE,
      baseTokenProgram: oldTokenProgram,
    });

    const { relaunch } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: quoteMint,
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

  const depositViaBuyIx = ({
    relaunch,
    pool,
    oldTokenProgram,
    baseOut,
    maxQuoteIn,
  }: {
    relaunch: PublicKey;
    pool: PumpPool;
    oldTokenProgram: PublicKey;
    baseOut: bigint;
    maxQuoteIn: bigint;
  }) =>
    client.depositViaBuyIx({
      relaunch,
      oldMint: pool.baseMint,
      oldTokenProgram,
      sourceQuoteMint: pool.quoteMint,
      sourcePool: pool.pool,
      poolBaseTokenAccount: pool.poolBaseTokenAccount,
      poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
      coinCreator: pool.coinCreator,
      protocolFeeRecipient,
      buybackFeeRecipient,
      baseOut: new BN(baseOut.toString()),
      maxQuoteIn: new BN(maxQuoteIn.toString()),
    });

  it("buys old tokens off a WSOL-quoted pool and credits them as a deposit", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    const wsolAta = await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);
    const maxQuoteIn = 2n * 10n ** 9n;

    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
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
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    const poolBaseBalance = await tokenBalance(
      this.banksClient,
      pool.poolBaseTokenAccount,
      oldTokenProgram,
    );
    assert.equal(
      poolBaseBalance.toString(),
      (POOL_BASE_RESERVE - BASE_OUT).toString(),
    );

    // The unspent quote was refunded: the cost stays within a few percent of
    // the constant-product input, and the vault keeps none of the pull.
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    const spent = wsolBefore - wsolAfter;
    const gross = grossQuoteIn(WSOL_POOL_QUOTE_RESERVE, BASE_OUT);
    assert.isTrue(spent >= gross && spent < (gross * 103n) / 100n);
    assert.isTrue(spent < maxQuoteIn);

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(quoteVaultBalance.toString(), "0");

    // The first buy created the relaunch signer's volume accumulator.
    const userVolumeAccumulator = await this.banksClient.getAccount(
      getUserVolumeAccumulatorAddr(
        client.getRelaunchSignerAddress({ relaunch }),
      ),
    );
    assert.isNotNull(userVolumeAccumulator);
  });

  it("buys old tokens off a USDC-quoted pool and credits them as a deposit", async function () {
    const { relaunch, pool, oldTokenProgram } = await setupLiveRelaunch.call(
      this,
      { quoteMint: MAINNET_USDC },
    );
    const usdcAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const usdcBefore = await tokenBalance(this.banksClient, usdcAta);
    const maxQuoteIn = 2_000n * 10n ** 6n; // 2k USDC

    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
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
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    const poolBaseBalance = await tokenBalance(
      this.banksClient,
      pool.poolBaseTokenAccount,
      oldTokenProgram,
    );
    assert.equal(
      poolBaseBalance.toString(),
      (POOL_BASE_RESERVE - BASE_OUT).toString(),
    );

    const usdcAfter = await tokenBalance(this.banksClient, usdcAta);
    const spent = usdcBefore - usdcAfter;
    const gross = grossQuoteIn(USDC_POOL_QUOTE_RESERVE, BASE_OUT);
    assert.isTrue(spent >= gross && spent < (gross * 103n) / 100n);
    assert.isTrue(spent < maxQuoteIn);

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(quoteVaultBalance.toString(), "0");

    const userVolumeAccumulator = await this.banksClient.getAccount(
      getUserVolumeAccumulatorAddr(
        client.getRelaunchSignerAddress({ relaunch }),
      ),
    );
    assert.isNotNull(userVolumeAccumulator);
  });

  it("computes max_quote_in from pool reserves when omitted", async function () {
    const { relaunch, oldTokenProgram } = await setupLiveRelaunch.call(this, {
      quoteMint: MAINNET_USDC,
    });

    const usdcAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const usdcBefore = await tokenBalance(this.banksClient, usdcAta);

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
    const vaultBalance = await tokenBalance(
      this.banksClient,
      oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The computed cap is the constant-product input plus the default
    // 100 bps of slippage, which the actual cost stays within.
    const usdcAfter = await tokenBalance(this.banksClient, usdcAta);
    const spent = usdcBefore - usdcAfter;
    const gross = grossQuoteIn(USDC_POOL_QUOTE_RESERVE, BASE_OUT);
    const computedCap = (gross * 10_100n) / 10_000n;
    assert.isTrue(spent >= gross && spent <= computedCap);
  });

  it("wraps the depositor's SOL shortfall for WSOL-quoted buys", async function () {
    const { relaunch, oldTokenProgram } = await setupLiveRelaunch.call(this);

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
    const vaultBalance = await tokenBalance(
      this.banksClient,
      oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The wrap topped the ATA up to exactly max_quote_in before the buy
    // spent from it, so the remainder is max_quote_in minus the cost.
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    const spent = maxQuoteIn - wsolAfter;
    const gross = grossQuoteIn(WSOL_POOL_QUOTE_RESERVE, BASE_OUT);
    assert.isTrue(spent >= gross && spent < (gross * 103n) / 100n);
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
    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
      baseOut: 50n * 10n ** 6n, // 50 tokens
      maxQuoteIn: 10n ** 9n,
    }).rpc();
    // A second buy exercises the existing-accumulator and existing-record
    // branches.
    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
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
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), "175000000");
  });

  it("buys a Token-2022 old token", async function () {
    const { relaunch, pool, oldTokenProgram } = await setupLiveRelaunch.call(
      this,
      { oldTokenProgram: token.TOKEN_2022_PROGRAM_ID },
    );
    await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);

    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
      baseOut: BASE_OUT,
      maxQuoteIn: 2n * 10n ** 9n,
    }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), BASE_OUT.toString());

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());
  });

  it("fails when max_quote_in is too tight, crediting nothing", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);

    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      this.payer.publicKey,
    );
    const wsolBefore = await tokenBalance(this.banksClient, wsolAta);

    const gross = grossQuoteIn(WSOL_POOL_QUOTE_RESERVE, BASE_OUT);
    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
        baseOut: BASE_OUT,
        maxQuoteIn: (gross * 90n) / 100n,
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
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), "0");

    // The whole transaction reverted, including the quote pull.
    const wsolAfter = await tokenBalance(this.banksClient, wsolAta);
    assert.equal(wsolAfter.toString(), wsolBefore.toString());
  });

  it("fails to buy zero tokens", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
        baseOut: 0n,
        maxQuoteIn: 10n ** 9n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidAmount");
    }
  });

  it("fails with a zero max_quote_in", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
        baseOut: BASE_OUT,
        maxQuoteIn: 0n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidAmount");
    }
  });

  it("fails when the depositor's quote balance is insufficient", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    const wsolBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        token.NATIVE_MINT,
        this.payer.publicKey,
      ),
    );
    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
        baseOut: BASE_OUT,
        maxQuoteIn: wsolBalance + 1n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InsufficientFunds");
    }
  });

  it("fails before deposits start", async function () {
    const { relaunch, pool, oldTokenProgram } = await setupLiveRelaunch.call(
      this,
      { start: false },
    );
    await wrapSol(client.provider, this.payer, 10n ** 9n);

    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
        baseOut: BASE_OUT,
        maxQuoteIn: 10n ** 9n,
      }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotLive");
    }
  });

  it("fails after the deposit window closes", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 10n ** 9n);
    await this.advanceBySeconds(ONE_WEEK);

    try {
      await depositViaBuyIx({
        relaunch,
        pool,
        oldTokenProgram,
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
    const { relaunch, pool, oldTokenProgram, payerOldTokenAccount } =
      await setupLiveRelaunch.call(this);
    await wrapSol(client.provider, this.payer, 2n * 10n ** 9n);

    await depositViaBuyIx({
      relaunch,
      pool,
      oldTokenProgram,
      baseOut: BASE_OUT,
      maxQuoteIn: 2n * 10n ** 9n,
    }).rpc();

    // 10k tokens misses the 10% threshold of the 1B supply.
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);

    const oldBalanceBefore = await tokenBalance(
      this.banksClient,
      payerOldTokenAccount,
      oldTokenProgram,
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
      oldTokenProgram,
    );
    assert.equal(
      (oldBalanceAfter - oldBalanceBefore).toString(),
      BASE_OUT.toString(),
    );

    const vaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(vaultBalance.toString(), "0");
  });
}
