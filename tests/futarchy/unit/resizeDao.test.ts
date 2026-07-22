import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { setupBasicDao } from "../../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";

type OldLayoutOverrides = {
  optimisticProposal?: {
    squadsProposal: PublicKey;
    enqueuedTimestamp: BN;
  } | null;
  isOptimisticGovernanceEnabled?: boolean;
};

// Rewrites a real (new-layout) Dao account to the pre-migration on-chain layout
// by re-encoding its body as the `oldDao` IDL type (dropping the appended
// `liquidator`, failure timestamps, and `spending_limit_dirty`). Truncation does
// NOT work for Dao: its Option slack would leave the fields' bytes in place.
// Optional overrides let a test pin the optimistic fields without driving the
// (now deleted) optimistic instructions.
async function makeOldLayout(
  ctx: TestContext,
  dao: PublicKey,
  overrides: OldLayoutOverrides = {},
  opts: { lamports?: number } = {},
): Promise<{ AFTER: number; BEFORE: number }> {
  const raw = await ctx.banksClient.getAccount(dao);
  const AFTER = raw.data.length;
  // 50 bytes: liquidator (Option<Pubkey>) + last_failed_takeover_at (i64)
  // + last_failed_liquidation_at (i64) + spending_limit_dirty (bool)
  const BEFORE = AFTER - 50;

  const disc = Buffer.from(raw.data.slice(0, 8));
  const coder = ctx.futarchy.futarchy.account.dao.coder.accounts;
  const decoded = coder.decode("dao", Buffer.from(raw.data));

  if (overrides.optimisticProposal !== undefined)
    decoded.optimisticProposal = overrides.optimisticProposal;
  if (overrides.isOptimisticGovernanceEnabled !== undefined)
    decoded.isOptimisticGovernanceEnabled =
      overrides.isOptimisticGovernanceEnabled;

  // Encode as oldDao (mainnet layout, ending at is_optimistic_governance_enabled);
  // drop its discriminator and reattach the real Dao discriminator at the
  // pre-migration size.
  const body = await coder.encode("oldDao", decoded);
  const buf = Buffer.alloc(BEFORE);
  disc.copy(buf, 0);
  body.subarray(8).copy(buf, 8);

  ctx.context.setAccount(dao, {
    ...raw,
    data: buf,
    ...(opts.lamports !== undefined ? { lamports: opts.lamports } : {}),
  });

  return { AFTER, BEFORE };
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("migrates an old DAO with the new fields defaulted, preserving every other field", async function () {
    const original = await this.futarchy.getDao(dao);
    // The migration defaults must match a freshly-initialized DAO, so the
    // whole account can round-trip equal below.
    assert.isNull(original.liquidator);
    assert.equal(original.lastFailedTakeoverAt.toString(), "0");
    assert.equal(original.lastFailedLiquidationAt.toString(), "0");
    assert.isFalse(original.spendingLimitDirty);

    const { AFTER, BEFORE } = await makeOldLayout(this, dao);

    const short = await this.banksClient.getAccount(dao);
    assert.equal(short.data.length, BEFORE);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, payer: this.payer.publicKey })
      .rpc();

    const resized = await this.banksClient.getAccount(dao);
    assert.equal(resized.data.length, AFTER);

    const migrated = await this.futarchy.getDao(dao);
    assert.isNull(migrated.liquidator);
    assert.equal(migrated.lastFailedTakeoverAt.toString(), "0");
    assert.equal(migrated.lastFailedLiquidationAt.toString(), "0");
    assert.isFalse(migrated.spendingLimitDirty);

    assert.deepEqual(
      JSON.parse(JSON.stringify(migrated)),
      JSON.parse(JSON.stringify(original)),
    );

    // Idempotent: a second crank is a no-op (compute-budget bump for a unique sig).
    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, payer: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const after2 = await this.banksClient.getAccount(dao);
    assert.equal(after2.data.length, AFTER);
  });

  it("clears an in-flight optimistic proposal and carries the governance flag", async function () {
    const fakeSquadsProposal = Keypair.generate().publicKey;
    await makeOldLayout(this, dao, {
      isOptimisticGovernanceEnabled: true,
      optimisticProposal: {
        squadsProposal: fakeSquadsProposal,
        enqueuedTimestamp: new BN(1_700_000_000),
      },
    });

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getDao(dao);
    // The optimistic machinery is gone: in-flight spends are cleared, not
    // carried into a state nothing can finalize.
    assert.isNull(migrated.optimisticProposal);
    assert.isTrue(migrated.isOptimisticGovernanceEnabled);
    assert.isNull(migrated.liquidator);
    assert.equal(migrated.lastFailedTakeoverAt.toString(), "0");
    assert.equal(migrated.lastFailedLiquidationAt.toString(), "0");
    assert.isFalse(migrated.spendingLimitDirty);
  });

  it("is a no-op on an already-new-layout DAO", async function () {
    const before = await this.futarchy.getDao(dao);
    const beforeRaw = await this.banksClient.getAccount(dao);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, payer: this.payer.publicKey })
      .rpc();

    const afterRaw = await this.banksClient.getAccount(dao);
    assert.equal(afterRaw.data.length, beforeRaw.data.length);

    const after = await this.futarchy.getDao(dao);
    assert.deepEqual(
      JSON.parse(JSON.stringify(after)),
      JSON.parse(JSON.stringify(before)),
    );
  });

  it("tops up rent from the payer when the migrated account is under-funded", async function () {
    const rent = await this.banksClient.getRent();
    const raw0 = await this.banksClient.getAccount(dao);
    const AFTER = raw0.data.length;
    const BEFORE = AFTER - 50;
    const rentBefore = rent.minimumBalance(BigInt(BEFORE));
    const rentAfter = rent.minimumBalance(BigInt(AFTER));
    const delta = rentAfter - rentBefore;

    // Shrink to old layout AND drop lamports to the old rent-exempt minimum so
    // the realloc forces a top-up transfer.
    await makeOldLayout(this, dao, {}, { lamports: Number(rentBefore) });

    // Dedicated crank payer (not the fee payer) so its balance change isolates
    // the top-up transfer from transaction fees.
    const crankPayer = Keypair.generate();
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: crankPayer.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    const payerBefore = await this.banksClient.getBalance(crankPayer.publicKey);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, payer: crankPayer.publicKey })
      .signers([crankPayer])
      .rpc();

    const payerAfter = await this.banksClient.getBalance(crankPayer.publicKey);
    const daoLamports = await this.banksClient.getBalance(dao);

    // Account brought exactly to the new rent-exempt minimum, funded by the payer.
    assert.equal(daoLamports.toString(), rentAfter.toString());
    assert.equal((payerBefore - payerAfter).toString(), delta.toString());
  });
}
