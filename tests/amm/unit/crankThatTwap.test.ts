import { AmmClient, AmmMath, PriceMath } from "@metadaoproject/futarchy/v0.4";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, mintTo } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import {
  advanceBySlots,
  DAY_IN_SLOTS,
  ONE_MINUTE_IN_SLOTS,
  toBN,
} from "../../utils.js";
import { BN } from "bn.js";

export default function suite() {
  let ammClient: AmmClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;
  let twapStartDelaySlots: bigint;

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
    twapStartDelaySlots = DAY_IN_SLOTS;

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

    let proposal = Keypair.generate().publicKey;
    // $500 initial price, $10 change per update
    amm = await ammClient.createAmm(
      proposal,
      META,
      USDC,
      toBN(twapStartDelaySlots),
      500,
      10
    );

    // $1000 where liquidity is,
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

  it("does not update oracle if insufficient slots have passed", async function () {
    const initialAmm = await ammClient.getAmm(amm);
    const initialLastUpdatedSlot = initialAmm.oracle.lastUpdatedSlot;

    await advanceBySlots(this.context, ONE_MINUTE_IN_SLOTS - 1n);

    await ammClient
      .crankThatTwapIx(amm)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1,
        }),
      ])
      .rpc();

    let updatedAmm = await ammClient.getAmm(amm);

    assert.isTrue(
      updatedAmm.oracle.lastUpdatedSlot.eq(initialLastUpdatedSlot),
      "Oracle should not be updated if insufficient slots have passed"
    );
    assert.isTrue(
      updatedAmm.oracle.lastObservation.eq(PriceMath.getAmmPrice(500, 9, 6))
    );

    await advanceBySlots(this.context, 1n);

    await ammClient
      .crankThatTwapIx(amm)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 2,
        }),
      ])
      .rpc();

    updatedAmm = await ammClient.getAmm(amm);

    // observation should be updated but not aggregator
    assert.isTrue(
      updatedAmm.oracle.lastUpdatedSlot.eq(
        initialLastUpdatedSlot.addn(Number(ONE_MINUTE_IN_SLOTS))
      )
    );
    assert.isTrue(
      updatedAmm.oracle.lastObservation.eq(PriceMath.getAmmPrice(510, 9, 6))
    );
    assert.isTrue(updatedAmm.oracle.aggregator.eqn(0));

    await advanceBySlots(this.context, DAY_IN_SLOTS / 2n);

    await ammClient
      .crankThatTwapIx(amm)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 3,
        }),
      ])
      .rpc();

    updatedAmm = await ammClient.getAmm(amm);

    assert.isTrue(
      updatedAmm.oracle.lastObservation.eq(PriceMath.getAmmPrice(520, 9, 6))
    );
    assert.isTrue(updatedAmm.oracle.aggregator.eqn(0));

    await advanceBySlots(
      this.context,
      DAY_IN_SLOTS / 2n + 1n - ONE_MINUTE_IN_SLOTS
    );

    await ammClient
      .crankThatTwapIx(amm)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 4,
        }),
      ])
      .rpc();

    updatedAmm = await ammClient.getAmm(amm);

    assert.isTrue(
      updatedAmm.oracle.lastObservation.eq(PriceMath.getAmmPrice(530, 9, 6))
    );
    // only 1 slot has passed, so aggregator should be 0
    assert.isTrue(
      updatedAmm.oracle.aggregator.eq(PriceMath.getAmmPrice(530, 9, 6))
    );

    const twapStartSlot = initialAmm.createdAtSlot.addn(
      Number(twapStartDelaySlots)
    );
    const twapSlotsPassed =
      updatedAmm.oracle.lastUpdatedSlot.sub(twapStartSlot);
    assert.isTrue(twapSlotsPassed.eqn(1));
    // if this is true, then `get_twap()` will return 530 (530 / 1)

    await advanceBySlots(this.context, ONE_MINUTE_IN_SLOTS * 2n);

    await ammClient
      .crankThatTwapIx(amm)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 5,
        }),
      ])
      .rpc();

    updatedAmm = await ammClient.getAmm(amm);

    assert.isTrue(
      updatedAmm.oracle.lastObservation.eq(PriceMath.getAmmPrice(540, 9, 6))
    );
    // 2 minutes have passed, so aggregator should be 2 * 540 + 530
    assert.isTrue(
      updatedAmm.oracle.aggregator.eq(
        PriceMath.getAmmPrice(540, 9, 6)
          .mul(new BN(ONE_MINUTE_IN_SLOTS.toString()))
          .muln(2)
          .add(PriceMath.getAmmPrice(530, 9, 6))
      )
    );
  });

  it("updates oracle and sequence number when crankThatTwap is called", async function () {
    const initialAmm = await ammClient.getAmm(amm);
    const initialSeqNum = initialAmm.seqNum;
    const initialLastUpdatedSlot = initialAmm.oracle.lastUpdatedSlot;
    const initialAggregator = initialAmm.oracle.aggregator;

    // Advance slots to simulate time passing
    // this needs to be greater than 150 + twapStartDelaySlots because the twap oracle
    // only updates when the slot difference is greater than 150 (1 minute in slots) and
    // is past the twap start delay
    await advanceBySlots(this.context, 200n + twapStartDelaySlots);

    // Call crankThatTwap
    await ammClient.crankThatTwap(amm);

    const updatedAmm = await ammClient.getAmm(amm);

    // Check if sequence number has increased
    assert.isTrue(
      updatedAmm.seqNum.gt(initialSeqNum),
      "Sequence number should increase after crankThatTwap"
    );

    // Check if lastUpdatedSlot has been updated
    assert.isTrue(
      updatedAmm.oracle.lastUpdatedSlot.gt(initialLastUpdatedSlot),
      "Last updated slot should increase after crankThatTwap"
    );

    // Check if aggregator has been updated
    assert.notDeepEqual(
      updatedAmm.oracle.aggregator,
      initialAggregator,
      "Aggregator should be updated after crankThatTwap"
    );

    // Verify that the TWAP is calculated correctly
    const expectedTwap = updatedAmm.oracle.aggregator.div(
      updatedAmm.oracle.lastUpdatedSlot.sub(updatedAmm.createdAtSlot)
    );
    const calculatedTwap = AmmMath.getTwap(updatedAmm);
    assert.isTrue(
      calculatedTwap.eq(expectedTwap),
      "Calculated TWAP should match the expected value"
    );
  });

  it("updates oracle multiple times with consecutive crankThatTwap calls", async function () {
    const initialAmm = await ammClient.getAmm(amm);
    const initialSeqNum = initialAmm.seqNum;

    // Advance slots to get past the initial TWAP start delay period
    await advanceBySlots(this.context, twapStartDelaySlots);

    for (let i = 0; i < 3; i++) {
      await advanceBySlots(this.context, 151n);
      // to prevent a "this transaction has already been processed" error
      const previousAmm = await ammClient.getAmm(amm);
      await ammClient
        .crankThatTwapIx(amm)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000 + i,
          }),
        ])
        .rpc();

      const updatedAmm = await ammClient.getAmm(amm);

      // Check if lastObservation is increasing
      if (i > 0) {
        assert.isTrue(
          updatedAmm.oracle.lastObservation.gt(
            previousAmm.oracle.lastObservation
          ),
          `Last observation should increase after crankThatTwap call ${i + 1}`
        );
      }

      // Check if oracle is getting updated
      assert.notEqual(
        updatedAmm.oracle.lastUpdatedSlot.toString(),
        initialAmm.oracle.lastUpdatedSlot.toString(),
        `Oracle should be updated after crankThatTwap call ${i + 1}`
      );

      assert.isTrue(
        updatedAmm.seqNum.gt(initialSeqNum.addn(i)),
        `Sequence number should increase after crankThatTwap call ${i + 1}`
      );
    }

    const finalAmm = await ammClient.getAmm(amm);
    assert.isTrue(
      finalAmm.seqNum.eq(initialSeqNum.addn(3)),
      "Sequence number should increase by 3 after 3 crankThatTwap calls"
    );
  });
}
