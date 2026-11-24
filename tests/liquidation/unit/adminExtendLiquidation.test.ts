import { LiquidationClient } from "@metadaoproject/programs";
import { Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";
import {
  setupActivatedLiquidation,
  setupLiquidationWithRefundRecords,
} from "../utils.js";
import BN from "bn.js";

export default function suite() {
  let liquidationClient: LiquidationClient;

  before(async function () {
    liquidationClient = this.liquidation;
  });

  it("extends an open refund window", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 200,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc();

    const liq = await liquidationClient.fetchLiquidation(result.liquidation);
    assert.equal(liq.durationSeconds, 200);

    // Past the old deadline, before the new one
    await this.advanceBySeconds(150);

    await this.mintTo(
      result.baseMint,
      recipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([recipient])
      .rpc();

    const quoteBalance = await this.getTokenBalance(
      result.quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "500000000");

    const callbacks = expectError(
      "RefundWindowNotExpired",
      "Should have thrown RefundWindowNotExpired error",
    );

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("closes the refund window at the new deadline", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 200,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc();

    await this.mintTo(
      result.baseMint,
      recipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await this.advanceBySeconds(201);

    const callbacks = expectError(
      "RefundWindowExpired",
      "Should have thrown RefundWindowExpired error",
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    const authorityBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalance.toString(), "500000000");
  });

  it("reopens a closed refund window while the vault is still funded", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.mintTo(
      result.baseMint,
      recipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await this.advanceBySeconds(101);

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 300,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc();

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([recipient])
      .rpc();

    const quoteBalance = await this.getTokenBalance(
      result.quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "500000000");

    const callbacks = expectError(
      "RefundWindowNotExpired",
      "Should have thrown RefundWindowNotExpired error",
    );

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("counts only unpaid refunds against the vault", async function () {
    const refunded = Keypair.generate();
    const unpaid = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient: refunded,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
        {
          recipient: unpaid,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.mintTo(
      result.baseMint,
      refunded.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: refunded.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([refunded])
      .rpc();

    // The vault now holds 500 of the 1000 it was funded with, and 500 is still owed
    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 200,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc();

    const liq = await liquidationClient.fetchLiquidation(result.liquidation);
    assert.equal(liq.durationSeconds, 200);
  });

  it("throws error when the vault has been swept", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.advanceBySeconds(101);

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    const callbacks = expectError(
      "VaultUnderfunded",
      "Should have thrown VaultUnderfunded error",
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 300,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("reopens a swept liquidation once the quote is back in the vault", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.mintTo(
      result.baseMint,
      recipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await this.advanceBySeconds(101);

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    await this.transfer(
      result.quoteMint,
      result.liquidationAuthority,
      result.liquidation,
      500_000_000,
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 300,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc();

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([recipient])
      .rpc();

    const quoteBalance = await this.getTokenBalance(
      result.quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "500000000");
  });

  it("throws error when liquidation is not activated", async function () {
    const recipient = Keypair.generate();

    const result = await setupLiquidationWithRefundRecords(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    const callbacks = expectError(
      "RefundingNotEnabled",
      "Should have thrown RefundingNotEnabled error",
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 200,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when the new duration equals the current one", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    const callbacks = expectError(
      "DurationNotIncreased",
      "Should have thrown DurationNotIncreased error",
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 100,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when the new duration is shorter than the current one", async function () {
    const recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    const callbacks = expectError(
      "DurationNotIncreased",
      "Should have thrown DurationNotIncreased error",
    );

    await liquidationClient
      .adminExtendLiquidationIx({
        newDurationSeconds: 50,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
