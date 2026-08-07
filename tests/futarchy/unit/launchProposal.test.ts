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
import { expectError } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

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
   * Helper function to initialize a proposal for a DAO
   */
  async function initializeProposal(
    context: any,
    dao: PublicKey,
  ): Promise<{ proposal: PublicKey; squadsProposal: PublicKey }> {
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

    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);

    await context.banksClient.processTransaction(tx);

    const proposal = await context.futarchy.initializeProposal(
      dao,
      squadsProposal,
    );

    return { proposal, squadsProposal };
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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

    // Sponsor the proposal (makes is_team_sponsored = true)
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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

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

    const { proposal, squadsProposal } = await initializeProposal(this, dao);

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
      "HostileCooldownActive",
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
}
