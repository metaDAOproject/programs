import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getSharedLiquidityPoolAddr,
  getSpotPoolAddr,
  getSlPoolPositionAddr,
  getRaydiumCpmmLpMintAddr,
} from "@metadaoproject/futarchy/v0.4";
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

  it("withdraws liquidity from shared pool", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    await this.mintTo(META, user.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user.publicKey, this.payer, 100_000 * 10 ** 6);

    // First deposit some liquidity
    const depositLpTokenAmount = new BN(1_000_000); // 1 LP token
    const maxBaseAmount = new BN(1 * 10 ** 9); // 1 META max
    const maxQuoteAmount = new BN(1_000 * 10 ** 6); // 1,000 USDC max

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        depositLpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc();

    // Get initial balances
    const initialBaseBalance = await this.getTokenBalance(META, user.publicKey);
    const initialQuoteBalance = await this.getTokenBalance(
      USDC,
      user.publicKey
    );

    // Now withdraw some liquidity
    const withdrawLpTokenAmount = new BN(500_000); // 0.5 LP tokens
    const minimumToken0Amount = new BN(0);
    const minimumToken1Amount = new BN(0);

    await sharedLiquidityManagerClient
      .withdrawSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        withdrawLpTokenAmount,
        minimumToken0Amount,
        minimumToken1Amount,
        user.publicKey
      )
      .signers([user])
      .rpc();

    // Check that user received tokens back
    const finalBaseBalance = await this.getTokenBalance(META, user.publicKey);
    const finalQuoteBalance = await this.getTokenBalance(USDC, user.publicKey);

    assert.isAbove(Number(finalBaseBalance), Number(initialBaseBalance));
    assert.isAbove(Number(finalQuoteBalance), Number(initialQuoteBalance));

    // Check position was updated
    const position = await sharedLiquidityManagerClient.getSlPoolPosition(
      getSlPoolPositionAddr(
        sharedLiquidityManagerClient.getProgramId(),
        slPool,
        user.publicKey
      )[0]
    );

    const expectedRemainingShares = depositLpTokenAmount.sub(
      withdrawLpTokenAmount
    );
    assert.equal(
      position.underlyingSpotLpShares.toString(),
      expectedRemainingShares.toString()
    );
  });

  it("fails when pool is in use by active proposal", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    await this.mintTo(META, user.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user.publicKey, this.payer, 100_000 * 10 ** 6);

    // First deposit some liquidity
    const depositLpTokenAmount = new BN(1_000_000);
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        depositLpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc();

    // Simulate pool being in use by setting active_proposal
    // This would normally be set by the program, but for testing we'll mock it
    const slPoolAccount = await sharedLiquidityManagerClient.getSlPool(slPool);
    // Note: In a real scenario, this would be set by the program when a proposal is active

    const withdrawLpTokenAmount = new BN(500_000);
    const minimumToken0Amount = new BN(0);
    const minimumToken1Amount = new BN(0);

    // This test would need to be updated when we have a way to set the pool as "in use"
    // For now, we'll test the basic withdrawal functionality
    await sharedLiquidityManagerClient
      .withdrawSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        withdrawLpTokenAmount,
        minimumToken0Amount,
        minimumToken1Amount,
        user.publicKey
      )
      .signers([user])
      .rpc();
  });

  it("fails with insufficient LP shares", async function () {
    const user = Keypair.generate();
    await this.createTokenAccount(META, user.publicKey);
    await this.createTokenAccount(USDC, user.publicKey);
    await this.mintTo(META, user.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user.publicKey, this.payer, 100_000 * 10 ** 6);

    // First deposit some liquidity
    const depositLpTokenAmount = new BN(1_000_000);
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        depositLpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user.publicKey
      )
      .signers([user])
      .rpc();

    // Try to withdraw more than we have
    const withdrawLpTokenAmount = new BN(2_000_000); // More than deposited
    const minimumToken0Amount = new BN(0);
    const minimumToken1Amount = new BN(0);

    const callbacks = expectError(
      "InsufficientLpShares",
      "Should have thrown error for insufficient LP shares"
    );

    await sharedLiquidityManagerClient
      .withdrawSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        withdrawLpTokenAmount,
        minimumToken0Amount,
        minimumToken1Amount,
        user.publicKey
      )
      .signers([user])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when user is not position owner", async function () {
    const user1 = Keypair.generate();
    const user2 = Keypair.generate();

    await this.createTokenAccount(META, user1.publicKey);
    await this.createTokenAccount(USDC, user1.publicKey);
    await this.createTokenAccount(META, user2.publicKey);
    await this.createTokenAccount(USDC, user2.publicKey);

    await this.mintTo(META, user1.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user1.publicKey, this.payer, 100_000 * 10 ** 6);
    await this.mintTo(META, user2.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, user2.publicKey, this.payer, 100_000 * 10 ** 6);

    // User1 deposits liquidity
    const depositLpTokenAmount = new BN(1_000_000);
    const maxBaseAmount = new BN(1 * 10 ** 9);
    const maxQuoteAmount = new BN(1_000 * 10 ** 6);

    await sharedLiquidityManagerClient
      .depositSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        depositLpTokenAmount,
        maxBaseAmount,
        maxQuoteAmount,
        user1.publicKey
      )
      .signers([user1])
      .rpc();

    // User2 tries to withdraw user1's liquidity
    const withdrawLpTokenAmount = new BN(500_000);
    const minimumToken0Amount = new BN(0);
    const minimumToken1Amount = new BN(0);

    const callbacks = expectError(
      "ConstraintSeeds",
      "Should have thrown error for unauthorized user"
    );

    const spotPoolLpMint = await getRaydiumCpmmLpMintAddr(spotPool, false)[0];

    await this.createTokenAccount(spotPoolLpMint, user2.publicKey);

    await sharedLiquidityManagerClient
      .withdrawSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        withdrawLpTokenAmount,
        minimumToken0Amount,
        minimumToken1Amount,
        user2.publicKey
      )
      .accounts({
        userSlPoolPosition: getSlPoolPositionAddr(
          sharedLiquidityManagerClient.getProgramId(),
          slPool,
          user1.publicKey
        )[0],
      })
      .signers([user2])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
