import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  executeVaultTransaction,
  expectError,
  makeOldDaoLayout,
  setupBasicDao,
} from "../../utils.js";
import {
  EMPTY_UPDATE_DAO_PARAMS,
  TYPED_PROPOSALS_OFF_DAO_TERMS,
} from "../utils.js";
import { TestContext } from "../../main.test.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

const CATALOG_DURATION_SECONDS = 60 * 60 * 24 * 10;
const CATALOG_PASS_THRESHOLD_BPS = 1000;
const CATALOG_TWAP_START_DELAY_SECONDS = 60 * 60 * 24;

const PRE_MIGRATION_DAO_SIZE = 1205;
const MIGRATED_DAO_SIZE = 1264;

const memoIx = new TransactionInstruction({
  programId: MEMO_PROGRAM_ID,
  keys: [],
  data: Buffer.from("arbitrary", "utf8"),
});

// A plain proposal at the multisig's next index whose vault transaction holds
// `instructions`.
async function filePlainProposal(
  ctx: TestContext,
  dao: PublicKey,
  instructions: TransactionInstruction[],
) {
  const { transactionIndex, squadsProposal, squadsTransaction } =
    await ctx.futarchy.getNextProposalAddrs(dao);

  const { tx } = ctx.futarchy.squadsProposalCreateTx({
    dao,
    instructions,
    transactionIndex,
  });
  [tx.recentBlockhash] = await ctx.banksClient.getLatestBlockhash();
  tx.feePayer = ctx.payer.publicKey;
  tx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);
  await ctx.banksClient.processTransaction(tx);

  const proposal = await ctx.futarchy.initializeProposal(dao, squadsProposal);

  return { proposal, squadsProposal, squadsTransaction };
}

// One spot swap after the warm-up records an observation in both conditional
// pools and leaves their TWAPs equal, then the market runs out.
async function runFlatMarketToEnd(
  ctx: TestContext,
  {
    dao,
    baseMint,
    quoteMint,
    twapStartDelaySeconds,
    durationInSeconds,
    computeUnitPrice,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    twapStartDelaySeconds: number;
    durationInSeconds: number;
    computeUnitPrice: number;
  },
) {
  await ctx.advanceBySeconds(twapStartDelaySeconds + 60);
  await ctx.futarchy
    .spotSwapIx({
      dao,
      baseMint,
      quoteMint,
      swapType: "buy",
      inputAmount: new BN(1_000),
    })
    .preInstructions([
      // The compute-unit price makes each market's swap hash unique, so a
      // later flat market isn't rejected as already processed.
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice,
      }),
    ])
    .rpc();
  await ctx.advanceBySeconds(durationInSeconds);
}

