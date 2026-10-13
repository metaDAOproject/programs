import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BanksClient } from "solana-bankrun";
import { getPumpFeeRecipients, RelaunchClient } from "@metadaoproject/programs";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool, PumpPool } from "../pumpAmm.js";
import { writeRaydiumPool, RaydiumPool } from "../raydiumAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const DEFAULT_THRESHOLD_BPS = 1000;
// 10% of the 1B-token default supply = 100M tokens.
const DEPOSIT_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

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

// The exact output of selling the deposited amount at AMM v4's flat 25 bps
// fee (ceil-rounded off the input, kept in the pool).
function predictedQuoteOut(): bigint {
  const net = DEPOSIT_AMOUNT - ceilDiv(DEPOSIT_AMOUNT * 25n, 10_000n);
  return (WSOL_POOL_QUOTE_RESERVE * net) / (POOL_BASE_RESERVE + net);
}

export default function suite() {
  let client: RelaunchClient;

  before(function () {
    client = this.relaunch;
  });

  const runToSellPending = async function (
    this: Mocha.Context,
    {
      oldMint,
      sourcePool,
      close,
    }: { oldMint: PublicKey; sourcePool: PublicKey; close: boolean },
  ): Promise<PublicKey> {
    const { relaunch } = await client.initializeRelaunch({
      oldMint,
      sourcePool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: DEFAULT_THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram: token.TOKEN_PROGRAM_ID,
        amount: new BN(DEPOSIT_AMOUNT.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    if (close) {
      await client.closeDepositsIx({ relaunch }).rpc();
    }

    return relaunch;
  };

  const setupRaydiumSellPending = async function (
    this: Mocha.Context,
    { close = true }: { close?: boolean } = {},
  ): Promise<{ relaunch: PublicKey; pool: RaydiumPool; oldMint: PublicKey }> {
    const { oldMint } = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = writeRaydiumPool({
      context: this.context,
      oldMint,
      tokenReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });
    const relaunch = await runToSellPending.call(this, {
      oldMint,
      sourcePool: pool.pool,
      close,
    });
    return { relaunch, pool, oldMint };
  };

  const setupPumpSellPending = async function (
    this: Mocha.Context,
  ): Promise<{ relaunch: PublicKey; pool: PumpPool; oldMint: PublicKey }> {
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
    const relaunch = await runToSellPending.call(this, {
      oldMint,
      sourcePool: pool.pool,
      close: true,
    });
    return { relaunch, pool, oldMint };
  };

  it("sells the old-token vault into the Raydium pool and lands in Sold with exact constant-product proceeds", async function () {
    const { relaunch, pool } = await setupRaydiumSellPending.call(this);

    await client.executeSell({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(oldVaultBalance.toString(), "0");

    // Default orientation puts the token on the pc side; the full input,
    // fee included, lands in the pool.
    const poolTokenBalance = await tokenBalance(this.banksClient, pool.pcVault);
    assert.equal(
      poolTokenBalance.toString(),
      (POOL_BASE_RESERVE + DEPOSIT_AMOUNT).toString(),
    );

    const predicted = predictedQuoteOut();
    assert.equal(
      storedRelaunch.quoteRecovered.toString(),
      predicted.toString(),
    );

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(quoteVaultBalance.toString(), predicted.toString());

    const poolQuoteBalance = await tokenBalance(
      this.banksClient,
      pool.coinVault,
    );
    assert.equal(
      poolQuoteBalance.toString(),
      (WSOL_POOL_QUOTE_RESERVE - predicted).toString(),
    );

    assert.equal(storedRelaunch.usdcRecovered.toString(), "0");
    assert.equal(storedRelaunch.seqNum.toString(), "4");
  });

  it("fails when min_quote_out is above the achievable proceeds, leaving state unchanged", async function () {
    const { relaunch } = await setupRaydiumSellPending.call(this);

    try {
      // The whole quote reserve is unreachable output for any sell.
      await client.executeSell({
        relaunch,
        minQuoteOut: new BN(WSOL_POOL_QUOTE_RESERVE.toString()),
      });
      assert.fail("Should have thrown error");
    } catch (e) {}

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
    assert.equal(storedRelaunch.quoteRecovered.toString(), "0");

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(oldVaultBalance.toString(), DEPOSIT_AMOUNT.toString());

    // The same sell with a live floor succeeds, so only the floor differed.
    await client.executeSell({ relaunch });
    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
  });

  it("fails when a non-admin executes the sell", async function () {
    const { relaunch, pool, oldMint } =
      await setupRaydiumSellPending.call(this);
    const nonAdmin = Keypair.generate();

    try {
      await client
        .executeSellRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.coinVault,
          ammPcVault: pool.pcVault,
          minQuoteOut: new BN(0),
          admin: nonAdmin.publicKey,
        })
        .signers([nonAdmin])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintHasOne");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("fails before deposits close", async function () {
    const { relaunch } = await setupRaydiumSellPending.call(this, {
      close: false,
    });

    try {
      await client.executeSell({ relaunch });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSellPending");
    }
  });

  it("fails when the sell has already been executed", async function () {
    const { relaunch } = await setupRaydiumSellPending.call(this);

    await client.executeSell({ relaunch });

    try {
      await client.executeSell({ relaunch, minQuoteOut: new BN(1) });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSellPending");
    }
  });

  it("fails after the grace period elapses", async function () {
    const { relaunch } = await setupRaydiumSellPending.call(this);
    await this.advanceBySeconds(ONE_DAY + 1);

    try {
      await client.executeSell({ relaunch });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "GracePeriodElapsed");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
    );
    assert.equal(oldVaultBalance.toString(), DEPOSIT_AMOUNT.toString());
  });

  it("fails when the pump-venue execute_sell is called on a Raydium-source relaunch", async function () {
    const { relaunch, pool, oldMint } =
      await setupRaydiumSellPending.call(this);

    const { protocolFeeRecipient, buybackFeeRecipient } =
      await getPumpFeeRecipients(this.connection);

    try {
      // The pump-specific accounts are unchecked until the CPI, so arbitrary
      // stand-ins get the instruction as far as the venue gate.
      await client
        .executeSellIx({
          relaunch,
          oldMint,
          oldTokenProgram: token.TOKEN_PROGRAM_ID,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          poolBaseTokenAccount: pool.pcVault,
          poolQuoteTokenAccount: pool.coinVault,
          coinCreator: Keypair.generate().publicKey,
          protocolFeeRecipient,
          buybackFeeRecipient,
          minQuoteOut: new BN(0),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "WrongSourceVenue");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("fails when execute_sell_raydium is called on a PumpSwap-source relaunch", async function () {
    const { relaunch, pool, oldMint } = await setupPumpSellPending.call(this);

    try {
      await client
        .executeSellRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.poolQuoteTokenAccount,
          ammPcVault: pool.poolBaseTokenAccount,
          minQuoteOut: new BN(0),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "WrongSourceVenue");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("fails when the passed coin/pc vault accounts do not match the pool's stored vaults", async function () {
    const { relaunch, pool, oldMint } =
      await setupRaydiumSellPending.call(this);

    // Swapped vaults: the coin-vault pin fails first.
    try {
      await client
        .executeSellRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.pcVault,
          ammPcVault: pool.coinVault,
          minQuoteOut: new BN(0),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "SourcePoolNotCanonical");
    }

    // A foreign token account in the pc slot.
    const storedRelaunch = await client.fetchRelaunch(relaunch);
    try {
      await client
        .executeSellRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.coinVault,
          ammPcVault: storedRelaunch.sourceQuoteVault,
          minQuoteOut: new BN(0),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "SourcePoolNotCanonical");
    }

    assert.isDefined((await client.fetchRelaunch(relaunch)).state.sellPending);
  });
}
