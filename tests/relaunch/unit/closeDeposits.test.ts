import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { RelaunchClient } from "@metadaoproject/programs";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

// 10% of the 1B-token default supply = 100M tokens.
const DEFAULT_THRESHOLD_BPS = 1000;
const DEFAULT_THRESHOLD_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

export default function suite() {
  let client: RelaunchClient;
  let oldMint: PublicKey;
  let oldTokenProgram: PublicKey;
  let relaunch: PublicKey;

  before(function () {
    client = this.relaunch;
  });

  const setupLiveRelaunch = async function (
    this: Mocha.Context,
    {
      thresholdBps = DEFAULT_THRESHOLD_BPS,
      oldSupply,
      start = true,
    }: { thresholdBps?: number; oldSupply?: bigint; start?: boolean } = {},
  ) {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldSupply,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
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
      thresholdBps,
      teamAddress: this.payer.publicKey,
    });

    if (start) {
      await client.startDepositsIx({ relaunch }).rpc();
    }

    return { ...setup, relaunch };
  };

  const deposit = async function (this: Mocha.Context, amount: bigint) {
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(amount.toString()),
      })
      .rpc();
  };

  beforeEach(async function () {
    ({ oldMint, oldTokenProgram, relaunch } =
      await setupLiveRelaunch.call(this));
  });

  it("closes into SellPending when deposits exactly meet the threshold", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await this.advanceBySeconds(ONE_WEEK);

    const clock = await this.banksClient.getClock();
    await client.closeDepositsIx({ relaunch }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
    assert.equal(
      storedRelaunch.unixTimestampClosed.toString(),
      clock.unixTimestamp.toString(),
    );
    assert.equal(storedRelaunch.seqNum.toString(), "3");
  });

  it("closes into Failed when deposits are one base unit short", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT - 1n);
    await this.advanceBySeconds(ONE_WEEK);

    await client.closeDepositsIx({ relaunch }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);
    assert.isNotNull(storedRelaunch.unixTimestampClosed);
  });

  it("fails before the deposit window elapses", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await this.advanceBySeconds(ONE_WEEK - 10);

    try {
      // The compute-unit-limit instruction makes the transaction hash unique
      // so the later successful close isn't rejected as a duplicate.
      await client
        .closeDepositsIx({ relaunch })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "DepositWindowStillOpen");
    }

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.live);
    assert.isNull(storedRelaunch.unixTimestampClosed);

    // The window closes exactly at started + seconds_for_deposits.
    await this.advanceBySeconds(10);
    await client.closeDepositsIx({ relaunch }).rpc();

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("fails when deposits are already closed", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await this.advanceBySeconds(ONE_WEEK);

    await client.closeDepositsIx({ relaunch }).rpc();

    try {
      // The compute-unit-limit instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first call.
      await client
        .closeDepositsIx({ relaunch })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotLive");
    }
  });

  it("fails before deposits start", async function () {
    const setup = await setupLiveRelaunch.call(this, { start: false });
    await this.advanceBySeconds(ONE_WEEK);

    try {
      await client.closeDepositsIx({ relaunch: setup.relaunch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotLive");
    }
  });

  it("computes the threshold in u128 when the multiplication overflows u64", async function () {
    // 10_000 bps × a 10^16 raw supply is 10^20, above u64::MAX (~1.8 × 10^19).
    const hugeSupply = 10n ** 16n;
    const setup = await setupLiveRelaunch.call(this, {
      thresholdBps: 10_000,
      oldSupply: hugeSupply,
    });

    await client
      .depositIx({
        relaunch: setup.relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram: setup.oldTokenProgram,
        amount: new BN(hugeSupply.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);

    await client.closeDepositsIx({ relaunch: setup.relaunch }).rpc();

    const storedRelaunch = await client.fetchRelaunch(setup.relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("lets any keypair crank the close", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await this.advanceBySeconds(ONE_WEEK);

    const cranker = Keypair.generate();
    const fund = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: cranker.publicKey,
        lamports: LAMPORTS_PER_SOL,
      }),
    );
    fund.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fund.feePayer = this.payer.publicKey;
    fund.sign(this.payer);
    await this.banksClient.processTransaction(fund);

    const tx = new Transaction().add(
      await client.closeDepositsIx({ relaunch }).instruction(),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = cranker.publicKey;
    tx.sign(cranker);
    await this.banksClient.processTransaction(tx);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });
}
