import {
  AmmClient,
  AmmMath,
  getAmmAddr,
  getAmmLpMintAddr,
} from "@metadaoproject/futarchy/v0.4";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { DAY_IN_SLOTS, expectError, toBN } from "../../utils.js";
import { advanceBySlots } from "../../utils.js";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export default function suite() {
  let ammClient: AmmClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  beforeEach(async function () {
    ammClient = this.ammClient;
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

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

    let proposal = Keypair.generate().publicKey;
    amm = await ammClient.createAmm(proposal, META, USDC, toBN(DAY_IN_SLOTS), 500);

    await ammClient
      .addLiquidityIx(
        amm,
        META,
        USDC,
        new BN(10_000 * 10 ** 6),
        new BN(10 * 10 ** 9),
        new BN(0)
      )
      .rpc();
  });

  it("fails when you have insufficient balance", async () => {
    let callbacks = expectError(
      "InsufficientBalance",
      "we should have caught a user not having enough balance"
    );

    await ammClient
      .swap(amm, { buy: {} }, 10_000_000, 1)
      .then(callbacks[0], callbacks[1]);

    await ammClient
      .swap(amm, { sell: {} }, 100_000, 1)
      .then(callbacks[0], callbacks[1]);
  });

  it("buys", async function () {
    const expectedOut = 0.098029507;

    // Ensure user has enough USDC
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 200 * 10 ** 6);

    const storedAmm = await ammClient.getAmm(amm);
    let sim = AmmMath.simulateSwap(
      new BN(100 * 10 ** 6),
      { buy: {} },
      storedAmm.baseAmount,
      storedAmm.quoteAmount
    );
    assert.equal(
      sim.expectedOut.toString(),
      new BN(expectedOut * 10 ** 9).toString()
    );

    let callbacks = expectError(
      "SwapSlippageExceeded",
      "we got back too many tokens from the AMM"
    );

    await ammClient
      .swap(amm, { buy: {} }, 100, expectedOut + 0.000000001)
      .then(callbacks[0], callbacks[1]);

    await ammClient.swap(amm, { buy: {} }, 100, expectedOut);

    await validateAmmState({
      banksClient: this.banksClient,
      ammClient,
      amm,
      base: META,
      quote: USDC,
      expectedBaseAmount: (10 - expectedOut) * 10 ** 9,
      expectedQuoteAmount: 10_100 * 10 ** 6,
      expectedLpSupply: 10_000 * 10 ** 6,
      expectedSeqNum: 2,
    });
  });

  it("sells", async function () {
    const expectedOut = 900.818926;

    let callbacks = expectError(
      "SwapSlippageExceeded",
      "we got back too many tokens from the AMM"
    );

    await ammClient
      .swap(amm, { sell: {} }, 1, expectedOut + 0.000001)
      .then(callbacks[0], callbacks[1]);

    await ammClient.swap(amm, { sell: {} }, 1, expectedOut);

    await validateAmmState({
      banksClient: this.banksClient,
      ammClient,
      amm,
      base: META,
      quote: USDC,
      expectedBaseAmount: 11 * 10 ** 9,
      expectedQuoteAmount: (10_000 - expectedOut) * 10 ** 6,
      expectedLpSupply: 10_000 * 10 ** 6,
      expectedSeqNum: 2,
    });
  });

  it("swap base to quote and back, should not be profitable", async function () {
    const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
      amm
    );
    const ammEnd = await ammClient.getAmm(amm);

    let startingBaseSwapAmount = 1 * 10 ** 9;

    await ammClient
      .swapIx(
        amm,
        META,
        USDC,
        { sell: {} },
        new BN(startingBaseSwapAmount),
        new BN(1)
      )
      .rpc();

    await advanceBySlots(this.context, 1n);

    const ammMiddle = await ammClient.getAmm(amm);
    let quoteReceived =
      permissionlessAmmStart.quoteAmount.toNumber() -
      ammMiddle.quoteAmount.toNumber();

    await ammClient
      .swapIx(amm, META, USDC, { buy: {} }, new BN(quoteReceived), new BN(1))
      .rpc();

    const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(amm);
    let baseReceived =
      ammMiddle.baseAmount.toNumber() -
      permissionlessAmmEnd.baseAmount.toNumber();

    assert.isBelow(baseReceived, startingBaseSwapAmount);
    assert.isAbove(baseReceived, startingBaseSwapAmount * 0.98);

    assert.equal(permissionlessAmmEnd.seqNum.toString(), "3");
  });

  it("swap quote to base and back, should not be profitable", async function () {
    const ammStart = await ammClient.getAmm(amm);

    let startingQuoteSwapAmount = 1 * 10 ** 6;

    // Ensure user has enough USDC
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 2 * 10 ** 6);

    await ammClient
      .swapIx(
        amm,
        META,
        USDC,
        { buy: {} },
        new BN(startingQuoteSwapAmount),
        new BN(1)
      )
      .rpc();

    await advanceBySlots(this.context, 1n);

    const ammMiddle = await ammClient.getAmm(amm);
    let baseReceived =
      ammStart.baseAmount.toNumber() - ammMiddle.baseAmount.toNumber();

    await ammClient
      .swapIx(amm, META, USDC, { sell: {} }, new BN(baseReceived), new BN(1))
      .rpc();

    const ammEnd = await ammClient.getAmm(amm);
    let quoteReceived =
      ammMiddle.quoteAmount.toNumber() - ammEnd.quoteAmount.toNumber();

    assert.isBelow(quoteReceived, startingQuoteSwapAmount);
    assert.isAbove(quoteReceived, startingQuoteSwapAmount * 0.98);
  });
}

async function validateAmmState({
  banksClient,
  ammClient,
  amm,
  base,
  quote,
  expectedBaseAmount,
  expectedQuoteAmount,
  expectedLpSupply,
  expectedSeqNum,
}: {
  banksClient: any;
  ammClient: AmmClient;
  amm: PublicKey;
  base: PublicKey;
  quote: PublicKey;
  expectedBaseAmount: number;
  expectedQuoteAmount: number;
  expectedLpSupply: number;
  expectedSeqNum: number;
}) {
  const storedAmm = await ammClient.getAmm(amm);

  assert.equal(storedAmm.baseAmount.toString(), expectedBaseAmount.toString());
  assert.equal(
    storedAmm.quoteAmount.toString(),
    expectedQuoteAmount.toString()
  );

  assert.equal(
    (
      await getAccount(
        banksClient,
        getAssociatedTokenAddressSync(base, amm, true)
      )
    ).amount,
    BigInt(expectedBaseAmount)
  );
  assert.equal(
    (
      await getAccount(
        banksClient,
        getAssociatedTokenAddressSync(quote, amm, true)
      )
    ).amount,
    BigInt(expectedQuoteAmount)
  );
  assert.equal(
    (await getMint(banksClient, storedAmm.lpMint)).supply,
    BigInt(expectedLpSupply)
  );
  assert.equal(storedAmm.seqNum.toString(), expectedSeqNum.toString());
}
