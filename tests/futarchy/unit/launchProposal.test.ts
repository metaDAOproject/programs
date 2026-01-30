import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  getDaoAddr,
} from "@metadaoproject/futarchy/v0.6";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

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
  ): Promise<PublicKey> {
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await context.futarchy
      .initializeDaoIx({
        baseMint,
        quoteMint,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: null,
          baseToStake,
          teamSponsoredPassThresholdBps: 300,
          teamAddress: context.payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({
      nonce,
      daoCreator: context.payer.publicKey,
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

  it("fails for non-team-sponsored with insufficient stake", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
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
}
