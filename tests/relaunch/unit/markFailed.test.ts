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

  beforeEach(async function () {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    oldMint = setup.oldMint;
    oldTokenProgram = setup.oldTokenProgram;

    const pool = await writePumpPool({
      context: this.context,
      baseMint: oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    ({ relaunch } = await client.initializeRelaunch({
      oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: DEFAULT_THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    }));

    await client.startDepositsIx({ relaunch }).rpc();
  });

  const closeIntoSellPending = async function (this: Mocha.Context) {
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(DEFAULT_THRESHOLD_AMOUNT.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
  };

  it("marks the relaunch failed once the grace period has elapsed", async function () {
    await closeIntoSellPending.call(this);
    await this.advanceBySeconds(ONE_DAY + 1);

    await client.markFailedIx({ relaunch }).rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);
    assert.equal(storedRelaunch.seqNum.toString(), "4");
  });

  it("fails until the grace period fully elapses", async function () {
    await closeIntoSellPending.call(this);

    // The last second of the grace period still belongs to the admin's sell
    // window, so exactly closed + grace must fail.
    await this.advanceBySeconds(ONE_DAY);

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the later successful call isn't rejected as a duplicate.
      await client
        .markFailedIx({ relaunch })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "GracePeriodStillActive");
    }

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);

    await this.advanceBySeconds(1);
    await client.markFailedIx({ relaunch }).rpc();

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);
  });

  it("fails when the relaunch is Live", async function () {
    await this.advanceBySeconds(ONE_WEEK + ONE_DAY + 1);

    try {
      await client.markFailedIx({ relaunch }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSellPending");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.live);
  });

  it("fails when the relaunch is already Failed", async function () {
    await closeIntoSellPending.call(this);
    await this.advanceBySeconds(ONE_DAY + 1);
    await client.markFailedIx({ relaunch }).rpc();

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first call.
      await client
        .markFailedIx({ relaunch })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSellPending");
    }
  });

  it("lets any keypair crank mark_failed", async function () {
    await closeIntoSellPending.call(this);
    await this.advanceBySeconds(ONE_DAY + 1);

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
      await client.markFailedIx({ relaunch }).instruction(),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = cranker.publicKey;
    tx.sign(cranker);
    await this.banksClient.processTransaction(tx);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);
  });
}
