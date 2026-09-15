import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { expectError, setupBasicDao } from "../../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";

// Rewrites a real (new-layout) Proposal account to the pre-migration on-chain
// layout by re-encoding its body as the `oldProposal` IDL type (dropping the
// appended `pass_threshold_bps`, `council_can_block`, and `action`, and
// collapsing `sponsored_by` back to the `is_team_sponsored` bit). The
// optional overrides let a test pin `is_team_sponsored`, the state, or the
// duration without driving the sponsor/launch flows.
async function makeOldLayout(
  ctx: TestContext,
  proposal: PublicKey,
  overrides: {
    isTeamSponsored?: boolean;
    state?: object;
    durationInSeconds?: number;
  } = {},
): Promise<{ AFTER: number; BEFORE: number }> {
  const raw = await ctx.banksClient.getAccount(proposal);
  const AFTER = raw.data.length;
  // 401 bytes: sponsored_by (Option<Pubkey>) in place of is_team_sponsored (bool)
  // + pass_threshold_bps (i16) + council_can_block (bool) + action (ProposalAction)
  const BEFORE = AFTER - 401;

  const disc = Buffer.from(raw.data.slice(0, 8));
  const coder = ctx.futarchy.futarchy.account.proposal.coder.accounts;
  const decoded = coder.decode("proposal", Buffer.from(raw.data));

  decoded.isTeamSponsored = overrides.isTeamSponsored ?? false;
  if (overrides.state !== undefined) decoded.state = overrides.state;
  if (overrides.durationInSeconds !== undefined)
    decoded.durationInSeconds = overrides.durationInSeconds;

  const body = await coder.encode("oldProposal", decoded);
  const buf = Buffer.alloc(BEFORE);
  disc.copy(buf, 0);
  body.subarray(8).copy(buf, 8);

  ctx.context.setAccount(proposal, { ...raw, data: buf });

  return { AFTER, BEFORE };
}

// Creates the Squads vault transaction + proposal pair (with an arbitrary
// message payload) and the futarchy proposal on top of them.
async function createProposal(
  ctx: TestContext,
  dao: PublicKey,
): Promise<PublicKey> {
  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

  const message = new TransactionMessage({
    payerKey: ctx.payer.publicKey,
    recentBlockhash: (await ctx.banksClient.getLatestBlockhash())[0],
    instructions: [
      SystemProgram.transfer({
        fromPubkey: ctx.payer.publicKey,
        toPubkey: ctx.payer.publicKey,
        lamports: 1,
      }),
    ],
  });

  const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: 1n,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: ctx.payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: message,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex: 1n,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: ctx.payer.publicKey,
  });

  const [squadsProposal] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: 1n,
  });

  const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
  tx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
  tx.feePayer = ctx.payer.publicKey;
  tx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);
  await ctx.banksClient.processTransaction(tx);

  return ctx.futarchy.initializeProposal(dao, squadsProposal);
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Distinct thresholds (300 vs -100) so the two snapshot branches are
    // distinguishable, and both differ from ExecuteArbitrary's constant (1000).
    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      teamSponsoredPassThresholdBps: -100,
    });

    proposal = await createProposal(this, dao);
  });

  it("migrates an old draft to the kind's catalog params, preserving every other field", async function () {
    const original = await this.futarchy.getProposal(proposal);
    assert.isNull(original.sponsoredBy);
    assert.equal(original.passThresholdBps, 1000);
    assert.equal(original.durationInSeconds, 60 * 60 * 24 * 10);

    // A distinctive legacy duration proves normalization to the catalog value.
    const { AFTER, BEFORE } = await makeOldLayout(this, proposal, {
      durationInSeconds: 3600,
    });

    const short = await this.banksClient.getAccount(proposal);
    assert.equal(short.data.length, BEFORE);

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const resized = await this.banksClient.getAccount(proposal);
    assert.equal(resized.data.length, AFTER);

    const migrated = await this.futarchy.getProposal(proposal);
    assert.isDefined(migrated.action.executeArbitrary);
    assert.isTrue(migrated.councilCanBlock);
    // The kind constants, not the vestigial per-DAO threshold (300) or the
    // legacy duration: a draft has no live market, so the permissionless
    // crank's timing must not decide the rules it finalizes under.
    assert.equal(migrated.passThresholdBps, 1000);
    assert.equal(migrated.durationInSeconds, 60 * 60 * 24 * 10);

    assert.deepEqual(
      JSON.parse(JSON.stringify(migrated)),
      JSON.parse(JSON.stringify(original)),
    );

    // Idempotent: a second crank is a no-op (compute-budget bump for a unique sig).
    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc();

    const after2 = await this.banksClient.getAccount(proposal);
    assert.equal(after2.data.length, AFTER);

    const migrated2 = await this.futarchy.getProposal(proposal);
    assert.deepEqual(
      JSON.parse(JSON.stringify(migrated2)),
      JSON.parse(JSON.stringify(migrated)),
    );
  });

  it("migrates a team-sponsored draft to the catalog params too", async function () {
    await makeOldLayout(this, proposal, { isTeamSponsored: true });

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getProposal(proposal);
    assert.equal(
      migrated.sponsoredBy?.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(migrated.passThresholdBps, 1000);
  });

  it("snapshots the DAO threshold and preserves the duration for a launched proposal", async function () {
    await makeOldLayout(this, proposal, {
      state: { pending: {} },
      durationInSeconds: 3600,
    });

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getProposal(proposal);
    assert.isDefined(migrated.state.pending);
    // A live market keeps the rules it was staked and traded under: the
    // vestigial per-DAO threshold (300), not the kind constant (1000).
    assert.equal(migrated.passThresholdBps, 300);
    assert.equal(migrated.durationInSeconds, 3600);
    assert.isDefined(migrated.action.executeArbitrary);
    assert.isTrue(migrated.councilCanBlock);
  });

  it("snapshots the team-sponsored threshold for a launched team-sponsored proposal", async function () {
    await makeOldLayout(this, proposal, {
      state: { pending: {} },
      isTeamSponsored: true,
    });

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getProposal(proposal);
    assert.equal(
      migrated.sponsoredBy?.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(migrated.passThresholdBps, -100);
  });

  it("is a no-op on an already-new-layout proposal", async function () {
    const before = await this.futarchy.getProposal(proposal);
    const beforeRaw = await this.banksClient.getAccount(proposal);

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const afterRaw = await this.banksClient.getAccount(proposal);
    assert.equal(afterRaw.data.length, beforeRaw.data.length);

    const after = await this.futarchy.getProposal(proposal);
    assert.deepEqual(
      JSON.parse(JSON.stringify(after)),
      JSON.parse(JSON.stringify(before)),
    );
  });

  it("leaves a migrated draft retunable by admin_update_proposal_params", async function () {
    await makeOldLayout(this, proposal);

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    // Migrated drafts land on the catalog params, and stay `ExecuteArbitrary`
    // drafts — so the per-proposal admin lever must still apply to them.
    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: 60 * 60 * 24 * 2,
        passThresholdBps: 500,
      })
      .rpc();

    const retuned = await this.futarchy.getProposal(proposal);
    assert.equal(retuned.durationInSeconds, 60 * 60 * 24 * 2);
    assert.equal(retuned.passThresholdBps, 500);
  });

  it("rejects a DAO that is not the proposal's", async function () {
    const otherDao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    await makeOldLayout(this, proposal);

    const callbacks = expectError(
      "RequireKeysEqViolated",
      "resized against a DAO that is not the proposal's",
    );

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao: otherDao, payer: this.payer.publicKey })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
