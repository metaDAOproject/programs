import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import { Keypair } from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import { expectError } from "../../utils.js";
import { setupLiquidation } from "../utils.js";

export default function suite() {
  let liquidationClient: LiquidationClient;

  before(async function () {
    liquidationClient = this.liquidation;
  });

  it("successfully initializes a liquidation", async function () {
    const {
      baseMint,
      quoteMint,
      createKey,
      recordAuthority,
      liquidationAuthority,
      liquidation,
    } = await setupLiquidation(this);

    const durationSeconds = 86400; // 1 day

    await liquidationClient
      .initializeLiquidationIx({
        durationSeconds,
        createKey: createKey.publicKey,
        recordAuthority: recordAuthority.publicKey,
        liquidationAuthority: liquidationAuthority.publicKey,
        baseMint,
        quoteMint,
      })
      .signers([createKey])
      .rpc();

    const stored = await liquidationClient.fetchLiquidation(liquidation);

    assert.ok(stored.createKey.equals(createKey.publicKey));
    assert.ok(stored.recordAuthority.equals(recordAuthority.publicKey));
    assert.ok(
      stored.liquidationAuthority.equals(liquidationAuthority.publicKey),
    );
    assert.ok(stored.baseMint.equals(baseMint));
    assert.ok(stored.quoteMint.equals(quoteMint));
    assert.equal(stored.totalQuoteRefundable.toString(), "0");
    assert.equal(stored.totalQuoteRefunded.toString(), "0");
    assert.equal(stored.totalBaseAssigned.toString(), "0");
    assert.equal(stored.totalBaseBurned.toString(), "0");
    assert.equal(stored.startedAt.toString(), "0");
    assert.equal(stored.durationSeconds, durationSeconds);
    assert.equal(stored.seqNum.toString(), "0");
    assert.equal(stored.isRefunding, false);

    // Verify quote vault ATA was created
    const vaultAddress = token.getAssociatedTokenAddressSync(
      quoteMint,
      liquidation,
      true,
    );
    const vaultBalance = await this.getTokenBalance(quoteMint, liquidation);
    assert.equal(vaultBalance.toString(), "0");
  });

  it("throws error when base_mint and quote_mint are the same", async function () {
    const { baseMint, createKey, recordAuthority, liquidationAuthority } =
      await setupLiquidation(this);

    const callbacks = expectError(
      "InvalidMint",
      "Should have thrown InvalidMint error",
    );

    await liquidationClient
      .initializeLiquidationIx({
        durationSeconds: 86400,
        createKey: createKey.publicKey,
        recordAuthority: recordAuthority.publicKey,
        liquidationAuthority: liquidationAuthority.publicKey,
        baseMint,
        quoteMint: baseMint,
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws error when duration_seconds is zero", async function () {
    const {
      baseMint,
      quoteMint,
      createKey,
      recordAuthority,
      liquidationAuthority,
    } = await setupLiquidation(this);

    const callbacks = expectError(
      "InvalidDuration",
      "Should have thrown InvalidDuration error",
    );

    await liquidationClient
      .initializeLiquidationIx({
        durationSeconds: 0,
        createKey: createKey.publicKey,
        recordAuthority: recordAuthority.publicKey,
        liquidationAuthority: liquidationAuthority.publicKey,
        baseMint,
        quoteMint,
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
