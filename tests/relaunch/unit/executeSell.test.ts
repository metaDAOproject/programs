import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BanksClient } from "solana-bankrun";
import { MAINNET_USDC, RelaunchClient } from "@metadaoproject/programs";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import {
  getBuybackFeeRecipients,
  getProtocolFeeRecipient,
  writePumpPool,
  PumpPool,
} from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const DEFAULT_THRESHOLD_BPS = 1000;
// 10% of the 1B-token default supply = 100M tokens.
const DEPOSIT_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

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

// The constant-product output of selling the deposited amount, before fees.
function grossQuoteOut(quoteReserve: bigint): bigint {
  return (quoteReserve * DEPOSIT_AMOUNT) / (POOL_BASE_RESERVE + DEPOSIT_AMOUNT);
}

export default function suite() {
  let client: RelaunchClient;

  before(function () {
    client = this.relaunch;
  });

  const setupSellPendingRelaunch = async function (
    this: Mocha.Context,
    {
      quoteMint = token.NATIVE_MINT,
      oldTokenProgram = token.TOKEN_PROGRAM_ID,
      close = true,
    }: {
      quoteMint?: PublicKey;
      oldTokenProgram?: PublicKey;
      close?: boolean;
    } = {},
  ): Promise<{
    relaunch: PublicKey;
    pool: PumpPool;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
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
      thresholdBps: DEFAULT_THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();
    await client
      .depositIx({
        relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram,
        amount: new BN(DEPOSIT_AMOUNT.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    if (close) {
      await client.closeDepositsIx({ relaunch }).rpc();
    }

    return { ...setup, pool, relaunch };
  };

  it("sells the old-token vault into a WSOL-quoted pool and lands in Sold", async function () {
    const { relaunch, pool, oldTokenProgram } =
      await setupSellPendingRelaunch.call(this);

    await client.executeSell({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(oldVaultBalance.toString(), "0");

    const poolBaseBalance = await tokenBalance(
      this.banksClient,
      pool.poolBaseTokenAccount,
      oldTokenProgram,
    );
    assert.equal(
      poolBaseBalance.toString(),
      (POOL_BASE_RESERVE + DEPOSIT_AMOUNT).toString(),
    );

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(
      storedRelaunch.quoteRecovered.toString(),
      quoteVaultBalance.toString(),
    );

    // The proceeds are the constant-product output minus pump's fees.
    const gross = grossQuoteOut(WSOL_POOL_QUOTE_RESERVE);
    const quoteRecovered = BigInt(storedRelaunch.quoteRecovered.toString());
    assert.isTrue(quoteRecovered > (gross * 97n) / 100n);
    assert.isTrue(quoteRecovered <= gross);

    assert.equal(storedRelaunch.usdcRecovered.toString(), "0");
    assert.equal(storedRelaunch.seqNum.toString(), "4");
  });

  it("jumps straight to Swapped for a USDC-quoted pool", async function () {
    const { relaunch, oldTokenProgram } = await setupSellPendingRelaunch.call(
      this,
      { quoteMint: MAINNET_USDC },
    );

    await client.executeSell({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.swapped);

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(oldVaultBalance.toString(), "0");

    assert.equal(
      storedRelaunch.usdcRecovered.toString(),
      storedRelaunch.quoteRecovered.toString(),
    );

    const usdcVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.usdcVault,
    );
    assert.equal(
      storedRelaunch.usdcRecovered.toString(),
      usdcVaultBalance.toString(),
    );

    const gross = grossQuoteOut(USDC_POOL_QUOTE_RESERVE);
    const usdcRecovered = BigInt(storedRelaunch.usdcRecovered.toString());
    assert.isTrue(usdcRecovered > (gross * 97n) / 100n);
    assert.isTrue(usdcRecovered <= gross);
  });

  it("sells a Token-2022 old token correctly", async function () {
    const { relaunch, oldTokenProgram } = await setupSellPendingRelaunch.call(
      this,
      { oldTokenProgram: token.TOKEN_2022_PROGRAM_ID },
    );

    await client.executeSell({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);

    const oldVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.oldTokenVault,
      oldTokenProgram,
    );
    assert.equal(oldVaultBalance.toString(), "0");

    const quoteVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(
      storedRelaunch.quoteRecovered.toString(),
      quoteVaultBalance.toString(),
    );
  });

  it("fails when min_quote_out is above the achievable proceeds, leaving state unchanged", async function () {
    const { relaunch, oldTokenProgram } =
      await setupSellPendingRelaunch.call(this);

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
      oldTokenProgram,
    );
    assert.equal(oldVaultBalance.toString(), DEPOSIT_AMOUNT.toString());

    // The same sell with a live floor succeeds, so only the floor differed.
    await client.executeSell({ relaunch });
    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
  });

  it("fails when a non-admin executes the sell", async function () {
    const { relaunch, pool, oldMint, oldTokenProgram } =
      await setupSellPendingRelaunch.call(this);
    const nonAdmin = Keypair.generate();

    try {
      await client
        .executeSellIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          poolBaseTokenAccount: pool.poolBaseTokenAccount,
          poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
          coinCreator: pool.coinCreator,
          protocolFeeRecipient: await getProtocolFeeRecipient(this.banksClient),
          buybackFeeRecipient: (
            await getBuybackFeeRecipients(this.banksClient)
          )[0],
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
    const { relaunch } = await setupSellPendingRelaunch.call(this, {
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
    const { relaunch } = await setupSellPendingRelaunch.call(this);

    await client.executeSell({ relaunch });

    try {
      await client.executeSell({ relaunch, minQuoteOut: new BN(1) });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSellPending");
    }
  });

  it("fails after the grace period elapses", async function () {
    const { relaunch, oldTokenProgram } =
      await setupSellPendingRelaunch.call(this);
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
      oldTokenProgram,
    );
    assert.equal(oldVaultBalance.toString(), DEPOSIT_AMOUNT.toString());
  });
}
