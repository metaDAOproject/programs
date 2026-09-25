import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  getDaoAddr,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  addLookupsToVaultTransaction,
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
  setLookupTableAccount,
} from "../../utils.js";
import {
  TYPED_PROPOSALS_OFF_DAO_TERMS,
  rewriteAccount,
  setTypedProposalsEnabled,
  setupTypedProposalsOffDao,
  updateDaoViaVault,
} from "../utils.js";
import { TestContext } from "../../main.test.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

const CATALOG_DURATION_SECONDS = 60 * 60 * 24 * 10;
const CATALOG_PASS_THRESHOLD_BPS = 1000;
const CATALOG_TWAP_START_DELAY_SECONDS = 60 * 60 * 24;
const CATALOG_SPENDING_LIMIT_CHANGE_DURATION_SECONDS = 60 * 60 * 24 * 5;
const CATALOG_SPENDING_LIMIT_CHANGE_PASS_THRESHOLD_BPS = 500;

// Admin-tuned terms that match neither the DAO's nor the catalog's, above
// both warm-ups.
const TUNED_DURATION_SECONDS = 60 * 60 * 24 * 3;
const TUNED_PASS_THRESHOLD_BPS = 700;

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, spendingLimit: BN;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);
    spendingLimit = new BN(10_000);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      200_000 * 10 ** 6,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );
  });

  /**
   * Helper function to create a DAO with a specific baseToStake threshold
   */
  async function createDaoWithStakeThreshold(
    context: any,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseToStake: BN,
    payer: Keypair,
    twapStartDelaySeconds: number = 60 * 60 * 24,
  ): Promise<PublicKey> {
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await context.futarchy
      .initializeDaoIx({
        baseMint,
        quoteMint,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: spendingLimit,
            members: [payer.publicKey],
          },
          baseToStake,
          teamSponsoredPassThresholdBps: 300,
          teamAddress: payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({
      nonce,
      daoCreator: payer.publicKey,
    });

    return dao;
  }

  /**
   * Helper function to create a Squads proposal, with its vault transaction, for a DAO
   */
  async function createSquadsProposal(
    context: any,
    dao: PublicKey,
  ): Promise<{ squadsProposal: PublicKey; squadsTransaction: PublicKey }> {
    const updateDaoIx = await context.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          baseToStake: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          twapStartDelaySeconds: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          typedProposalsEnabled: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: context.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: context.payer.publicKey,
    });

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });
    const [squadsTransaction] = multisig.getTransactionPda({
      multisigPda,
      index: 1n,
    });

    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);

    await context.banksClient.processTransaction(tx);

    return { squadsProposal, squadsTransaction };
  }

  /**
   * Helper function to initialize a proposal for a DAO
   */
  async function initializeProposal(
    context: any,
    dao: PublicKey,
  ): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    const { squadsProposal, squadsTransaction } = await createSquadsProposal(
      context,
      dao,
    );

    const proposal = await context.futarchy.initializeProposal(
      dao,
      squadsProposal,
    );

    return { proposal, squadsProposal, squadsTransaction };
  }

  it("succeeds for team-sponsored proposal regardless of stake", async function () {
    // Create DAO with non-zero stake threshold
    const stakeThreshold = new BN(1000 * 10 ** 6); // 1000 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity so launch can proceed
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    // Sponsor the proposal (sets sponsored_by to the team)
    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    // Launch proposal without staking anything - should succeed because it's team-sponsored
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc();

    // Verify proposal is now pending
    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(
      storedProposal.state.pending,
      "Proposal should be in pending state after launch",
    );
  });

  it("succeeds for non-team-sponsored with sufficient stake", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    // Stake more than threshold
    const stakeAmount = new BN(200 * 10 ** 6); // 200 tokens (> 100 threshold)
    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    // Launch should succeed
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(
      storedProposal.state.pending,
      "Proposal should be in pending state after launch",
    );
  });

  it("succeeds at exact stake threshold", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    // Stake exactly the threshold amount
    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeThreshold,
      })
      .rpc();

    // Launch should succeed at exact threshold
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(
      storedProposal.state.pending,
      "Proposal should be in pending state after launch",
    );
  });

  it("keeps the create-time duration snapshot on launch", async function () {
    // Create DAO with secondsPerProposal = 3 days
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    // Add liquidity
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    // Sponsor the proposal
    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    // Create-time snapshot comes from ExecuteArbitrary's params (10 days),
    // not the DAO's 3-day secondsPerProposal
    const proposalBefore = await this.futarchy.getProposal(proposal);
    assert.equal(proposalBefore.durationInSeconds, 864_000);

    // Launch the proposal
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc();

    // The snapshot is authoritative — launch must not overwrite it with the
    // DAO's seconds_per_proposal
    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.equal(storedProposal.durationInSeconds, 864_000);
  });

  it("gives execute_arbitrary the kind's start delay, not the DAO's", async function () {
    // 30 hours, so a DAO value that matches no kind's start delay
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
      60 * 60 * 30,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const storedDaoBefore = await this.futarchy.getDao(dao);
    assert.equal(storedDaoBefore.twapStartDelaySeconds, 108_000);

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc();

    const { pass, fail } = (await this.futarchy.getDao(dao)).amm.state.futarchy;
    assert.equal(pass.oracle.startDelaySeconds, 86_400);
    assert.equal(fail.oracle.startDelaySeconds, 86_400);
  });

  it("gives large_spend half a day, not the DAO's start delay", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
      60 * 60 * 30,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: new BN(10_000),
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    const { pass, fail } = (await this.futarchy.getDao(dao)).amm.state.futarchy;
    assert.equal(pass.oracle.startDelaySeconds, 43_200);
    assert.equal(fail.oracle.startDelaySeconds, 43_200);
  });

  it("fails for non-team-sponsored with insufficient stake", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    // Stake less than threshold
    const insufficientStake = new BN(50 * 10 ** 6); // 50 tokens (< 100 threshold)
    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: insufficientStake,
      })
      .rpc();

    // Launch should fail with InsufficientStakeToLaunch
    const callbacks = expectError(
      "InsufficientStakeToLaunch",
      "Launch should fail when stake is below threshold",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to launch an unsponsored large_spend, launches once sponsored", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: new BN(10_000),
      });

    const callbacks = expectError(
      "ProposalNotTeamSponsored",
      "launched an unsponsored large spend proposal",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("fails to launch a large_spend paying the previous team even after the new team sponsors it", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: new BN(10_000),
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    // Replace the team while the sponsored draft is still unlaunched
    const newTeam = Keypair.generate();
    const takeover = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: newTeam.publicKey,
      spendingLimitAction: { keep: {} },
    });
    await forceApproveSquadsProposal(this, takeover.squadsProposal);
    await executeVaultTransaction(this, dao, takeover.squadsTransaction);

    const staleSponsorCallbacks = expectError(
      "ProposalNotTeamSponsored",
      "launched a large spend sponsored by the previous team",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(staleSponsorCallbacks[0], staleSponsorCallbacks[1]);

    await this.futarchy
      .sponsorProposalIx({ proposal, dao, teamAddress: newTeam.publicKey })
      .signers([newTeam])
      .rpc();

    const stalePayeeCallbacks = expectError(
      "StaleTeamAddress",
      "launched a large spend paying the previous team",
    );

    // The compute unit price makes this transaction's hash differ from the
    // first launch attempt, so it isn't rejected as already processed
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc()
      .then(stalePayeeCallbacks[0], stalePayeeCallbacks[1]);
  });

  it("fails to launch a sponsored large_spend after the limit drops below its amount", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Exactly the three-month cap, so any reduction puts it over
    const { proposal, squadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: spendingLimit.muln(3),
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    const change = await this.futarchy.initializeSpendingLimitChangeProposal({
      dao,
      config: {
        amountPerMonth: spendingLimit.divn(10),
        members: [this.payer.publicKey],
      },
    });
    await forceApproveSquadsProposal(this, change.squadsProposal);
    await executeVaultTransaction(this, dao, change.squadsTransaction);

    const callbacks = expectError(
      "SpendCapExceeded",
      "launched a large spend above the reduced cap",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to launch a sponsored large_spend after the limit is removed", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao,
        amount: new BN(10_000),
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    const removal = await this.futarchy.initializeSpendingLimitChangeProposal({
      dao,
      config: null,
    });
    await forceApproveSquadsProposal(this, removal.squadsProposal);
    await executeVaultTransaction(this, dao, removal.squadsTransaction);

    const callbacks = expectError(
      "NoSpendingLimit",
      "launched a large spend with no spending limit",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails to launch an unsponsored spending_limit_change, launches once sponsored", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(20_000),
          members: [this.payer.publicKey],
        },
      });

    const callbacks = expectError(
      "ProposalNotTeamSponsored",
      "launched an unsponsored spending limit change proposal",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("fails to launch a spending_limit_change sponsored by the previous team, launches once the new team sponsors it", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(20_000),
          members: [Keypair.generate().publicKey],
        },
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    const newTeam = Keypair.generate();
    const takeover = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: newTeam.publicKey,
      spendingLimitAction: { keep: {} },
    });
    await forceApproveSquadsProposal(this, takeover.squadsProposal);
    await executeVaultTransaction(this, dao, takeover.squadsTransaction);

    const callbacks = expectError(
      "ProposalNotTeamSponsored",
      "launched a spending limit change sponsored by the previous team",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy
      .sponsorProposalIx({ proposal, dao, teamAddress: newTeam.publicKey })
      .signers([newTeam])
      .rpc();

    // The compute unit price makes this transaction's hash differ from the
    // first launch attempt, so it isn't rejected as already processed
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
    assert.equal(
      storedProposal.sponsoredBy?.toBase58(),
      newTeam.publicKey.toBase58(),
    );
  });

  it("requires the stake once a sponsorship goes stale", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6);
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await initializeProposal(this, dao);

    await this.futarchy
      .sponsorProposalIx({
        proposal,
        dao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    const takeover = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    });
    await forceApproveSquadsProposal(this, takeover.squadsProposal);
    await executeVaultTransaction(this, dao, takeover.squadsTransaction);

    const callbacks = expectError(
      "InsufficientStakeToLaunch",
      "launched on a stale sponsorship with no stake",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeThreshold,
      })
      .rpc();

    // The compute unit price makes this transaction's hash differ from the
    // first launch attempt, so it isn't rejected as already processed
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("fails to launch a hostile takeover during its cooldown, launches once it elapses", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Fail a first takeover so the DAO stamps last_failed_takeover_at
    const first = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    });

    await this.futarchy
      .launchProposalIx({
        proposal: first.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: first.squadsProposal,
      })
      .rpc();

    // One swap after the TWAP start delay records an observation in both
    // markets; the equal TWAPs it leaves can't clear the +10% threshold
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 20);
    await this.futarchy.finalizeProposal(first.proposal);

    const failedProposal = await this.futarchy.getProposal(first.proposal);
    assert.exists(failedProposal.state.failed);

    const second = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    });

    const callbacks = expectError(
      "ProposalKindCooldownActive",
      "launched a hostile takeover during its cooldown",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // The 20-day cooldown gate is inclusive of its final second
    await this.advanceBySeconds(60 * 60 * 24 * 20);

    await this.futarchy
      .launchProposalIx({
        proposal: second.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: second.squadsProposal,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const storedProposal = await this.futarchy.getProposal(second.proposal);
    assert.exists(storedProposal.state.pending);
  });

  it("fails to launch a hostile takeover whose target is already the team", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const newTeam = Keypair.generate();
    const stale = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: newTeam.publicKey,
      spendingLimitAction: { keep: {} },
    });

    // Install the same team through another takeover while the draft is
    // still unlaunched
    const installed = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: newTeam.publicKey,
      spendingLimitAction: { keep: {} },
    });
    await forceApproveSquadsProposal(this, installed.squadsProposal);
    await executeVaultTransaction(this, dao, installed.squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(
      storedDao.teamAddress.toBase58(),
      newTeam.publicKey.toBase58(),
    );

    const callbacks = expectError(
      "InvalidTeamAddress",
      "launched a hostile takeover whose target is already the team",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: stale.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: stale.squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects launching a generic proposal without its vault transaction", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );
    const { proposal, squadsProposal } = await initializeProposal(this, dao);

    const callbacks = expectError(
      "InvalidSquadsVaultTransaction",
      "launched a generic proposal without its vault transaction",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects extra launch accounts on a typed proposal", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );
    const takeover = await this.futarchy.initializeHostileTakeoverProposal({
      dao,
      newTeamAddress: Keypair.generate().publicKey,
      spendingLimitAction: { keep: {} },
    });

    const callbacks = expectError(
      "UnexpectedLaunchAccounts",
      "launched a typed proposal with its vault transaction as an extra account",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: takeover.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: takeover.squadsProposal,
        squadsTransaction: takeover.squadsTransaction,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects an unfrozen lookup table at launch on an already-initialized proposal", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { squadsProposal, squadsTransaction } = await createSquadsProposal(
      this,
      dao,
    );
    const proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposal,
    );

    // A draft that predates this check: the lookup appears in the stored
    // message only after initialize_proposal ran without seeing it
    const lookupTable = Keypair.generate().publicKey;
    setLookupTableAccount(this, lookupTable, this.payer.publicKey, [
      Keypair.generate().publicKey,
    ]);
    await addLookupsToVaultTransaction(this, squadsTransaction, [
      { accountKey: lookupTable, writableIndexes: [0], readonlyIndexes: [] },
    ]);

    const callbacks = expectError(
      "UnfrozenAddressLookupTable",
      "launched a proposal whose payload resolves through an unfrozen lookup table",
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
        lookupTables: [lookupTable],
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("launches a proposal whose payload resolves through a frozen, in-bounds lookup table", async function () {
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      new BN(0),
      this.payer,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { squadsProposal, squadsTransaction } = await createSquadsProposal(
      this,
      dao,
    );

    const lookupTable = Keypair.generate().publicKey;
    setLookupTableAccount(this, lookupTable, null, [
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
    ]);
    await addLookupsToVaultTransaction(this, squadsTransaction, [
      { accountKey: lookupTable, writableIndexes: [0], readonlyIndexes: [1] },
    ]);

    const proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposal,
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
        lookupTables: [lookupTable],
      })
      .rpc();

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);
  });

  // Launch writes a proposal's duration and threshold from whatever applies at
  // that moment: the DAO's own terms for a plain proposal while typed
  // proposals are off, the catalog otherwise.
  describe("terms at launch", function () {
    let proposal: PublicKey,
      squadsProposal: PublicKey,
      squadsTransaction: PublicKey;

    beforeEach(async function () {
      dao = await setupTypedProposalsOffDao(this, META, USDC);
      ({ proposal, squadsProposal, squadsTransaction } =
        await initializeProposal(this, dao));
    });

    const launch = (ctx: TestContext) =>
      ctx.futarchy.launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
        squadsTransaction,
      });

    const stake = async (ctx: TestContext) => {
      await ctx.futarchy
        .stakeToProposalIx({
          proposal,
          dao,
          baseMint: META,
          amount: TYPED_PROPOSALS_OFF_DAO_TERMS.baseToStake,
        })
        .rpc();
    };

    // One swap after the warm-up records an observation in both conditional
    // pools and leaves their TWAPs equal, then the market runs out.
    const runFlatMarketToEnd = async (ctx: TestContext) => {
      await ctx.advanceBySeconds(
        TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds + 60,
      );
      await ctx.futarchy
        .spotSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          swapType: "buy",
          inputAmount: new BN(1_000),
        })
        .rpc();
      await ctx.advanceBySeconds(
        TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
      );
    };

    it("writes the DAO's settings as of launch, not as of create", async function () {
      const secondsPerProposal =
        TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal * 2;
      const passThresholdBps =
        TYPED_PROPOSALS_OFF_DAO_TERMS.passThresholdBps + 200;
      await updateDaoViaVault(this, dao, {
        secondsPerProposal,
        passThresholdBps,
      });

      const draft = await this.futarchy.getProposal(proposal);
      assert.equal(
        draft.durationInSeconds,
        TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
      );
      assert.equal(
        draft.passThresholdBps,
        TYPED_PROPOSALS_OFF_DAO_TERMS.passThresholdBps,
      );

      await stake(this);
      await launch(this).rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.exists(launched.state.pending);
      assert.equal(launched.durationInSeconds, secondsPerProposal);
      assert.equal(launched.passThresholdBps, passThresholdBps);
    });

    it("applies the team-sponsored threshold when the sponsorship stands at launch", async function () {
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
      await launch(this).rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.exists(launched.state.pending);
      assert.equal(
        launched.durationInSeconds,
        TYPED_PROPOSALS_OFF_DAO_TERMS.secondsPerProposal,
      );
      assert.equal(
        launched.passThresholdBps,
        TYPED_PROPOSALS_OFF_DAO_TERMS.teamSponsoredPassThresholdBps,
      );
    });

    it("a stale sponsorship gets the plain threshold and owes the stake", async function () {
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
      await updateDaoViaVault(this, dao, {
        teamAddress: Keypair.generate().publicKey,
      });

      const callbacks = expectError(
        "InsufficientStakeToLaunch",
        "launched on a stale sponsorship with no stake",
      );
      await launch(this)
        .rpc()
        .then(...callbacks);

      await stake(this);

      // The compute-unit price makes this transaction's hash differ from the
      // failed launch attempt, so it isn't rejected as already processed.
      await launch(this)
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.exists(launched.state.pending);
      assert.equal(
        launched.sponsoredBy?.toBase58(),
        this.payer.publicKey.toBase58(),
      );
      assert.equal(
        launched.passThresholdBps,
        TYPED_PROPOSALS_OFF_DAO_TERMS.passThresholdBps,
      );
    });

    it("starts the conditional oracles after the DAO's warm-up while typed proposals are off", async function () {
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
      await launch(this).rpc();

      const { pass, fail } = (await this.futarchy.getDao(dao)).amm.state
        .futarchy;
      assert.equal(
        pass.oracle.startDelaySeconds,
        TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
      );
      assert.equal(
        fail.oracle.startDelaySeconds,
        TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
      );
    });

    it("a draft created while typed proposals are off launches under the catalog once the DAO opts in", async function () {
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
      await updateDaoViaVault(this, dao, { typedProposalsEnabled: true });

      await launch(this).rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.equal(launched.durationInSeconds, CATALOG_DURATION_SECONDS);
      assert.equal(launched.passThresholdBps, CATALOG_PASS_THRESHOLD_BPS);

      const { pass, fail } = (await this.futarchy.getDao(dao)).amm.state
        .futarchy;
      assert.equal(
        pass.oracle.startDelaySeconds,
        CATALOG_TWAP_START_DELAY_SECONDS,
      );
      assert.equal(
        fail.oracle.startDelaySeconds,
        CATALOG_TWAP_START_DELAY_SECONDS,
      );
    });

    it("a sponsored proposal passes at the DAO's negative threshold on a flat market", async function () {
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
      await launch(this).rpc();

      await runFlatMarketToEnd(this);
      await this.futarchy.finalizeProposal(proposal);

      const finalized = await this.futarchy.getProposal(proposal);
      assert.exists(finalized.state.passed);
    });

    it("an unsponsored proposal fails at the DAO's positive threshold on a flat market", async function () {
      await stake(this);
      await launch(this).rpc();

      await runFlatMarketToEnd(this);
      await this.futarchy.finalizeProposal(proposal);

      const finalized = await this.futarchy.getProposal(proposal);
      assert.exists(finalized.state.failed);
    });

    it("an admin override survives launch while typed proposals are off", async function () {
      await this.futarchy
        .adminUpdateProposalParamsIx({
          proposal,
          dao,
          durationInSeconds: TUNED_DURATION_SECONDS,
          passThresholdBps: TUNED_PASS_THRESHOLD_BPS,
        })
        .rpc();
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

      await launch(this).rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.equal(launched.durationInSeconds, TUNED_DURATION_SECONDS);
      assert.equal(launched.passThresholdBps, TUNED_PASS_THRESHOLD_BPS);

      const { pass } = (await this.futarchy.getDao(dao)).amm.state.futarchy;
      assert.equal(
        pass.oracle.startDelaySeconds,
        TYPED_PROPOSALS_OFF_DAO_TERMS.twapStartDelaySeconds,
      );
    });

    it("an admin override survives launch while typed proposals are on", async function () {
      await setTypedProposalsEnabled(this, dao, true);
      await this.futarchy
        .adminUpdateProposalParamsIx({
          proposal,
          dao,
          durationInSeconds: TUNED_DURATION_SECONDS,
          passThresholdBps: TUNED_PASS_THRESHOLD_BPS,
        })
        .rpc();
      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

      await launch(this).rpc();

      const launched = await this.futarchy.getProposal(proposal);
      assert.equal(launched.durationInSeconds, TUNED_DURATION_SECONDS);
      assert.equal(launched.passThresholdBps, TUNED_PASS_THRESHOLD_BPS);

      const { pass } = (await this.futarchy.getDao(dao)).amm.state.futarchy;
      assert.equal(
        pass.oracle.startDelaySeconds,
        CATALOG_TWAP_START_DELAY_SECONDS,
      );
    });

    it("a typed draft launches under the catalog even if its snapshot was altered by hand", async function () {
      await setTypedProposalsEnabled(this, dao, true);

      const typed = await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
          members: [Keypair.generate().publicKey],
        },
      });
      await rewriteAccount(this, typed.proposal, "proposal", (decoded) => {
        decoded.durationInSeconds = TUNED_DURATION_SECONDS;
        decoded.passThresholdBps = TUNED_PASS_THRESHOLD_BPS;
      });
      await this.futarchy
        .sponsorProposalIx({ proposal: typed.proposal, dao })
        .rpc();

      await this.futarchy
        .launchProposalIx({
          proposal: typed.proposal,
          dao,
          baseMint: META,
          quoteMint: USDC,
          squadsProposal: typed.squadsProposal,
        })
        .rpc();

      const launched = await this.futarchy.getProposal(typed.proposal);
      assert.exists(launched.state.pending);
      assert.equal(
        launched.durationInSeconds,
        CATALOG_SPENDING_LIMIT_CHANGE_DURATION_SECONDS,
      );
      assert.equal(
        launched.passThresholdBps,
        CATALOG_SPENDING_LIMIT_CHANGE_PASS_THRESHOLD_BPS,
      );
    });
  });
}
