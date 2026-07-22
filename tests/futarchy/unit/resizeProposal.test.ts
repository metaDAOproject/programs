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
// appended `pass_threshold_bps`, `council_can_block`, and `action`). The
// optional override lets a test pin `is_team_sponsored` without driving the
// sponsor flow.
async function makeOldLayout(
  ctx: TestContext,
  proposal: PublicKey,
  overrides: { isTeamSponsored?: boolean } = {},
): Promise<{ AFTER: number; BEFORE: number }> {
  const raw = await ctx.banksClient.getAccount(proposal);
  const AFTER = raw.data.length;
  // 369 bytes: pass_threshold_bps (i16) + council_can_block (bool)
  // + action (ProposalAction)
  const BEFORE = AFTER - 369;

  const disc = Buffer.from(raw.data.slice(0, 8));
  const coder = ctx.futarchy.futarchy.account.proposal.coder.accounts;
  const decoded = coder.decode("proposal", Buffer.from(raw.data));

  if (overrides.isTeamSponsored !== undefined)
    decoded.isTeamSponsored = overrides.isTeamSponsored;

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

  it("migrates an old proposal with defaults snapshotted from the DAO, preserving every other field", async function () {
    const original = await this.futarchy.getProposal(proposal);
    assert.isFalse(original.isTeamSponsored);
    assert.equal(original.passThresholdBps, 1000);

    const { AFTER, BEFORE } = await makeOldLayout(this, proposal);

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
    // The vestigial per-DAO threshold (300), not the kind constant (1000).
    assert.equal(migrated.passThresholdBps, 300);

    original.passThresholdBps = 300;
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

  it("snapshots the team-sponsored threshold for a team-sponsored proposal", async function () {
    await makeOldLayout(this, proposal, { isTeamSponsored: true });

    await this.futarchy.futarchy.methods
      .resizeProposal()
      .accounts({ proposal, dao, payer: this.payer.publicKey })
      .rpc();

    const migrated = await this.futarchy.getProposal(proposal);
    assert.isTrue(migrated.isTeamSponsored);
    assert.equal(migrated.passThresholdBps, -100);
    assert.isDefined(migrated.action.executeArbitrary);
    assert.isTrue(migrated.councilCanBlock);
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
