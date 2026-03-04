import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";
import { setupLiquidation } from "../utils.js";
import BN from "bn.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export default function suite() {
  let liquidationClient: LiquidationClient;
  let baseMint: PublicKey;
  let quoteMint: PublicKey;
  let createKey: Keypair;
  let recordAuthority: Keypair;
  let liquidationAuthority: Keypair;
  let liquidation: PublicKey;

  before(async function () {
    liquidationClient = this.liquidation;
  });

  beforeEach(async function () {
    const result = await setupLiquidation(this);
    baseMint = result.baseMint;
    quoteMint = result.quoteMint;
    createKey = result.createKey;
    recordAuthority = result.recordAuthority;
    liquidationAuthority = result.liquidationAuthority;
    liquidation = result.liquidation;

    await liquidationClient
      .initializeLiquidationIx({
        durationSeconds: 86400,
        createKey: createKey.publicKey,
        recordAuthority: recordAuthority.publicKey,
        liquidationAuthority: liquidationAuthority.publicKey,
        baseMint,
        quoteMint,
      })
      .signers([createKey])
      .rpc();
  });

  it("successfully creates a new refund record", async function () {
    const recipient = Keypair.generate();
    const baseAssigned = new BN(1_000_000_000);
    const quoteRefundable = new BN(500_000_000);

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned,
        quoteRefundable,
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseAssigned.toString(), baseAssigned.toString());
    assert.equal(record.quoteRefundable.toString(), quoteRefundable.toString());
    assert.ok(record.liquidation.equals(liquidation));
    assert.ok(record.recipient.equals(recipient.publicKey));
    assert.equal(record.baseBurned.toString(), "0");
    assert.equal(record.quoteRefunded.toString(), "0");

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.totalBaseAssigned.toString(), baseAssigned.toString());
    assert.equal(
      liq.totalQuoteRefundable.toString(),
      quoteRefundable.toString(),
    );
    assert.equal(liq.seqNum.toString(), "1");
  });

  it("successfully updates an existing refund record (increase)", async function () {
    const recipient = Keypair.generate();

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    // Increase values
    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(200_000_000),
        quoteRefundable: new BN(100_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recordAuthority])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseAssigned.toString(), "200000000");
    assert.equal(record.quoteRefundable.toString(), "100000000");

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.totalBaseAssigned.toString(), "200000000");
    assert.equal(liq.totalQuoteRefundable.toString(), "100000000");
  });

  it("successfully updates an existing refund record (decrease)", async function () {
    const recipient = Keypair.generate();

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(200_000_000),
        quoteRefundable: new BN(100_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    // Decrease values
    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(50_000_000),
        quoteRefundable: new BN(25_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recordAuthority])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseAssigned.toString(), "50000000");
    assert.equal(record.quoteRefundable.toString(), "25000000");

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.totalBaseAssigned.toString(), "50000000");
    assert.equal(liq.totalQuoteRefundable.toString(), "25000000");
  });

  it("correctly tracks totals across multiple records", async function () {
    const recipient1 = Keypair.generate();
    const recipient2 = Keypair.generate();
    const recipient3 = Keypair.generate();

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient1.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(200_000_000),
        quoteRefundable: new BN(100_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient2.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recordAuthority])
      .rpc();

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(300_000_000),
        quoteRefundable: new BN(150_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient3.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_002 }),
      ])
      .signers([recordAuthority])
      .rpc();

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    // 100 + 200 + 300 = 600
    assert.equal(liq.totalBaseAssigned.toString(), "600000000");
    // 50 + 100 + 150 = 300
    assert.equal(liq.totalQuoteRefundable.toString(), "300000000");
    assert.equal(liq.seqNum.toString(), "3");
  });

  it("allows setting record to zero allocation", async function () {
    const recipient = Keypair.generate();

    // First create a non-zero record
    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    // Set to zero
    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(0),
        quoteRefundable: new BN(0),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([recordAuthority])
      .rpc();

    const record = await liquidationClient.getRefundRecord({
      liquidation,
      recipient: recipient.publicKey,
    });
    assert.equal(record.baseAssigned.toString(), "0");
    assert.equal(record.quoteRefundable.toString(), "0");

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.totalBaseAssigned.toString(), "0");
    assert.equal(liq.totalQuoteRefundable.toString(), "0");
  });

  it("throws error when quote_refundable > 0 but base_assigned is 0", async function () {
    const recipient = Keypair.generate();

    const callbacks = expectError(
      "InvalidAllocation",
      "Should have thrown InvalidAllocation error",
    );

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(0),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when liquidation is already activated", async function () {
    const recipient = Keypair.generate();

    // Create a record so activation has something to fund
    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([recordAuthority])
      .rpc();

    // Fund and activate the liquidation
    await this.mintTo(
      quoteMint,
      liquidationAuthority.publicKey,
      this.payer,
      50_000_000,
    );

    const authorityQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      liquidationAuthority.publicKey,
    );

    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: liquidationAuthority.publicKey,
        liquidation,
        liquidationAuthorityQuoteAccount: authorityQuoteAccount,
        quoteMint,
      })
      .signers([liquidationAuthority])
      .rpc();

    // Now try to set a refund record — should fail
    const recipient2 = Keypair.generate();

    const callbacks = expectError(
      "AlreadyActivated",
      "Should have thrown AlreadyActivated error",
    );

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: recordAuthority.publicKey,
        liquidation,
        recipient: recipient2.publicKey,
      })
      .signers([recordAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when record_authority does not match", async function () {
    const recipient = Keypair.generate();
    const wrongAuthority = Keypair.generate();

    const callbacks = expectError(
      "InvalidAuthority",
      "Should have thrown InvalidAuthority error",
    );

    await liquidationClient
      .setRefundRecordIx({
        baseAssigned: new BN(100_000_000),
        quoteRefundable: new BN(50_000_000),
        recordAuthority: wrongAuthority.publicKey,
        liquidation,
        recipient: recipient.publicKey,
      })
      .signers([wrongAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