// A DAO that exists today: migrated with typed proposals off, it passes the
// opt-in under its own 2 days and -3%, and governs on the catalog from the
// moment the vault executes it.
export default function suite() {
  it("migrates an existing DAO, passes the typed proposals opt-in under its own rules, and lands on the catalog", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    const dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      ...TYPED_PROPOSALS_OFF_DAO_TERMS,
    });
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000),
        maxBaseAmount: new BN(100_000 * 1_000_000),
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Migrate
    await makeOldDaoLayout(this, dao);
    assert.equal(
      (await this.banksClient.getAccount(dao)).data.length,
      PRE_MIGRATION_DAO_SIZE,
    );

    await this.futarchy.resizeDaoIx({ dao }).rpc();

    assert.equal(
      (await this.banksClient.getAccount(dao)).data.length,
      MIGRATED_DAO_SIZE,
    );
    assert.isFalse((await this.futarchy.getDao(dao)).typedProposalsEnabled);

    // File the opt-in, and a second plain draft that stays open until the
    // catalog applies
    const optInIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: { ...EMPTY_UPDATE_DAO_PARAMS, typedProposalsEnabled: true },
      })
      .instruction();
    const optIn = await filePlainProposal(this, dao, [optInIx]);
    const leftover = await filePlainProposal(this, dao, [memoIx]);

    const optInDraft = await this.futarchy.getProposal(optIn.proposal);
    assert.equal(
      optInDraft.durationInSeconds,
      TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
    );
    assert.equal(
      optInDraft.passThresholdBps,
      TYPED_PROPOSALS_OFF_DAO_TERMS.passThresholdBps,
    );

    // An outsider's takeover is refused while typed proposals are off
    const takeover = {
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    };
    await this.futarchy
      .initializeHostileTakeoverProposal(takeover)
      .then(
        ...expectError(
          "TypedProposalsDisabled",
          "created a hostile takeover before the DAO opted in",
        ),
      );

    // Sponsor and launch under the DAO's own rules
    await this.futarchy
      .sponsorProposalIx({ proposal: optIn.proposal, dao })
      .rpc();
    await this.futarchy
      .launchProposalIx({
        proposal: optIn.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: optIn.squadsProposal,
      })
      .rpc();

    const optInLaunched = await this.futarchy.getProposal(optIn.proposal);
    assert.exists(optInLaunched.state.pending);
    assert.equal(
      optInLaunched.durationInSeconds,
      TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
    );
    assert.equal(
      optInLaunched.passThresholdBps,
      TYPED_PROPOSALS_OFF_DAO_TERMS.teamSponsoredPassThresholdBps,
    );

    const optInMarket = (await this.futarchy.getDao(dao)).amm.state.futarchy;
    assert.equal(
      optInMarket.pass.oracle.startDelaySeconds,
      TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
    );
    assert.equal(
      optInMarket.fail.oracle.startDelaySeconds,
      TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
    );

    // Nobody trades against it; equal TWAPs clear the -3% threshold
    await runFlatMarketToEnd(this, {
      dao,
      baseMint: META,
      quoteMint: USDC,
      twapStartDelaySeconds:
        TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
      durationInSeconds: TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
      computeUnitPrice: 1,
    });
    await this.futarchy.finalizeProposal(optIn.proposal);

    assert.exists(
      (await this.futarchy.getProposal(optIn.proposal)).state.passed,
    );
    const optInSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        optIn.squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(optInSquadsProposal.status),
    );

    // Execute: the vault signs update_dao
    await executeVaultTransaction(this, dao, optIn.squadsTransaction);
    assert.isTrue((await this.futarchy.getDao(dao)).typedProposalsEnabled);

    // Retry the takeover. The SDK helper can't be used again here: the refused
    // attempt already created the question and conditional vaults for this
    // transaction index, so only the initialize instruction itself is sent.
    const { transactionIndex, proposal: takeoverProposal } =
      await this.futarchy.getNextProposalAddrs(dao);
    await this.futarchy
      .initializeHostileTakeoverProposalIx({
        ...takeover,
        baseMint: META,
        quoteMint: USDC,
        transactionIndex,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        // Without this the transaction would be byte-identical to the refused
        // attempt and rejected as already processed.
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();
    assert.exists(
      (await this.futarchy.getProposal(takeoverProposal)).action
        .hostileTakeover,
    );

    // A fresh plain draft previews the catalog
    const fresh = await filePlainProposal(this, dao, [memoIx]);
    const freshDraft = await this.futarchy.getProposal(fresh.proposal);
    assert.equal(freshDraft.durationInSeconds, CATALOG_DURATION_SECONDS);
    assert.equal(freshDraft.passThresholdBps, CATALOG_PASS_THRESHOLD_BPS);

    // The draft left open before the opt-in launches under the catalog
    await this.futarchy
      .sponsorProposalIx({ proposal: leftover.proposal, dao })
      .rpc();
    await this.futarchy
      .launchProposalIx({
        proposal: leftover.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: leftover.squadsProposal,
      })
      .rpc();

    const leftoverLaunched = await this.futarchy.getProposal(leftover.proposal);
    assert.exists(leftoverLaunched.state.pending);
    assert.equal(leftoverLaunched.durationInSeconds, CATALOG_DURATION_SECONDS);
    assert.equal(leftoverLaunched.passThresholdBps, CATALOG_PASS_THRESHOLD_BPS);

    const leftoverMarket = (await this.futarchy.getDao(dao)).amm.state.futarchy;
    assert.equal(
      leftoverMarket.pass.oracle.startDelaySeconds,
      CATALOG_TWAP_START_DELAY_SECONDS,
    );
    assert.equal(
      leftoverMarket.fail.oracle.startDelaySeconds,
      CATALOG_TWAP_START_DELAY_SECONDS,
    );

    // Equal TWAPs don't clear the catalog's +10%. Finalizing frees the pool
    // for the next launch.
    await runFlatMarketToEnd(this, {
      dao,
      baseMint: META,
      quoteMint: USDC,
      twapStartDelaySeconds: CATALOG_TWAP_START_DELAY_SECONDS,
      durationInSeconds: CATALOG_DURATION_SECONDS,
      computeUnitPrice: 2,
    });
    await this.futarchy.finalizeProposal(leftover.proposal);
    assert.exists(
      (await this.futarchy.getProposal(leftover.proposal)).state.failed,
    );

    // So does the fresh one
    await this.futarchy
      .sponsorProposalIx({ proposal: fresh.proposal, dao })
      .rpc();
    await this.futarchy
      .launchProposalIx({
        proposal: fresh.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: fresh.squadsProposal,
      })
      .rpc();

    const freshLaunched = await this.futarchy.getProposal(fresh.proposal);
    assert.exists(freshLaunched.state.pending);
    assert.equal(freshLaunched.durationInSeconds, CATALOG_DURATION_SECONDS);
    assert.equal(freshLaunched.passThresholdBps, CATALOG_PASS_THRESHOLD_BPS);
  });
}
