import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { RelaunchClient } from "@metadaoproject/programs";
import { setupRelaunch } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

export default function suite() {
  let client: RelaunchClient;
  let relaunch: PublicKey;

  before(function () {
    client = this.relaunch;
  });

  beforeEach(async function () {
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
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    }));
  });

  it("starts deposits", async function () {
    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.initialized);
    assert.isNull(storedRelaunch.unixTimestampStarted);

    const clock = await this.banksClient.getClock();

    await client.startDepositsIx({ relaunch }).rpc();

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.live);
    assert.equal(
      storedRelaunch.unixTimestampStarted.toString(),
      clock.unixTimestamp.toString(),
    );
    assert.equal(storedRelaunch.seqNum.toString(), "1");
  });

  it("fails when a non-admin starts deposits", async function () {
    const nonAdmin = Keypair.generate();

    try {
      await client
        .startDepositsIx({ relaunch, admin: nonAdmin.publicKey })
        .signers([nonAdmin])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintHasOne");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.initialized);
  });

  it("fails when deposits have already been started", async function () {
    await client.startDepositsIx({ relaunch }).rpc();

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first call.
      await client
        .startDepositsIx({ relaunch })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotInitialized");
    }
  });
}
