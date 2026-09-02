import { getSpendingLimitAddr } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, makeOldDaoLayout, setupBasicDao } from "../../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";

// Byte offsets into a Squads SpendingLimit account's data:
// disc(8) multisig(32) create_key(32) vault_index(1) mint(32) amount(8)
// period(1) remaining_amount(8) last_reset(8) bump(1) members(vec) destinations(vec)
const SL_VAULT_INDEX_OFFSET = 72;
const SL_MINT_OFFSET = 73;
const SL_PERIOD_OFFSET = 113;
const SL_MEMBERS_LEN_OFFSET = 131;
const PERIOD_DAY = 1;

// Overwrites the live Squads spending-limit account with mutated bytes —
// shapes the old program's governance path could have created but the new
// program never writes. Returns the patched data so tests can assert the
// migration left the account untouched.
async function patchLiveSpendingLimit(
  ctx: TestContext,
  dao: PublicKey,
  mutate: (data: Buffer) => Buffer,
): Promise<Buffer> {
  const [spendingLimit] = getSpendingLimitAddr({ dao });
  const raw = await ctx.banksClient.getAccount(spendingLimit);
  const patched = mutate(Buffer.from(raw.data));
  ctx.context.setAccount(spendingLimit, { ...raw, data: patched });
  return patched;
}

function withMembers(data: Buffer, members: PublicKey[]): Buffer {
  const oldLen = data.readUInt32LE(SL_MEMBERS_LEN_OFFSET);
  const destinationsOffset = SL_MEMBERS_LEN_OFFSET + 4 + 32 * oldLen;
  const len = Buffer.alloc(4);
  len.writeUInt32LE(members.length, 0);
  return Buffer.concat([
    data.subarray(0, SL_MEMBERS_LEN_OFFSET),
    len,
    ...members.map((m) => Buffer.from(m.toBytes())),
    data.subarray(destinationsOffset),
  ]);
}

