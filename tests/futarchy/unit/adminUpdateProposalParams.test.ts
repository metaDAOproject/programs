import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";
import { expectError, passProposal, setupBasicDao } from "../../utils.js";
import { TestContext } from "../../main.test.js";

// ExecuteArbitrary's catalog parameters, and the start delay the duration
// floor is a strict comparison against.
const DAY_SECONDS = 60 * 60 * 24;
const ARBITRARY_DURATION_SECONDS = DAY_SECONDS * 10;
const ARBITRARY_PASS_THRESHOLD_BPS = 1000;

// Creates the Squads vault transaction + proposal pair at transaction index 1
// and the draft ExecuteArbitrary proposal on top of them.
async function createArbitraryProposal(
  ctx: TestContext,
  dao: PublicKey,
): Promise<{ proposal: PublicKey; squadsProposal: PublicKey }> {
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

  return {
    proposal: await ctx.futarchy.initializeProposal(dao, squadsProposal),
    squadsProposal,
  };
}

// Re-encodes an account in place, padded back to its allocated length. The two
// callers below both need state no instruction on the branch can produce.
async function rewriteAccount(
  ctx: TestContext,
  address: PublicKey,
  name: "proposal" | "dao",
  mutate: (decoded: any) => void,
) {
  const raw = await ctx.banksClient.getAccount(address);
  const coder = ctx.futarchy.futarchy.account[name].coder.accounts;
  const decoded = coder.decode(name, Buffer.from(raw.data));

  mutate(decoded);

  const buf = Buffer.alloc(raw.data.length);
  (await coder.encode(name, decoded)).copy(buf, 0);

  ctx.context.setAccount(address, { ...raw, data: buf });
}

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    squadsProposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 200 * 1_000_000);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      initialSpendingLimit: {
        amountPerMonth: new BN(10_000 * 1_000_000),
        members: [this.payer.publicKey],
      },
    });

    ({ proposal, squadsProposal } = await createArbitraryProposal(this, dao));
  });

  // The market a launch needs; only the launching cases pay for it.
  const provideLiquidity = async function (ctx: TestContext) {
    await ctx.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000),
        maxBaseAmount: new BN(100 * 1_000_000),
        minLiquidity: new BN(0),
        positionAuthority: ctx.payer.publicKey,
        liquidityProvider: ctx.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();
  };

  it("updates both parameters on a draft arbitrary proposal", async function () {
    const before = await this.futarchy.getProposal(proposal);
    assert.equal(before.durationInSeconds, ARBITRARY_DURATION_SECONDS);
    assert.equal(before.passThresholdBps, ARBITRARY_PASS_THRESHOLD_BPS);

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
        passThresholdBps: 200,
      })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(after.durationInSeconds, DAY_SECONDS * 2);
    assert.equal(after.passThresholdBps, 200);
  });

  it("leaves the threshold alone when only the duration is set", async function () {
    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 3,
      })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(after.durationInSeconds, DAY_SECONDS * 3);
    assert.equal(after.passThresholdBps, ARBITRARY_PASS_THRESHOLD_BPS);
  });

  it("leaves the duration alone when only the threshold is set", async function () {
    await this.futarchy
      .adminUpdateProposalParamsIx({ proposal, dao, passThresholdBps: -500 })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(after.durationInSeconds, ARBITRARY_DURATION_SECONDS);
    assert.equal(after.passThresholdBps, -500);
  });

  it("is re-runnable: the second call wins", async function () {
    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
        passThresholdBps: 200,
      })
      .rpc();

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 4,
        passThresholdBps: -200,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(after.durationInSeconds, DAY_SECONDS * 4);
    assert.equal(after.passThresholdBps, -200);
  });

  // Ensures that sponsorship doesn't clobber the threshold update if threshold changes are re-introduced into sponsorship
  it("composes with sponsorship when the proposal is sponsored first", async function () {
    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
        passThresholdBps: 200,
      })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(
      after.sponsoredBy?.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(after.durationInSeconds, DAY_SECONDS * 2);
    assert.equal(after.passThresholdBps, 200);
  });

  // Ensures that sponsorship doesn't clobber the threshold update if threshold changes are re-introduced into sponsorship
  it("composes with sponsorship when the proposal is sponsored last", async function () {
    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
        passThresholdBps: 200,
      })
      .rpc();

    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(
      after.sponsoredBy?.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(after.durationInSeconds, DAY_SECONDS * 2);
    assert.equal(after.passThresholdBps, 200);
  });

  it("rejects a typed proposal", async function () {
    const { proposal: largeSpend } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: new BN(1_000 * 1_000_000),
      });

    const callbacks = expectError(
      "InvalidProposalKind",
      "should not retune a typed proposal",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal: largeSpend,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a launched proposal", async function () {
    await provideLiquidity(this);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    const callbacks = expectError(
      "ProposalNotInDraftState",
      "should not retune a live market",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a removed proposal", async function () {
    await this.futarchy.futarchy.methods
      .adminRemoveProposal()
      .accounts({ proposal, dao, admin: this.payer.publicKey })
      .rpc();

    const callbacks = expectError(
      "ProposalNotInDraftState",
      "should not retune a removed proposal",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a DAO that is not the proposal's", async function () {
    const otherDao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    const callbacks = expectError(
      "ConstraintHasOne",
      "should not retune against another DAO",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao: otherDao,
        durationInSeconds: DAY_SECONDS * 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a duration below the kind's TWAP start delay", async function () {
    const callbacks = expectError(
      "ProposalDurationTooShort",
      "should not accept a sub-day duration",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS / 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a duration exactly equal to the kind's TWAP start delay", async function () {
    const callbacks = expectError(
      "ProposalDurationTooShort",
      "the floor is strict, not inclusive",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("accepts a duration one second above the start delay", async function () {
    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS + 1,
      })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.equal(after.durationInSeconds, DAY_SECONDS + 1);
  });

  it("rejects thresholds one step outside the allowed range", async function () {
    for (const [i, passThresholdBps] of [10_000, -10_000].entries()) {
      const callbacks = expectError(
        "InvalidProposalPassThreshold",
        `should reject ${passThresholdBps} bps`,
      );

      await this.futarchy
        .adminUpdateProposalParamsIx({ proposal, dao, passThresholdBps })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    }
  });

  it("accepts both extremes of the allowed range", async function () {
    for (const [i, passThresholdBps] of [9_999, -9_999].entries()) {
      await this.futarchy
        .adminUpdateProposalParamsIx({ proposal, dao, passThresholdBps })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();

      const after = await this.futarchy.getProposal(proposal);
      assert.equal(after.passThresholdBps, passThresholdBps);
    }
  });

  it("rejects an update that sets neither field", async function () {
    const callbacks = expectError(
      "EmptyProposalParamsUpdate",
      "should not succeed while doing nothing",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({ proposal, dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses on a liquidated DAO", async function () {
    // `finalize_proposal` is the only writer of `dao.liquidator`, and reaching
    // it takes a full hostile-liquidate market.
    await rewriteAccount(this, dao, "dao", (decoded) => {
      decoded.liquidator = Keypair.generate().publicKey;
    });

    const callbacks = expectError(
      "DaoLiquidated",
      "should refuse on a liquidated DAO",
    );

    await this.futarchy
      .adminUpdateProposalParamsIx({
        proposal,
        dao,
        durationInSeconds: DAY_SECONDS * 2,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
