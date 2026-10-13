import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
  getDaoAddr,
  getProposalAddrV2,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  expectError,
  setOptimisticGovernanceEnabled,
  nextDaoNonce,
} from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// A non-zero base-to-stake floor, so the stake approval point is actually
// meaningful (setupBasicDao uses 0, which would make the stake point free).
const BASE_TO_STAKE = new BN(1_000 * 10 ** 6); // 1,000 tokens

export default function suite() {
  let META: PublicKey, USDC: PublicKey, spendingLimit: BN;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);
    spendingLimit = new BN(10_000);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    // Mint generously so large stakes (the supermajority cases) are never
    // supply-bound.
    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      20_000_000 * 10 ** 6,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      1_000_000 * 10 ** 6,
    );
  });

  // Create a DAO with the given launch thresholds. isProposalValidationEnabled
  // defaults to true because this suite is predominantly about the validation
  // gate; the legacy-gate block opts out explicitly. baseToSupermajority
  // defaults to 0 (supermajority disabled), which the invariant always permits.
  async function createDao(
    context: any,
    {
      baseToStake,
      baseToSupermajority = new BN(0),
      isProposalValidationEnabled = true,
    }: {
      baseToStake: BN;
      baseToSupermajority?: BN;
      isProposalValidationEnabled?: boolean;
    },
  ): Promise<PublicKey> {
    const nonce = nextDaoNonce();

    await context.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
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
            members: [context.payer.publicKey],
          },
          baseToStake,
          baseToSupermajority,
          teamSponsoredPassThresholdBps: 300,
          teamAddress: context.payer.publicKey,
          isProposalValidationEnabled,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: context.payer.publicKey });
    return dao;
  }

  async function provideLiquidity(context: any, dao: PublicKey): Promise<void> {
    await context.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: context.payer.publicKey,
        liquidityProvider: context.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();
  }

  // Set up a launchable draft proposal: wrap an arbitrary instruction in an
  // active Squads vault transaction, then initialize the futarchy proposal.
  async function initDraftProposal(
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
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
          isProposalValidationEnabled: null,
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

  // Enqueue an optimistic vault spend and initialize a futarchy proposal that
  // challenges it (same squads proposal). Under the validation gate such a
  // challenger auto-earns the team approval point; under the legacy gate it has
  // no special standing and must clear base_to_stake (or be team-sponsored).
  async function initOptimisticChallenge(
    context: any,
    dao: PublicKey,
  ): Promise<{ proposal: PublicKey; squadsProposal: PublicKey }> {
    let daoAccount = await context.futarchy.getDao(dao);
    await context.createTokenAccount(USDC, daoAccount.squadsMultisigVault);

    await setOptimisticGovernanceEnabled(context, dao, true);

    await context.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(0),
        recipient: context.payer.publicKey,
        transactionIndex: 1n,
        quoteMint: USDC,
      })
      .signers([context.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    daoAccount = await context.futarchy.getDao(dao);
    assert.exists(daoAccount.optimisticProposal);

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    await context.futarchy.initializeProposal(dao, squadsProposal);
    const [proposal] = getProposalAddrV2({ squadsProposal });

    return { proposal, squadsProposal };
  }

  function stake(
    context: any,
    proposal: PublicKey,
    dao: PublicKey,
    amount: BN,
  ): Promise<string> {
    return context.futarchy
      .stakeToProposalIx({ proposal, dao, baseMint: META, amount })
      .rpc();
  }

  function launch(
    context: any,
    proposal: PublicKey,
    dao: PublicKey,
    squadsProposal: PublicKey,
  ): Promise<string> {
    return context.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();
  }

  describe("proposal validation enabled", function () {
    // ---- Approval points: launch needs >= 2 of 3 {stake, team, metadao} ----

    const POINT_MATRIX: {
      stakePoint: boolean;
      team: boolean;
      metadao: boolean;
      launches: boolean;
    }[] = [
      { stakePoint: false, team: false, metadao: false, launches: false },
      { stakePoint: true, team: false, metadao: false, launches: false },
      { stakePoint: false, team: true, metadao: false, launches: false },
      { stakePoint: false, team: false, metadao: true, launches: false },
      { stakePoint: true, team: true, metadao: false, launches: true },
      { stakePoint: true, team: false, metadao: true, launches: true },
      { stakePoint: false, team: true, metadao: true, launches: true },
      { stakePoint: true, team: true, metadao: true, launches: true },
    ];

    POINT_MATRIX.forEach(({ stakePoint, team, metadao, launches }) => {
      const label = `stake=${stakePoint ? "Y" : "N"} team=${
        team ? "Y" : "N"
      } metadao=${metadao ? "Y" : "N"}`;

      it(`approval points (${label}) ${launches ? "launches" : "fails"}`, async function () {
        const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
        await provideLiquidity(this, dao);
        const { proposal, squadsProposal } = await initDraftProposal(this, dao);

        if (stakePoint) await stake(this, proposal, dao, BASE_TO_STAKE);
        if (team)
          await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();
        if (metadao)
          await this.futarchy.approveProposalIx({ proposal, dao }).rpc();

        if (launches) {
          await launch(this, proposal, dao, squadsProposal);
          const stored = await this.futarchy.getProposal(proposal);
          assert.exists(stored.state.pending);
        } else {
          const callbacks = expectError(
            "InsufficientApprovalToLaunch",
            "launch should fail with fewer than 2 approval points",
          );
          await launch(this, proposal, dao, squadsProposal).then(
            callbacks[0],
            callbacks[1],
          );
        }
      });
    });

    // ---- Supermajority: stake alone reaches the per-DAO bar (0 disables) ----

    it("supermajority: stake at the bar launches with no team/metadao point", async function () {
      const T = new BN(2_000 * 10 ** 6); // reachable, and >= base_to_stake (invariant)
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        baseToSupermajority: T,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      // Stake exactly the supermajority. With no team/metadao point the lone stake
      // point (1 of 2) can't satisfy the 2-of-3 approval gate, so launching here
      // proves the supermajority path fired.
      await stake(this, proposal, dao, T);

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);
    });

    it("supermajority: stake one unit below the bar fails", async function () {
      const T = new BN(2_000 * 10 ** 6);
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        baseToSupermajority: T,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await stake(this, proposal, dao, T.subn(1));

      const callbacks = expectError(
        "InsufficientApprovalToLaunch",
        "stake one below the supermajority must not launch",
      );
      await launch(this, proposal, dao, squadsProposal).then(
        callbacks[0],
        callbacks[1],
      );
    });

    it("supermajority disabled (base_to_supermajority = 0): a huge stake can't launch, but enabling it can", async function () {
      const HUGE = new BN(5_000_000 * 10 ** 6); // >> any base_to_stake floor

      // Disabled: with the supermajority off and no team/metadao point, the lone stake point
      // (1 of 2) can't launch regardless of how large the stake is. This is the
      // load-bearing intent test for the `> 0` guard.
      const disabledDao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        baseToSupermajority: new BN(0),
      });
      await provideLiquidity(this, disabledDao);
      const disabled = await initDraftProposal(this, disabledDao);
      await stake(this, disabled.proposal, disabledDao, HUGE);

      const callbacks = expectError(
        "InsufficientApprovalToLaunch",
        "supermajority disabled: no amount of stake should bypass the 2-of-3 gate",
      );
      await launch(
        this,
        disabled.proposal,
        disabledDao,
        disabled.squadsProposal,
      ).then(callbacks[0], callbacks[1]);

      // Positive control: a sibling DAO identical except base_to_supermajority is
      // enabled (= HUGE). The same stake now launches via the supermajority, so the failure
      // above is attributable to the `> 0` guard, not an unrelated gate condition.
      const enabledDao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        baseToSupermajority: HUGE,
      });
      await provideLiquidity(this, enabledDao);
      const enabled = await initDraftProposal(this, enabledDao);
      await stake(this, enabled.proposal, enabledDao, HUGE);

      await launch(this, enabled.proposal, enabledDao, enabled.squadsProposal);
      const stored = await this.futarchy.getProposal(enabled.proposal);
      assert.exists(stored.state.pending);
    });

    // ---- Optimistic-challenge gate: challenging an active optimistic proposal
    //      auto-earns the team point, so the challenge costs the same as today. ----

    it("optimistic challenge launches with stake >= base_to_stake (stake + auto team point)", async function () {
      const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      await stake(this, proposal, dao, BASE_TO_STAKE);

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);

      const daoAccount = await this.futarchy.getDao(dao);
      assert.notExists(daoAccount.optimisticProposal);
    });

    it("optimistic challenge fails with stake below base_to_stake (only the auto team point)", async function () {
      const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      await stake(this, proposal, dao, BASE_TO_STAKE.divn(2)); // below the floor

      const callbacks = expectError(
        "InsufficientApprovalToLaunch",
        "a sub-floor optimistic challenge has only the auto team point",
      );
      await launch(this, proposal, dao, squadsProposal).then(
        callbacks[0],
        callbacks[1],
      );
    });

    it("optimistic challenge launches below base_to_stake when MetaDAO-approved (metadao + auto team point)", async function () {
      const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      await stake(this, proposal, dao, BASE_TO_STAKE.divn(2)); // below the floor
      await this.futarchy.approveProposalIx({ proposal, dao }).rpc();

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);
    });

    // ---- Existing optimistic-launch behaviour, re-derived against the new gate.
    //      The 1M stake is >= base_to_stake, so stake + auto team = 2 points. ----

    it("can challenge an optimistic proposal by launching a futarchy proposal on the same squads proposal", async function () {
      const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      await stake(this, proposal, dao, new BN(1_000_000 * 10 ** 6));
      await launch(this, proposal, dao, squadsProposal);

      const daoAccount = await this.futarchy.getDao(dao);
      assert.notExists(daoAccount.optimisticProposal);

      const proposalAccount = await this.futarchy.getProposal(proposal);
      assert.exists(proposalAccount.state.pending);
      assert.equal(
        proposalAccount.squadsProposal.toBase58(),
        squadsProposal.toBase58(),
      );
    });

    it("can't challenge an optimistic proposal once it has passed due to age", async function () {
      const dao = await createDao(this, { baseToStake: BASE_TO_STAKE });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      const daoAccount = await this.futarchy.getDao(dao);
      this.advanceBySeconds(daoAccount.secondsPerProposal);

      await stake(this, proposal, dao, new BN(1_000_000 * 10 ** 6));

      const callbacks = expectError(
        "OptimisticProposalAlreadyPassed",
        "optimistic proposal has already passed",
      );
      await launch(this, proposal, dao, squadsProposal).then(
        callbacks[0],
        callbacks[1],
      );
    });

    // ---- Orthogonal: launch refreshes duration_in_seconds from the DAO. ----

    it("sets proposal duration_in_seconds to the DAO's current seconds_per_proposal on launch", async function () {
      const THREE_DAYS = 60 * 60 * 24 * 3;
      const FIVE_DAYS = 60 * 60 * 24 * 5;

      const dao = await createDao(this, { baseToStake: new BN(0) });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

      const proposalBefore = await this.futarchy.getProposal(proposal);
      assert.equal(proposalBefore.durationInSeconds, THREE_DAYS);

      // Bump the DAO's seconds_per_proposal directly (account surgery), then launch.
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

      await launch(this, proposal, dao, squadsProposal);

      const stored = await this.futarchy.getProposal(proposal);
      assert.equal(stored.durationInSeconds, FIVE_DAYS);
    });
  });

  describe("legacy gate (validation disabled)", function () {
    // A DAO that has not opted into proposal validation uses the pre-MET-425
    // gate: launch on team sponsorship OR stake >= base_to_stake. The MetaDAO
    // approval point and the supermajority bar are not consulted.

    it("succeeds for team-sponsored proposal regardless of stake", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);
    });

    it("succeeds for non-team-sponsored with sufficient stake", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await stake(this, proposal, dao, BASE_TO_STAKE.muln(2));

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);
    });

    it("succeeds at exact stake threshold", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await stake(this, proposal, dao, BASE_TO_STAKE);

      await launch(this, proposal, dao, squadsProposal);
      const stored = await this.futarchy.getProposal(proposal);
      assert.exists(stored.state.pending);
    });

    it("fails for non-team-sponsored with insufficient stake", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initDraftProposal(this, dao);

      await stake(this, proposal, dao, BASE_TO_STAKE.subn(1));

      const callbacks = expectError(
        "InsufficientStakeToLaunch",
        "a sub-floor non-team proposal must not launch under the legacy gate",
      );
      await launch(this, proposal, dao, squadsProposal).then(
        callbacks[0],
        callbacks[1],
      );
    });

    it("can challenge an optimistic proposal by clearing base_to_stake (no auto team point)", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      // The legacy gate grants no auto team point for optimistic challenges, so the
      // challenger must clear base_to_stake on its own.
      await stake(this, proposal, dao, new BN(1_000_000 * 10 ** 6));
      await launch(this, proposal, dao, squadsProposal);

      const daoAccount = await this.futarchy.getDao(dao);
      assert.notExists(daoAccount.optimisticProposal);

      const proposalAccount = await this.futarchy.getProposal(proposal);
      assert.exists(proposalAccount.state.pending);
    });

    it("can't challenge an optimistic proposal once it has passed due to age", async function () {
      const dao = await createDao(this, {
        baseToStake: BASE_TO_STAKE,
        isProposalValidationEnabled: false,
      });
      await provideLiquidity(this, dao);
      const { proposal, squadsProposal } = await initOptimisticChallenge(
        this,
        dao,
      );

      const daoAccount = await this.futarchy.getDao(dao);
      this.advanceBySeconds(daoAccount.secondsPerProposal);

      await stake(this, proposal, dao, new BN(1_000_000 * 10 ** 6));

      const callbacks = expectError(
        "OptimisticProposalAlreadyPassed",
        "optimistic proposal has already passed",
      );
      await launch(this, proposal, dao, squadsProposal).then(
        callbacks[0],
        callbacks[1],
      );
    });
  });
}