function withDestinations(data: Buffer, destinations: PublicKey[]): Buffer {
  const membersLen = data.readUInt32LE(SL_MEMBERS_LEN_OFFSET);
  const destinationsOffset = SL_MEMBERS_LEN_OFFSET + 4 + 32 * membersLen;
  const len = Buffer.alloc(4);
  len.writeUInt32LE(destinations.length, 0);
  return Buffer.concat([
    data.subarray(0, destinationsOffset),
    len,
    ...destinations.map((d) => Buffer.from(d.toBytes())),
  ]);
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
    assert.equal(original.lastBuybackFinalizedAt.toString(), "0");

    const { AFTER, BEFORE } = await makeOldDaoLayout(this, dao);

    const short = await this.banksClient.getAccount(dao);
    assert.equal(short.data.length, BEFORE);

    await this.futarchy.resizeDaoIx({ dao }).rpc();

    const resized = await this.banksClient.getAccount(dao);
    assert.equal(resized.data.length, AFTER);

    const migrated = await this.futarchy.getDao(dao);
    assert.isNull(migrated.liquidator);
    assert.equal(migrated.lastFailedTakeoverAt.toString(), "0");
    assert.equal(migrated.lastFailedLiquidationAt.toString(), "0");
    assert.isFalse(migrated.spendingLimitDirty);
    assert.equal(migrated.lastBuybackFinalizedAt.toString(), "0");

    assert.deepEqual(
      JSON.parse(JSON.stringify(migrated)),
      JSON.parse(JSON.stringify(original)),
    );

    // Idempotent: a second crank is a no-op (compute-budget bump for a unique sig).
    await this.futarchy
      .resizeDaoIx({ dao })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const after2 = await this.banksClient.getAccount(dao);
    assert.equal(after2.data.length, AFTER);
  });

  it("clears an in-flight optimistic proposal and disables the governance flag", async function () {
    const fakeSquadsProposal = Keypair.generate().publicKey;
    await makeOldDaoLayout(this, dao, {
      isOptimisticGovernanceEnabled: true,
      optimisticProposal: {
        squadsProposal: fakeSquadsProposal,
        enqueuedTimestamp: new BN(1_700_000_000),
      },
    });

    await this.futarchy.resizeDaoIx({ dao }).rpc();

    const migrated = await this.futarchy.getDao(dao);
    // The optimistic machinery is gone: in-flight spends are cleared, not
    // carried into a state nothing can finalize, and the flag is reset.
    assert.isNull(migrated.optimisticProposal);
    assert.isFalse(migrated.isOptimisticGovernanceEnabled);
    assert.isNull(migrated.liquidator);
    assert.equal(migrated.lastFailedTakeoverAt.toString(), "0");
    assert.equal(migrated.lastFailedLiquidationAt.toString(), "0");
    assert.isFalse(migrated.spendingLimitDirty);
    assert.equal(migrated.lastBuybackFinalizedAt.toString(), "0");
  });

  it("is a no-op on an already-new-layout DAO", async function () {
    const before = await this.futarchy.getDao(dao);
    const beforeRaw = await this.banksClient.getAccount(dao);

    await this.futarchy.resizeDaoIx({ dao }).rpc();

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
    const BEFORE = AFTER - 58;
    const rentBefore = rent.minimumBalance(BigInt(BEFORE));
    const rentAfter = rent.minimumBalance(BigInt(AFTER));
    const delta = rentAfter - rentBefore;

    // Shrink to old layout AND drop lamports to the old rent-exempt minimum so
    // the realloc forces a top-up transfer.
    await makeOldDaoLayout(this, dao, {}, { lamports: Number(rentBefore) });

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

    await this.futarchy
      .resizeDaoIx({ dao, payer: crankPayer.publicKey })
      .signers([crankPayer])
      .rpc();

    const payerAfter = await this.banksClient.getBalance(crankPayer.publicKey);
    const daoLamports = await this.banksClient.getBalance(dao);

    // Account brought exactly to the new rent-exempt minimum, funded by the payer.
    assert.equal(daoLamports.toString(), rentAfter.toString());
    assert.equal((payerBefore - payerAfter).toString(), delta.toString());
  });

  it("migrates the live Squads limit, not the stale legacy field", async function () {
    const limitDao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      initialSpendingLimit: {
        amountPerMonth: new BN(1_000_000_000),
        members: [this.payer.publicKey],
      },
    });

    // The legacy field claims 5,000/month even though the live limit is
    // 1,000 — the divergence pre-upgrade governance could have created.
    await makeOldDaoLayout(this, limitDao, {
      initialSpendingLimit: {
        amountPerMonth: new BN(5_000_000_000),
        members: [Keypair.generate().publicKey],
      },
    });

    await this.futarchy.resizeDaoIx({ dao: limitDao }).rpc();

    const migrated = await this.futarchy.getDao(limitDao);
    assert.equal(
      migrated.initialSpendingLimit.amountPerMonth.toString(),
      "1000000000",
    );
    assert.deepEqual(
      migrated.initialSpendingLimit.members.map((m: PublicKey) => m.toBase58()),
      [this.payer.publicKey.toBase58()],
    );
    assert.isFalse(migrated.spendingLimitDirty);
  });

  it("migrates a stale legacy value as none when no live limit exists", async function () {
    // The beforeEach DAO never created a Squads limit, but the legacy field
    // claims one exists.
    await makeOldDaoLayout(this, dao, {
      initialSpendingLimit: {
        amountPerMonth: new BN(1_000_000_000),
        members: [this.payer.publicKey],
      },
    });

    await this.futarchy.resizeDaoIx({ dao }).rpc();

    const migrated = await this.futarchy.getDao(dao);
    assert.isNull(migrated.initialSpendingLimit);
    assert.isFalse(migrated.spendingLimitDirty);
  });

  async function assertShapeMigratesAsNone(
    ctx: TestContext,
    mutate: (data: Buffer) => Buffer,
  ) {
    const limitDao = await setupBasicDao({
      context: ctx,
      baseMint: META,
      quoteMint: USDC,
      initialSpendingLimit: {
        amountPerMonth: new BN(1_000_000_000),
        members: [ctx.payer.publicKey],
      },
    });

    const patched = await patchLiveSpendingLimit(ctx, limitDao, mutate);
    await makeOldDaoLayout(ctx, limitDao);

    await ctx.futarchy.resizeDaoIx({ dao: limitDao }).rpc();

    const migrated = await ctx.futarchy.getDao(limitDao);
    assert.isNull(migrated.initialSpendingLimit);

    // The live Squads account is read, never written.
    const [spendingLimit] = getSpendingLimitAddr({ dao: limitDao });
    const after = await ctx.banksClient.getAccount(spendingLimit);
    assert.isTrue(Buffer.from(after.data).equals(patched));
  }

  it("migrates a non-Month live limit as none, leaving Squads untouched", async function () {
    await assertShapeMigratesAsNone(this, (data) => {
      data[SL_PERIOD_OFFSET] = PERIOD_DAY;
      return data;
    });
  });

  it("migrates a foreign-mint live limit as none, leaving Squads untouched", async function () {
    await assertShapeMigratesAsNone(this, (data) => {
      Buffer.from(Keypair.generate().publicKey.toBytes()).copy(
        data,
        SL_MINT_OFFSET,
      );
      return data;
    });
  });

  it("migrates a non-zero-vault live limit as none, leaving Squads untouched", async function () {
    await assertShapeMigratesAsNone(this, (data) => {
      data[SL_VAULT_INDEX_OFFSET] = 1;
      return data;
    });
  });

  it("migrates a live limit with too many members as none, leaving Squads untouched", async function () {
    await assertShapeMigratesAsNone(this, (data) =>
      withMembers(
        data,
        Array.from({ length: 11 }, () => Keypair.generate().publicKey),
      ),
    );
  });

  it("migrates a destination-restricted live limit as none, leaving Squads untouched", async function () {
    await assertShapeMigratesAsNone(this, (data) =>
      withDestinations(data, [Keypair.generate().publicKey]),
    );
  });

  it("throws when passed a non-canonical spending-limit account", async function () {
    await makeOldDaoLayout(this, dao);

    const callbacks = expectError(
      "InvalidSpendingLimitAccount",
      "resize succeeded despite a wrong spending-limit account",
    );
    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({
        dao,
        spendingLimit: Keypair.generate().publicKey,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(...callbacks);
  });
}
