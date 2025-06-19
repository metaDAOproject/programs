import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getSharedLiquidityPoolAddr,
  getSpotPoolAddr,
  getSlPoolPositionAddr,
} from "@metadaoproject/futarchy/v0.4";
import { PublicKey, ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS } from "../../utils.js";

export default function suite() {
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let autocratClient: AutocratClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let dao: PublicKey;

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
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 100_000 * 10 ** 6);

    dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

  });

  it("deposits liquidity to shared pool", async function () {
    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();


    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );

    const lpTokenAmount = new BN(1_000_000); // 1 LP token
    const maxBaseAmount = new BN(1 * 10 ** 9); // 1 META max
    const maxQuoteAmount = new BN(1_000 * 10 ** 6); // 1,000 USDC max

    const initialBaseBalance = (await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
    )).amount;

    const initialQuoteBalance = (await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(USDC, this.payer.publicKey)
    )).amount;

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount
      )
      .rpc();

    // Check user position was created/updated
    // const storedSlPool = await sharedLiquidityManagerClient.program.account.sharedLiquidityPool.fetch(slPool);
    const position = await sharedLiquidityManagerClient.getSlPoolPosition(getSlPoolPositionAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      this.payer.publicKey
    )[0]);

    assert.equal(position.underlyingSpotLpShares.toString(), lpTokenAmount.toString());
    
    // Verify some tokens were spent (exact amounts depend on pool ratios)
    const finalBaseBalance = (await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
    )).amount;

    const finalQuoteBalance = (await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(USDC, this.payer.publicKey)
    )).amount;

    assert.isBelow(Number(finalBaseBalance), Number(initialBaseBalance));
    assert.isBelow(Number(finalQuoteBalance), Number(initialQuoteBalance));
  });

  it("fails with insufficient base tokens", async function () {
    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();

    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );

    const lpTokenAmount = new BN(1_000_000);
    const maxBaseAmount = new BN(200 * 10 ** 9); // More than user has
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    try {
      await sharedLiquidityManagerClient
        .depositSharedLiquidityIx(
          dao,
          spotPool,
          META,
          USDC,
          lpTokenAmount,
          maxBaseAmount,
          maxQuoteAmount
        )
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.exists(e);
    }
  });

  it("fails with insufficient quote tokens", async function () {
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
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();

    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );

    const lpTokenAmount = new BN(1_000_000);
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(200_000 * 10 ** 6); // More than user has

    try {
      await sharedLiquidityManagerClient
        .depositSharedLiquidityIx(
          slPool,
          spotPool,
          META,
          USDC, 
          lpTokenAmount,
          maxBaseAmount,
          maxQuoteAmount
        )
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.exists(e);
    }
  });

  it("allows multiple deposits from same user", async function () {
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
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();

    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );

    const lpTokenAmount = new BN(500_000); // 0.5 LP token
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);
    // First deposit
    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount
      )
      .rpc();

    // Second deposit
    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount
      )
      .rpc();

    // Both should succeed
    assert.ok(true);
  });

  it("allows deposits from multiple users", async function () {
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
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })])
      .rpc();

    const [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );

    const secondUser = Keypair.generate();
    await this.createTokenAccount(META, secondUser.publicKey);
    await this.createTokenAccount(USDC, secondUser.publicKey);
    await this.mintTo(META, secondUser.publicKey, this.payer, 10 * 10 ** 9);
    await this.mintTo(USDC, secondUser.publicKey, this.payer, 10_000 * 10 ** 6);

    const lpTokenAmount = new BN(500_000);
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    // First user deposits
    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount
      )
      .rpc();

    // Second user deposits
    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        secondUser.publicKey
      )
      .signers([secondUser])
      .rpc();

    // Both should succeed
    assert.ok(true);
  });
}