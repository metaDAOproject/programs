import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getSharedLiquidityPoolAddr,
  getSpotPoolAddr,
  getSlPoolPositionAddr,
} from "@metadaoproject/futarchy/v0.5";
import { PublicKey, ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError } from "../../utils.js";

export default function suite() {
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let autocratClient: AutocratClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let dao: PublicKey;
  let slPool: PublicKey;
  let spotPool: PublicKey;

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

    dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    // Initialize shared liquidity pool
    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .rpc();

    // Calculate pool addresses
    [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );
  });

  it("deposits liquidity to shared pool", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    await this.mintTo(META, user.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user.publicKey, this.payer, 100_000 * 10 ** 6);

    const lpTokenAmount = new BN(1_000_000); // 1 LP token
    const maxBaseAmount = new BN(1 * 10 ** 9); // 1 META max
    const maxQuoteAmount = new BN(1_000 * 10 ** 6); // 1,000 USDC max

    const initialBaseBalance = await this.getTokenBalance(META, user.publicKey);
    const initialQuoteBalance = await this.getTokenBalance(
      USDC,
      user.publicKey
    );

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc();

    // Check user position was created/updated
    // const storedSlPool = await sharedLiquidityManagerClient.program.account.sharedLiquidityPool.fetch(slPool);
    const position = await sharedLiquidityManagerClient.getSlPoolPosition(
      getSlPoolPositionAddr(
        sharedLiquidityManagerClient.getProgramId(),
        slPool,
        user.publicKey
      )[0]
    );

    assert.equal(
      position.underlyingSpotLpShares.toString(),
      lpTokenAmount.toString()
    );

    // Verify some tokens were spent (exact amounts depend on pool ratios)
    const finalBaseBalance = await this.getTokenBalance(META, user.publicKey);
    const finalQuoteBalance = await this.getTokenBalance(USDC, user.publicKey);

    assert.isBelow(Number(finalBaseBalance), Number(initialBaseBalance));
    assert.isBelow(Number(finalQuoteBalance), Number(initialQuoteBalance));
  });

  it("fails with insufficient base tokens", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    // Give user only 1 META but try to deposit 200 META worth
    await this.mintTo(META, user.publicKey, this.payer, 1 * 10 ** 9);
    await this.mintTo(USDC, user.publicKey, this.payer, 100_000 * 10 ** 6);

    // Request a large amount of LP tokens that would require more than 1 META
    const lpTokenAmount = new BN(500000000_000_000); // 50 LP tokens (much more than user can afford)
    const maxBaseAmount = new BN(200 * 10 ** 9); // More than user has
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    const callbacks = expectError(
      "InsufficientFunds",
      "Should have thrown error for insufficient base tokens"
    );

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with insufficient quote tokens", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    await this.mintTo(META, user.publicKey, this.payer, 100 * 10 ** 9);
    // Give user only 1,000 USDC but try to deposit 200,000 USDC worth
    await this.mintTo(USDC, user.publicKey, this.payer, 1_000 * 10 ** 6);

    // Request a large amount of LP tokens that would require more than 1,000 USDC
    const lpTokenAmount = new BN(50_000_000); // 50 LP tokens (much more than user can afford)
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(200_000 * 10 ** 6); // More than user has

    const callbacks = expectError(
      "InsufficientFunds",
      "Should have thrown error for insufficient quote tokens"
    );

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        lpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("allows multiple deposits from same user", async function () {
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
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        }),
      ])
      .rpc();

    // Both should succeed
    assert.ok(true);
  });

  it("allows deposits from multiple users", async function () {
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
  });
}
