import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { setupBasicDao, expectError } from "../../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";

// 2.5M whole tokens — the DEFAULT_BASE_TO_SUPERMAJORITY_TOKENS the migration applies,
// scaled to base units by the base mint's on-chain decimals.
const SUPERMAJORITY_WHOLE = new BN(2_500_000);
const scaledSupermajority = (decimals: number) =>
  SUPERMAJORITY_WHOLE.mul(new BN(10).pow(new BN(decimals)));

type OldLayoutOverrides = {
  baseToStake?: BN;
  optimisticProposal?: {
    squadsProposal: PublicKey;
    enqueuedTimestamp: BN;
  } | null;
  isOptimisticGovernanceEnabled?: boolean;
};

// Rewrites a real (new-layout) Dao account to the pre-migration on-chain layout
// by re-encoding its body as the `oldDao` IDL type (dropping the appended
// `base_to_supermajority`). Truncation does NOT work for Dao: its Option slack
// would leave the field's bytes in place. Optional field overrides let a test
// pin base_to_stake / optimistic state without driving the real instructions.
async function makeOldLayout(
  ctx: TestContext,
  dao: PublicKey,
  overrides: OldLayoutOverrides = {},
  opts: { lamports?: number } = {},
): Promise<{ AFTER: number; BEFORE: number }> {
  const raw = await ctx.banksClient.getAccount(dao);
  const AFTER = raw.data.length;
  const BEFORE = AFTER - 8; // base_to_supermajority is a u64

  const disc = Buffer.from(raw.data.slice(0, 8));
  const coder = ctx.futarchy.futarchy.account.dao.coder.accounts;
  const decoded = coder.decode("dao", Buffer.from(raw.data));

  if (overrides.baseToStake !== undefined)
    decoded.baseToStake = overrides.baseToStake;
  if (overrides.optimisticProposal !== undefined)
    decoded.optimisticProposal = overrides.optimisticProposal;
  if (overrides.isOptimisticGovernanceEnabled !== undefined)
    decoded.isOptimisticGovernanceEnabled =
      overrides.isOptimisticGovernanceEnabled;

  // Encode as oldDao (current layout, no supermajority); drop its discriminator
  // and reattach the real Dao discriminator at the pre-migration size.
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

  it("migrates a 6-decimal DAO to the scaled 2.5M bar, preserving every other field", async function () {
    const original = await this.futarchy.getDao(dao);
    assert.equal(original.baseToSupermajority.toNumber(), 0);

    const { AFTER, BEFORE } = await makeOldLayout(this, dao);

    // A short Dao is NOT frozen (unlike a Proposal): it decodes with
    // base_to_supermajority === 0, read from the Option zero-slack. This is the
    // empirical confirmation of the non-freeze conclusion.
    const short = await this.banksClient.getAccount(dao);
    assert.equal(short.data.length, BEFORE);
    const preResize = await this.futarchy.getDao(dao);
    assert.equal(preResize.baseToSupermajority.toNumber(), 0);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, baseMint: META, payer: this.payer.publicKey })
      .rpc();

    const resized = await this.banksClient.getAccount(dao);
    assert.equal(resized.data.length, AFTER);

    const migrated = await this.futarchy.getDao(dao);
    assert.equal(
      migrated.baseToSupermajority.toString(),
      scaledSupermajority(6).toString(),
    );

    // base_to_supermajority is the ONLY field that changed (0 -> scaled 2.5M);
    // everything else round-trips untouched.
    const a = JSON.parse(JSON.stringify(migrated));
    const b = JSON.parse(JSON.stringify(original));
    delete a.baseToSupermajority;
    delete b.baseToSupermajority;
    assert.deepEqual(a, b);

    // Idempotent: a second crank is a no-op (compute-budget bump for a unique sig).
    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, baseMint: META, payer: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const after2 = await this.banksClient.getAccount(dao);
    assert.equal(after2.data.length, AFTER);
    const migrated2 = await this.futarchy.getDao(dao);
    assert.equal(
      migrated2.baseToSupermajority.toString(),
      scaledSupermajority(6).toString(),
    );
  });

  it("scales the supermajority bar by the base mint's on-chain decimals (9-decimal)", async function () {
    const META9 = await this.createMint(this.payer.publicKey, 9);
    const dao9 = await setupBasicDao({
      context: this,
      baseMint: META9,
      quoteMint: USDC,
    });

    await makeOldLayout(this, dao9);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao: dao9, baseMint: META9, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getDao(dao9);
    // 2.5M * 10^9, NOT the 6-decimal value — guards the on-chain decimals derivation.
    assert.equal(
      migrated.baseToSupermajority.toString(),
      scaledSupermajority(9).toString(),
    );
  });

  it("rejects a base_mint that does not match the DAO", async function () {
    await makeOldLayout(this, dao);

    // A fabricated mint (here also 6-decimal, but any mint) must be rejected:
    // the permissionless crank binds base_mint to dao.base_mint.
    const wrongMint = await this.createMint(this.payer.publicKey, 6);

    const callbacks = expectError(
      "InvalidMint",
      "resize_dao must reject a base_mint that isn't the DAO's",
    );

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, baseMint: wrongMint, payer: this.payer.publicKey })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("preserves optimistic governance fields through the migration", async function () {
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
      .accounts({ dao, baseMint: META, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getDao(dao);
    // Must carry over from `old`, NOT reset to None/false.
    assert.isTrue(migrated.isOptimisticGovernanceEnabled);
    assert.exists(migrated.optimisticProposal);
    assert.isTrue(
      migrated.optimisticProposal.squadsProposal.equals(fakeSquadsProposal),
    );
    assert.equal(
      migrated.optimisticProposal.enqueuedTimestamp.toString(),
      "1700000000",
    );
  });

  it("never lets the supermajority bar migrate in below base_to_stake (high floor)", async function () {
    // base_to_stake above 2.5M whole tokens (at 6 decimals).
    const highFloor = new BN(3_000_000).mul(new BN(10 ** 6));
    await makeOldLayout(this, dao, { baseToStake: highFloor });

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, baseMint: META, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getDao(dao);
    // max(2.5M scaled, base_to_stake) == base_to_stake, not the flat default.
    assert.equal(migrated.baseToStake.toString(), highFloor.toString());
    assert.equal(migrated.baseToSupermajority.toString(), highFloor.toString());
  });

  it("is a no-op on an already-new-layout DAO", async function () {
    const before = await this.futarchy.getDao(dao);
    const beforeRaw = await this.banksClient.getAccount(dao);

    await this.futarchy.futarchy.methods
      .resizeDao()
      .accounts({ dao, baseMint: META, payer: this.payer.publicKey })
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
    const BEFORE = AFTER - 8;
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
      .accounts({ dao, baseMint: META, payer: crankPayer.publicKey })
      .signers([crankPayer])
      .rpc();

    const payerAfter = await this.banksClient.getBalance(crankPayer.publicKey);
    const daoLamports = await this.banksClient.getBalance(dao);

    // Account brought exactly to the new rent-exempt minimum, funded by the payer.
    assert.equal(daoLamports.toString(), rentAfter.toString());
    assert.equal((payerBefore - payerAfter).toString(), delta.toString());
  });
}
