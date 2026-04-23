import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  getDaoAddr,
  getProposalAddrV2,
} from "@metadaoproject/futarchy-v2";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, setOptimisticGovernanceEnabled } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    spendingLimit: BN,
    transferAmount: bigint;

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

  it("sets proposal duration_in_seconds to DAO's current seconds_per_proposal on launch", async function () {
    const THREE_DAYS = 60 * 60 * 24 * 3; // 259200
    const FIVE_DAYS = 60 * 60 * 24 * 5; // 432000

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

    // Verify proposal has the original duration (3 days)
    const proposalBefore = await this.futarchy.getProposal(proposal);
    assert.equal(proposalBefore.durationInSeconds, THREE_DAYS);

    // Directly modify the DAO's secondsPerProposal to 5 days
    const daoAccountInfo = await this.banksClient.getAccount(dao);
    const coder = this.futarchy.futarchy.coder.accounts;
    const daoData = coder.decode("dao", Buffer.from(daoAccountInfo.data));
    daoData.secondsPerProposal = FIVE_DAYS;
    const encodedData = await coder.encode("dao", daoData);
    // Preserve original account size (may be larger due to InitSpace allocation)
    const newData = new Uint8Array(daoAccountInfo.data.length);
    newData.set(encodedData, 0);
    daoAccountInfo.data = newData;
    this.context.setAccount(dao, daoAccountInfo);

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

    // Verify proposal picked up the new DAO duration
    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.equal(storedProposal.durationInSeconds, FIVE_DAYS);
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

  it("can challenge an optimistic proposal by launching a new futarchy proposal using the same squads proposal", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity so proposal can be launched
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

    // Mint DAO tokens to payer's account
    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      10_000_000 * 10 ** 6,
    );

    let daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(USDC, daoAccount.squadsMultisigVault);

    await setOptimisticGovernanceEnabled(this, dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(transferAmount),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
        quoteMint: USDC,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    await this.futarchy.initializeProposal(dao, squadsProposal);

    const [proposal] = getProposalAddrV2({ squadsProposal });

    await this.futarchy
      .stakeToProposalIx({
        amount: new BN(1_000_000 * 10 ** 6),
        proposal,
        dao,
        baseMint: META,
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

    // Assert that the optimistic proposal has been migrated to the futarchy proposal
    daoAccount = await this.futarchy.getDao(dao);
    assert.notExists(daoAccount.optimisticProposal);

    const proposalAccount = await this.futarchy.getProposal(proposal);
    assert.exists(proposalAccount.state.pending);
    assert.equal(
      proposalAccount.squadsProposal.toBase58(),
      squadsProposal.toBase58(),
    );
  });

  it("can't challenge an optimistic proposal if it has already passed due to age", async function () {
    const stakeThreshold = new BN(100 * 10 ** 6); // 100 tokens
    const dao = await createDaoWithStakeThreshold(
      this,
      META,
      USDC,
      stakeThreshold,
      this.payer,
    );

    // Add liquidity so proposal can be launched
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

    // Mint DAO tokens to payer's account
    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      10_000_000 * 10 ** 6,
    );

    let daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(USDC, daoAccount.squadsMultisigVault);

    await setOptimisticGovernanceEnabled(this, dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(transferAmount),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
        quoteMint: USDC,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    daoAccount = await this.futarchy.getDao(dao);

    assert.exists(daoAccount.optimisticProposal);

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    // Initialize the futarchy proposal before the optimistic proposal is auto-approved
    await this.futarchy.initializeProposal(dao, squadsProposal);

    this.advanceBySeconds(daoAccount.secondsPerProposal);

    const [proposal] = getProposalAddrV2({ squadsProposal });

    await this.futarchy
      .stakeToProposalIx({
        amount: new BN(1_000_000 * 10 ** 6),
        proposal,
        dao,
        baseMint: META,
      })
      .rpc();

    const callbacks = expectError(
      "OptimisticProposalAlreadyPassed",
      "Optimistic proposal has already passed",
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
