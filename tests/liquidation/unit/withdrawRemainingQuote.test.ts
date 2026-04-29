import { LiquidationClient } from "@metadaoproject/programs";
import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
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

  it("successfully withdraws remaining quote after deadline", async function () {
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

    // Advance past the deadline
    await this.advanceBySeconds(101);

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    // Vault should be empty
    const vaultBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidation,
    );
    assert.equal(vaultBalance.toString(), "0");

    // Authority should have received all 500 tokens
    const authorityBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalance.toString(), "500000000");
  });

  it("withdraws correct amount after partial refunds", async function () {
    const userFull = Keypair.generate();
    const userPartial = Keypair.generate();
    const userNone = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient: userFull,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
        {
          recipient: userPartial,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
        {
          recipient: userNone,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    // User 1: full refund - mint all 1000 base tokens and refund
    await this.mintTo(
      result.baseMint,
      userFull.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: userFull.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([userFull])
      .rpc();

    // User 2: partial refund - mint 400 of 1000 base tokens
    // Burns 400, gets 500 * 400 / 1000 = 200
    await this.mintTo(
      result.baseMint,
      userPartial.publicKey,
      result.baseMintAuthority,
      400_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: userPartial.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([userPartial])
      .rpc();

    // User 3: no refund at all

    // Total funded: 1500, refunded: 500 + 200 = 700, remaining: 800
    // Advance past the deadline
    await this.advanceBySeconds(101);

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    // Vault should be empty
    const vaultBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidation,
    );
    assert.equal(vaultBalance.toString(), "0");

    // Authority should have received remaining 800 tokens
    const authorityBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalance.toString(), "800000000");
  });

  it("throws error when liquidation_authority does not match", async function () {
    const recipient = Keypair.generate();
    const wrongAuthority = Keypair.generate();

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

    // Create the wrong authority's quote token account so the instruction
    // gets past account validation and hits the has_one constraint
    await this.createTokenAccount(result.quoteMint, wrongAuthority.publicKey);

    const callbacks = expectError(
      "InvalidAuthority",
      "Should have thrown InvalidAuthority error",
    );

    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: wrongAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([wrongAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when refund window has not expired", async function () {
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

    // Do NOT advance past deadline

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

  it("throws error when liquidation was never activated", async function () {
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

    await this.advanceBySeconds(101);

    // Create the authority's quote token account so the instruction
    // gets past account validation and hits the is_refunding constraint
    await this.createTokenAccount(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );

    const callbacks = expectError(
      "RefundingNotEnabled",
      "Should have thrown RefundingNotEnabled error",
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

  it("can be called multiple times (second call transfers 0)", async function () {
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

    // First withdrawal
    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc();

    const authorityBalanceAfterFirst = await this.getTokenBalance(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalanceAfterFirst.toString(), "500000000");

    // Second withdrawal succeeds but transfers 0
    await liquidationClient
      .withdrawRemainingQuoteIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([result.liquidationAuthority])
      .rpc();

    // Balance unchanged
    const authorityBalanceAfterSecond = await this.getTokenBalance(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalanceAfterSecond.toString(), "500000000");

    // Vault still empty
    const vaultBalance = await this.getTokenBalance(
      result.quoteMint,
      result.liquidation,
    );
    assert.equal(vaultBalance.toString(), "0");
  });
}
