import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BankrunProvider } from "anchor-bankrun";
import { BanksClient } from "solana-bankrun";
import {
  getWhirlpoolSwapTickArrayAddrs,
  parseWhirlpool,
  RelaunchClient,
  USDC_SWAP_POOL,
} from "@metadaoproject/programs";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";
import { ensureWhirlpool, WhirlpoolFixture } from "../whirlpool.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
// Small enough that the sell proceeds (~4.9 SOL) swap through the whirlpool
// fixture (1000 SOL / 100k USDC) with well under 1% price impact.
const WSOL_POOL_QUOTE_RESERVE = 5n * 10n ** 9n; // 5 SOL

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

export default function suite() {
  let client: RelaunchClient;
  let whirlpool: WhirlpoolFixture;

  before(async function () {
    client = this.relaunch;
    whirlpool = await ensureWhirlpool({
      provider: new BankrunProvider(this.context) as any,
      payer: this.payer,
      banksClient: this.banksClient,
    });
  });

  // The whirlpool account set the low-level ix builder needs, derived from
  // the pinned pool's live state.
  const swapAccounts = async function (this: Mocha.Context) {
    const raw = await this.banksClient.getAccount(USDC_SWAP_POOL);
    const pool = parseWhirlpool(Buffer.from(raw!.data));
    return {
      whirlpoolWsolVault: pool.tokenVaultA,
      whirlpoolUsdcVault: pool.tokenVaultB,
      tickArrays: getWhirlpoolSwapTickArrayAddrs(
        USDC_SWAP_POOL,
        pool.tickCurrentIndex,
        pool.tickSpacing,
        true,
      ),
    };
  };

  const setupSoldRelaunch = async function (
    this: Mocha.Context,
    { sell = true }: { sell?: boolean } = {},
  ): Promise<{ relaunch: PublicKey }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: setup.oldTokenProgram,
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
      thresholdBps: DEFAULT_THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();
    await client
      .depositIx({
        relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram: setup.oldTokenProgram,
        amount: new BN(DEPOSIT_AMOUNT.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
    if (sell) {
      // 100 bps exactly matches pump's fee on these reserves, leaving no
      // rounding margin; give the setup sell explicit headroom.
      await client.executeSell({ relaunch, slippageBps: 200 });
    }

    return { relaunch };
  };

  it("swaps the whole WSOL vault to USDC and lands in Swapped", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this);

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    const wsolSold = BigInt(storedRelaunch.quoteRecovered.toString());
    const whirlpoolWsolBefore = await tokenBalance(
      this.banksClient,
      whirlpool.tokenVaultA,
    );
    const whirlpoolUsdcBefore = await tokenBalance(
      this.banksClient,
      whirlpool.tokenVaultB,
    );

    await client.executeUsdcSwap({ relaunch });

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.swapped);

    const wsolVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(wsolVaultBalance.toString(), "0");

    const usdcVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.usdcVault,
    );
    assert.equal(
      storedRelaunch.usdcRecovered.toString(),
      usdcVaultBalance.toString(),
    );

    // The output is the spot value (100 USDC/SOL, i.e. one tenth in raw
    // units) minus the 0.04% fee and a little price impact.
    const spotOut = wsolSold / 10n;
    const usdcRecovered = BigInt(storedRelaunch.usdcRecovered.toString());
    assert.isTrue(usdcRecovered > (spotOut * 97n) / 100n);
    assert.isTrue(usdcRecovered <= spotOut);

    // The full WSOL balance went to the whirlpool, and every USDC the
    // whirlpool paid out landed in the relaunch's vault.
    const whirlpoolWsolAfter = await tokenBalance(
      this.banksClient,
      whirlpool.tokenVaultA,
    );
    assert.equal(
      (whirlpoolWsolAfter - whirlpoolWsolBefore).toString(),
      wsolSold.toString(),
    );
    const whirlpoolUsdcAfter = await tokenBalance(
      this.banksClient,
      whirlpool.tokenVaultB,
    );
    assert.equal(
      (whirlpoolUsdcBefore - whirlpoolUsdcAfter).toString(),
      usdcRecovered.toString(),
    );

    assert.equal(storedRelaunch.quoteRecovered.toString(), wsolSold.toString());
    assert.equal(storedRelaunch.seqNum.toString(), "5");
  });

  it("fails when the whirlpool account is not the pinned pool", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this);
    const accounts = await swapAccounts.call(this);

    try {
      await client
        .executeUsdcSwapIx({
          relaunch,
          ...accounts,
          minUsdcOut: new BN(0),
          whirlpool: Keypair.generate().publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintAddress");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
  });

  it("fails when min_usdc_out is above the achievable output", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this);

    try {
      // The whole USDC side of the whirlpool is unreachable output.
      await client.executeUsdcSwap({
        relaunch,
        minUsdcOut: new BN((100_000n * 10n ** 6n).toString()),
      });
      assert.fail("Should have thrown error");
    } catch (e) {}

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
    assert.equal(storedRelaunch.usdcRecovered.toString(), "0");

    const wsolVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.sourceQuoteVault,
    );
    assert.equal(
      wsolVaultBalance.toString(),
      storedRelaunch.quoteRecovered.toString(),
    );

    // The same swap with a live floor succeeds, so only the floor differed.
    await client.executeUsdcSwap({ relaunch });
    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.swapped);
  });

  it("fails when a non-admin executes the swap", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this);
    const accounts = await swapAccounts.call(this);
    const nonAdmin = Keypair.generate();

    try {
      await client
        .executeUsdcSwapIx({
          relaunch,
          ...accounts,
          minUsdcOut: new BN(0),
          admin: nonAdmin.publicKey,
        })
        .signers([nonAdmin])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintHasOne");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
  });

  it("fails before the sell has been executed", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this, { sell: false });

    try {
      await client.executeUsdcSwap({ relaunch });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSold");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);
  });

  it("fails when the swap has already been executed", async function () {
    const { relaunch } = await setupSoldRelaunch.call(this);

    await client.executeUsdcSwap({ relaunch });

    try {
      await client.executeUsdcSwap({ relaunch, minUsdcOut: new BN(1) });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSold");
    }
  });
}
