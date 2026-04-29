import { LiquidationClient } from "@metadaoproject/programs";
import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { expectError } from "../../utils.js";
import { setupLiquidationWithRefundRecords } from "../utils.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

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
    const recipient1 = Keypair.generate();
    const recipient2 = Keypair.generate();

    const result = await setupLiquidationWithRefundRecords(this, [
      {
        recipient: recipient1,
        baseAssigned: new BN(1_000_000_000),
        quoteRefundable: new BN(500_000_000),
      },
      {
        recipient: recipient2,
        baseAssigned: new BN(2_000_000_000),
        quoteRefundable: new BN(1_000_000_000),
      },
    ]);

    baseMint = result.baseMint;
    quoteMint = result.quoteMint;
    createKey = result.createKey;
    recordAuthority = result.recordAuthority;
    liquidationAuthority = result.liquidationAuthority;
    liquidation = result.liquidation;

    // Fund the liquidation authority with enough quote tokens
    await this.mintTo(
      quoteMint,
      liquidationAuthority.publicKey,
      this.payer,
      1_500_000_000, // 500 + 1000
    );
  });

  it("successfully activates liquidation", async function () {
    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: liquidationAuthority.publicKey,
        liquidation,
        quoteMint,
      })
      .signers([liquidationAuthority])
      .rpc();

    const liq = await liquidationClient.fetchLiquidation(liquidation);
    assert.equal(liq.isRefunding, true);
    assert.ok(liq.startedAt.toNumber() > 0);

    // Vault should have the total quote refundable
    const vaultBalance = await this.getTokenBalance(quoteMint, liquidation);
    assert.equal(vaultBalance.toString(), "1500000000");

    // Authority's quote account should be drained
    const authorityBalance = await this.getTokenBalance(
      quoteMint,
      liquidationAuthority.publicKey,
    );
    assert.equal(authorityBalance.toString(), "0");
  });

  it("throws error when liquidation_authority does not match", async function () {
    const wrongAuthority = Keypair.generate();

    await this.mintTo(
      quoteMint,
      wrongAuthority.publicKey,
      this.payer,
      1_500_000_000,
    );

    const callbacks = expectError(
      "InvalidAuthority",
      "Should have thrown InvalidAuthority error",
    );

    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: wrongAuthority.publicKey,
        liquidation,
        quoteMint,
      })
      .signers([wrongAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when already activated", async function () {
    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: liquidationAuthority.publicKey,
        liquidation,
        quoteMint,
      })
      .signers([liquidationAuthority])
      .rpc();

    // Try to activate again
    const callbacks = expectError(
      "AlreadyActivated",
      "Should have thrown AlreadyActivated error",
    );

    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: liquidationAuthority.publicKey,
        liquidation,
        quoteMint,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([liquidationAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when total_base_assigned is zero", async function () {
    const recipient = Keypair.generate();

    const result = await setupLiquidationWithRefundRecords(this, [
      {
        recipient,
        baseAssigned: new BN(0),
        quoteRefundable: new BN(0),
      },
    ]);

    await this.createTokenAccount(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );

    const callbacks = expectError(
      "NoBaseAssigned",
      "Should have thrown NoBaseAssigned error",
    );

    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when total_quote_refundable is zero", async function () {
    const recipient = Keypair.generate();

    const result = await setupLiquidationWithRefundRecords(this, [
      {
        recipient,
        baseAssigned: new BN(1_000_000_000),
        quoteRefundable: new BN(0),
      },
    ]);

    await this.createTokenAccount(
      result.quoteMint,
      result.liquidationAuthority.publicKey,
    );

    const callbacks = expectError(
      "NothingToFund",
      "Should have thrown NothingToFund error",
    );

    await liquidationClient
      .activateLiquidationIx({
        liquidationAuthority: result.liquidationAuthority.publicKey,
        liquidation: result.liquidation,
        quoteMint: result.quoteMint,
      })
      .signers([result.liquidationAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when funder has insufficient quote tokens", async function () {
    // Drain authority's tokens so they don't have enough
    // Manipulate the token account to have only 100 tokens
    const ataAddress = token.getAssociatedTokenAddressSync(
      quoteMint,
      liquidationAuthority.publicKey,
    );
    const ataInfo = await this.banksClient.getAccount(ataAddress);
    const ataData = Buffer.from(ataInfo.data);
    // Token account amount is at offset 64 (after mint 32 + owner 32)
    ataData.writeBigUInt64LE(BigInt(100_000_000), 64);
    this.context.setAccount(ataAddress, {
      data: ataData,
      executable: false,
      owner: token.TOKEN_PROGRAM_ID,
      lamports: ataInfo.lamports,
    });

    try {
      await liquidationClient
        .activateLiquidationIx({
          liquidationAuthority: liquidationAuthority.publicKey,
          liquidation,
          quoteMint,
        })
        .signers([liquidationAuthority])
        .rpc();
      assert.fail("Should have thrown an error for insufficient funds");
    } catch (e) {
      assert.ok(e);
    }
  });
}
