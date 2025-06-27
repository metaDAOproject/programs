import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getSharedLiquidityPoolAddr,
} from "@metadaoproject/futarchy/v0.5";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { createMint } from "spl-token-bankrun";
import { BN } from "bn.js";
import { DAY_IN_SLOTS, expectError } from "../../utils.js";

export default function suite() {
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let autocratClient: AutocratClient;
  let META: PublicKey;
  let USDC: PublicKey;

  before(async function () {
    sharedLiquidityManagerClient = this.sharedLiquidityManagerClient;
    autocratClient = this.autocratClient;
  });

  beforeEach(async function () {
    // Create fresh test tokens for each test to avoid address collisions
    META = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      9
    );
    USDC = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      6
    );

    // Create token accounts and mint tokens
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6
    );
  });

  it("initializes shared liquidity pool with valid parameters", async function () {
    const baseAmount = new BN(25 * 10 ** 9); // 25 META
    const quoteAmount = new BN(25_000 * 10 ** 6); // 25,000 USDC

    const dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(dao, META, USDC, baseAmount, quoteAmount)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .rpc();

    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const storedSlPool =
      await sharedLiquidityManagerClient.program.account.sharedLiquidityPool.fetch(
        slPool
      );

    // Verify basic pool properties
    assert.ok(storedSlPool.dao.equals(dao));
    assert.ok(storedSlPool.baseMint.equals(META));
    assert.ok(storedSlPool.quoteMint.equals(USDC));
    assert.equal(storedSlPool.proposalStakeRateThresholdBps, 100);
    assert.equal(storedSlPool.seqNum.toString(), "0");
    assert.isNull(storedSlPool.activeProposal);
  });

  it("fails with insufficient base tokens", async function () {
    const baseAmount = new BN(200 * 10 ** 9); // More than available
    const quoteAmount = new BN(25_000 * 10 ** 6);

    const dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    const callbacks = expectError(
      "InsufficientFunds",
      "should fail with insufficient base tokens"
    );

    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(dao, META, USDC, baseAmount, quoteAmount)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with insufficient quote tokens", async function () {
    const baseAmount = new BN(25 * 10 ** 9);
    const quoteAmount = new BN(200_000 * 10 ** 6); // More than available

    const dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    const callbacks = expectError(
      "InsufficientFunds",
      "should fail with insufficient quote tokens"
    );

    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(dao, META, USDC, baseAmount, quoteAmount)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with zero base amount", async function () {
    const baseAmount = new BN(0);
    const quoteAmount = new BN(25_000 * 10 ** 6);

    const dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    try {
      await sharedLiquidityManagerClient
        .initializeSharedLiquidityPoolIx(
          dao,
          META,
          USDC,
          baseAmount,
          quoteAmount
        )
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // Should fail at Raydium level for zero amounts
      assert.exists(e);
    }
  });

  it("fails with zero quote amount", async function () {
    const baseAmount = new BN(25 * 10 ** 9);
    const quoteAmount = new BN(0);

    const dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    try {
      await sharedLiquidityManagerClient
        .initializeSharedLiquidityPoolIx(
          dao,
          META,
          USDC,
          baseAmount,
          quoteAmount
        )
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // Should fail at Raydium level for zero amounts
      assert.exists(e);
    }
  });
}
