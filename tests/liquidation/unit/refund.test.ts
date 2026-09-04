import { LiquidationClient } from "@metadaoproject/programs";
import {
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import { expectError } from "../../utils.js";
import {
  setupActivatedLiquidation,
  setupLiquidationWithRefundRecords,
} from "../utils.js";
import BN from "bn.js";

export default function suite() {
  let liquidationClient: LiquidationClient;
  let baseMint: PublicKey;
  let quoteMint: PublicKey;
  let baseMintAuthority: Keypair;
  let liquidation: PublicKey;
  let recipient: Keypair;

  before(async function () {
    liquidationClient = this.liquidation;
  });

  beforeEach(async function () {
    recipient = Keypair.generate();

    const result = await setupActivatedLiquidation(this, [
      {
        recipient,
        baseAssigned: new BN(1_000_000_000),
        quoteRefundable: new BN(500_000_000),
      },
    ]);

    baseMint = result.baseMint;
    quoteMint = result.quoteMint;
    baseMintAuthority = result.baseMintAuthority;
    liquidation = result.liquidation;
  });

  it("successfully burns base and receives proportional quote", async function () {
    // Mint full 1000 tokens (matches assigned amount)
    await this.mintTo(
      baseMint,
      recipient.publicKey,
      baseMintAuthority,
      1_000_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .signers([recipient])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseBurned.toString(), "1000000000");
    assert.equal(record.quoteRefunded.toString(), "500000000");

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.totalBaseBurned.toString(), "1000000000");
    assert.equal(liq.totalQuoteRefunded.toString(), "500000000");

    const quoteBalance = await this.getTokenBalance(
      quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "500000000");

    const baseBalance = await this.getTokenBalance(
      baseMint,
      recipient.publicKey,
    );
    assert.equal(baseBalance.toString(), "0");
  });

  it("handles partial burn (less balance than assigned)", async function () {
    // Mint only 400 tokens (less than 1000 assigned)
    await this.mintTo(
      baseMint,
      recipient.publicKey,
      baseMintAuthority,
      400_000_000,
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .signers([recipient])
      .rpc();

    // Burns 400, gets 500 * 400 / 1000 = 200
    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseBurned.toString(), "400000000");
    assert.equal(record.quoteRefunded.toString(), "200000000");

    const quoteBalance = await this.getTokenBalance(
      quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "200000000");
  });

  it("handles multiple refund calls by same user", async function () {
    // Mint 500 tokens (half of assigned)
    await this.mintTo(
      baseMint,
      recipient.publicKey,
      baseMintAuthority,
      500_000_000,
    );

    // First refund: burns 500, gets 250
    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .signers([recipient])
      .rpc();

    let record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseBurned.toString(), "500000000");
    assert.equal(record.quoteRefunded.toString(), "250000000");

    // Mint 500 more tokens. The compute-unit price makes this transaction's
    // hash differ from the first mint.
    const mintTx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      createMintToInstruction(
        baseMint,
        getAssociatedTokenAddressSync(baseMint, recipient.publicKey, true),
        baseMintAuthority.publicKey,
        500_000_000,
      ),
    );
    [mintTx.recentBlockhash] = await this.banksClient.getLatestBlockhash();
    mintTx.feePayer = this.payer.publicKey;
    mintTx.sign(this.payer, baseMintAuthority);
    await this.banksClient.processTransaction(mintTx);

    // Second refund: burns remaining 500, gets 250 more
    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recipient])
      .rpc();

    record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseBurned.toString(), "1000000000");
    assert.equal(record.quoteRefunded.toString(), "500000000");

    const quoteBalance = await this.getTokenBalance(
      quoteMint,
      recipient.publicKey,
    );
    assert.equal(quoteBalance.toString(), "500000000");
  });

  it("throws error when refunding is not enabled", async function () {
    const nonActivatedRecipient = Keypair.generate();

    // Setup liquidation WITHOUT activating
    const result = await setupLiquidationWithRefundRecords(this, [
      {
        recipient: nonActivatedRecipient,
        baseAssigned: new BN(1_000_000_000),
        quoteRefundable: new BN(500_000_000),
      },
    ]);

    // Fund recipient with SOL for rent
    this.context.setAccount(nonActivatedRecipient.publicKey, {
      data: Buffer.alloc(0),
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1_000_000_000,
    });

    await this.mintTo(
      result.baseMint,
      nonActivatedRecipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    const callbacks = expectError(
      "RefundingNotEnabled",
      "Should have thrown RefundingNotEnabled error",
    );

    await liquidationClient
      .refundIx({
        recipient: nonActivatedRecipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([nonActivatedRecipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when refund window has expired", async function () {
    const expiredRecipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient: expiredRecipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.mintTo(
      result.baseMint,
      expiredRecipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    // Advance past the deadline
    await this.advanceBySeconds(101);

    const callbacks = expectError(
      "RefundWindowExpired",
      "Should have thrown RefundWindowExpired error",
    );

    await liquidationClient
      .refundIx({
        recipient: expiredRecipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([expiredRecipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when effective_burn is zero (fully burned)", async function () {
    // Mint full 1000 tokens
    await this.mintTo(
      baseMint,
      recipient.publicKey,
      baseMintAuthority,
      1_000_000_000,
    );

    // First refund succeeds — burns all
    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .signers([recipient])
      .rpc();

    // Second refund fails — nothing left to burn
    const callbacks = expectError(
      "NothingToRefund",
      "Should have thrown NothingToRefund error",
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when effective_burn is zero (zero balance)", async function () {
    // Create base token account with zero balance (no minting)
    await this.createTokenAccount(baseMint, recipient.publicKey);

    const callbacks = expectError(
      "NothingToRefund",
      "Should have thrown NothingToRefund error",
    );

    await liquidationClient
      .refundIx({
        recipient: recipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when recipient does not match refund record", async function () {
    const wrongRecipient = Keypair.generate();

    // Fund wrong recipient with SOL and base tokens
    this.context.setAccount(wrongRecipient.publicKey, {
      data: Buffer.alloc(0),
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1_000_000_000,
    });

    await this.mintTo(
      baseMint,
      wrongRecipient.publicKey,
      baseMintAuthority,
      1_000_000_000,
    );

    // Get the real recipient's refund record address to pass as override
    const realRefundRecord = liquidationClient.getRefundRecordAddress({
      liquidation,
      recipient: recipient.publicKey,
    });

    const callbacks = expectError(
      "InvalidAuthority",
      "Should have thrown InvalidAuthority error",
    );

    await liquidationClient
      .refundIx({
        recipient: wrongRecipient.publicKey,
        liquidation,
        baseMint,
        quoteMint,
      })
      .accounts({
        refundRecord: realRefundRecord,
      })
      .signers([wrongRecipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refund right at deadline boundary succeeds", async function () {
    const boundaryRecipient = Keypair.generate();

    const result = await setupActivatedLiquidation(
      this,
      [
        {
          recipient: boundaryRecipient,
          baseAssigned: new BN(1_000_000_000),
          quoteRefundable: new BN(500_000_000),
        },
      ],
      { durationSeconds: 100 },
    );

    await this.mintTo(
      result.baseMint,
      boundaryRecipient.publicKey,
      result.baseMintAuthority,
      1_000_000_000,
    );

    // Advance to exactly the deadline (started_at + 100)
    await this.advanceBySeconds(100);

    await liquidationClient
      .refundIx({
        recipient: boundaryRecipient.publicKey,
        liquidation: result.liquidation,
        baseMint: result.baseMint,
        quoteMint: result.quoteMint,
      })
      .signers([boundaryRecipient])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation: result.liquidation,
      recipient: boundaryRecipient.publicKey,
    });
    assert.equal(record.baseBurned.toString(), "1000000000");
    assert.equal(record.quoteRefunded.toString(), "500000000");
  });
}
