import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import BN from "bn.js";
import { assert } from "chai";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.6";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000 * 10 ** 6);
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 6);

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("collects LP fees by reducing liquidity to a target K", async function () {
    // This is meant to be a one-off operation that reduces liquidity to a target K (the inital pool's liquidity) and collect it as "fees"
    // We're using this because we didn't track LP fee collection in the pool state, nor did we exclude those fees from liquidity

    let daoAccount = await this.futarchy.fetchDao(dao);
    let seqNum = daoAccount.seqNum;

    const preQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    const preBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // We can calculate K and know the "fees collected" this way because we know the price is 1:1
    // Usually, we'd want to calculate K based on the target liquidity, which is usually what K was when the pool was initialized
    const targetQuoteReserves = new BN(90_000 * 10 ** 6);
    const targetBaseReserves = new BN(90_000 * 10 ** 6);

    const targetK = targetBaseReserves.mul(targetQuoteReserves);

    await this.futarchy
      .collectLpFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        targetK,
      })
      .rpc();

    const postQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    const postBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
    const baseFeesCollected = postBaseBalance - preBaseBalance;

    assert.equal(quoteFeesCollected, 10_000n * 10n ** 6n);
    assert.equal(baseFeesCollected, 10_000n * 10n ** 6n);

    daoAccount = await this.futarchy.fetchDao(dao);
    assert.equal(
      daoAccount.seqNum.toString(),
      seqNum.add(new BN(1)).toString(),
    );
    assert.equal(
      daoAccount.amm.state.spot.spot.baseReserves.toString(),
      targetBaseReserves.toString(),
    );
    assert.equal(
      daoAccount.amm.state.spot.spot.quoteReserves.toString(),
      targetQuoteReserves.toString(),
    );
  });

  it("collects LP fees by reducing liquidity to a target K whose square root is not an exact integer", async function () {
    // In cases where target K is not an exact square, we want to round up the target reserves
    // We want to favor the protocol in this case instead of taking the atom to ourselves

    let daoAccount = await this.futarchy.fetchDao(dao);
    let seqNum = daoAccount.seqNum;

    const preQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    const preBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    // We can calculate K and know the "fees collected" this way because we know the price is 1:1
    // Usually, we'd want to calculate K based on the target liquidity, which is usually what K was when the pool was initialized
    const targetQuoteReserves = new BN(90_000 * 10 ** 6);
    const targetBaseReserves = new BN(90_000 * 10 ** 6);

    // Slighly lower target K to ensure we round up to the correct amount
    const targetK = targetBaseReserves.mul(targetQuoteReserves).sub(new BN(1));

    await this.futarchy
      .collectLpFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        targetK,
      })
      .rpc();

    const postQuoteBalance = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );
    const postBaseBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    const quoteFeesCollected = postQuoteBalance - preQuoteBalance;
    const baseFeesCollected = postBaseBalance - preBaseBalance;

    assert.equal(quoteFeesCollected, 10_000n * 10n ** 6n);
    assert.equal(baseFeesCollected, 10_000n * 10n ** 6n);

    daoAccount = await this.futarchy.fetchDao(dao);
    assert.equal(
      daoAccount.seqNum.toString(),
      seqNum.add(new BN(1)).toString(),
    );
    assert.equal(
      daoAccount.amm.state.spot.spot.baseReserves.toString(),
      targetBaseReserves.toString(),
    );
    assert.equal(
      daoAccount.amm.state.spot.spot.quoteReserves.toString(),
      targetQuoteReserves.toString(),
    );
  });

  it("fails when the pool is not in the spot state", async function () {
    await this.initializeAndLaunchProposal({
      dao,
      instructions: [
        {
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from("hello, world"),
        },
      ],
    });

    const callbacks = expectError(
      "PoolNotInSpotState",
      "fee collect worked on a futarchy pool",
    );

    await this.futarchy
      .collectLpFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        targetK: new BN(100_000 * 10 ** 6).mul(new BN(100_000 * 10 ** 6)),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when target K is greater than current K", async function () {
    const callbacks = expectError(
      "InvalidTargetK",
      "Target K must be greater than the current K",
    );

    await this.futarchy
      .collectLpFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        targetK: new BN(100_000 * 10 ** 6)
          .mul(new BN(100_000 * 10 ** 6))
          .add(new BN(1)),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
