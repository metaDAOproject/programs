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
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { expectError, makeOldDaoLayout, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    squadsProposalPda: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    // const nonce = new BN(Math.floor(Math.random() * 1000000));

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6), // 100,000 USDC
        maxBaseAmount: new BN(100 * 10 ** 6), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
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
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Create the squads proposal first
    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    // Now initialize the futarchy proposal
    proposal = await this.futarchy.initializeProposal(dao, squadsProposalPda);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();
  });

  it("doesn't finalize proposals that are too young", async function () {
    const callbacks = expectError(
      "ProposalTooYoung",
      "proposal is too young to finalize",
    );

    await this.futarchy
      .finalizeProposal(proposal)
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a legacy-sized proposal that has not been migrated", async function () {
    // Shrink the live proposal to the pre-migration allocation: the 8-byte
    // discriminator plus the 339-byte Pending body, then 8 bytes standing in
    // for the residue a legacy account carries past its Pending body. The
    // residue decodes as pass_threshold_bps = -3151, council_can_block =
    // false, action = ExecuteArbitrary — a well-formed new-layout read, so
    // only the size guard stands between it and finalization.
    const raw = await this.banksClient.getAccount(proposal);
    const legacy = Buffer.concat([
      Buffer.from(raw.data.subarray(0, 347)),
      Buffer.from([0xb1, 0xf3, 0x00, 0x03, 0xf0, 0x37, 0xa2, 0x00]),
    ]);
    assert.equal(legacy.length, 355);
    this.context.setAccount(proposal, { ...raw, data: legacy });

    const crafted = await this.futarchy.getProposal(proposal);
    assert.exists(crafted.state.pending);
    assert.equal(crafted.passThresholdBps, -3151);
    assert.isFalse(crafted.councilCanBlock);
    assert.isDefined(crafted.action.executeArbitrary);

    const callbacks = expectError(
      "AccountNotMigrated",
      "finalized an un-migrated legacy proposal",
    );

    await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal: squadsProposalPda,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a legacy-sized DAO that has not been migrated", async function () {
    // Shrink only the DAO to the pre-migration allocation; the proposal keeps
    // its migrated size so its own guard passes.
    await makeOldDaoLayout(this, dao);

    const crafted = await this.futarchy.getDao(dao);
    assert.exists(crafted.amm.state.futarchy);
    assert.isNull(crafted.liquidator);

    const callbacks = expectError(
      "AccountNotMigrated",
      "finalized a proposal on an un-migrated legacy DAO",
    );

    await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal: squadsProposalPda,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("passes proposals when Pass TWAP > Fail TWAP", async function () {
    // Split tokens into the vaults
    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    const { passBaseMint, passQuoteMint } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    const { failBaseMint, failQuoteMint } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    for (let i = 0; i < 100; i++) {
      // await this.advanceBySlots(20_000n);
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Finalize the proposal
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    // Create ATAs for the metadao multisig vault (hardcoded fee destination)
    const METADAO_MULTISIG = new PublicKey(
      "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf",
    );
    await this.createTokenAccount(META, METADAO_MULTISIG);
    await this.createTokenAccount(USDC, METADAO_MULTISIG);

    await this.futarchy
      .collectFeesIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc();
  });

  it("fails proposals when Pass TWAP < Fail TWAP", async function () {
    const { quoteVault, question, passBaseMint } =
      this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    for (let i = 0; i < 100; i++) {
      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
          createAssociatedTokenAccountIdempotentInstruction(
            this.payer.publicKey,
            getAssociatedTokenAddressSync(
              passBaseMint,
              this.payer.publicKey,
              true,
            ),
            this.payer.publicKey,
            passBaseMint,
          ),
        ])
        .rpc();

      await this.advanceBySeconds(20_000);

      // await this.ammClient
      //   .crankThatTwapIx(passAmm)
      //   .preInstructions([
      //     // this is to get around bankrun thinking we've processed the same transaction multiple times
      //     ComputeBudgetProgram.setComputeUnitPrice({
      //       microLamports: i,
      //     }),
      //     await this.ammClient.crankThatTwapIx(failAmm).instruction(),
      //   ])
      //   .rpc();
    }

    // Finalize the proposal
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.failed);

    // A failed ExecuteArbitrary stamps no hostile-failure timestamp
    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.lastFailedTakeoverAt.toString(), "0");
    assert.equal(storedDao.lastFailedLiquidationAt.toString(), "0");

    // Verify Squads proposal is rejected
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });
    const squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsProposalPda,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusRejected(squadsProposal.status),
    );
  });

  it("finalizes when last trade is before the deadline (virtual crank covers the gap)", async function () {
    // Trade for ~400,000s of the 864,000s proposal duration, then stop
    // trading and advance the clock past the deadline before finalizing.
    // The virtual crank in get_twap() fills in the gap after the last trade.

    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Initial swap to seed the pass market
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // Trade for ~400,000 seconds (20 swaps × 20,000s each), well short of
    // the 864,000s proposal duration. Each swap moves the pass observation
    // up by the max change per update, so 20 swaps push the pass TWAP
    // comfortably past the +10% snapshot threshold.
    for (let i = 0; i < 20; i++) {
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // At ~400,000s into an 864,000s proposal — finalization should fail
    // because wall-clock time hasn't reached the deadline yet.
    const earlyCallbacks = expectError(
      "ProposalTooYoung",
      "proposal should not finalize before the deadline",
    );
    const storedProposalEarly = await this.futarchy.getProposal(proposal);
    await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal: storedProposalEarly.squadsProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc()
      .then(earlyCallbacks[0], earlyCallbacks[1]);

    // Stop trading. Advance time past the proposal deadline (864,000s).
    // Last trade was at ~400,000s. We need at least 464,000 more seconds.
    await this.advanceBySeconds(700_000);

    // Finalize — should succeed because:
    // 1. Wall-clock time is past the deadline (validate() passes)
    // 2. At least one trade occurred after TWAP start delay (new check passes)
    // 3. get_twap()'s virtual crank extends the last observation to current time
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);
  });

  it("fails proposals above the DAO threshold but below the snapshot threshold", async function () {
    // The DAO's pass_threshold_bps is +3%, but the proposal snapshotted
    // ExecuteArbitrary's +10% at create. Push the pass TWAP ~5% above fail —
    // clearing the DAO threshold but not the snapshot — and the proposal
    // must still fail, proving finalize judges at the snapshot.
    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 9), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Initial swap to pump the pass market price
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // 5 swaps × 20,000s: each moves the pass observation up by the max
    // change per update (1%), landing the pass TWAP ~5% above fail
    for (let i = 0; i < 5; i++) {
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Advance past the 864,000s proposal deadline
    await this.advanceBySeconds(800_000);

    // Pin the scenario in the discriminating band: pass TWAP above the
    // DAO's +3% threshold, at or below the snapshot's +10%
    const now = (await this.banksClient.getClock()).unixTimestamp;
    const { pass, fail } = (await this.futarchy.getDao(dao)).amm.state.futarchy;
    const twap = (pool: typeof pass) => {
      const start =
        BigInt(pool.oracle.createdAtTimestamp.toString()) +
        BigInt(pool.oracle.startDelaySeconds);
      const finalInterval =
        now - BigInt(pool.oracle.lastUpdatedTimestamp.toString());
      const total =
        BigInt(pool.oracle.aggregator.toString()) +
        BigInt(pool.oracle.lastObservation.toString()) * finalInterval;
      return total / (now - start);
    };
    const passTwap = twap(pass);
    const failTwap = twap(fail);
    assert.isTrue(passTwap > (failTwap * 10_300n) / 10_000n);
    assert.isTrue(passTwap <= (failTwap * 11_000n) / 10_000n);

    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.failed);
  });

  it("judges team-sponsored proposals at the snapshot threshold, not the DAO's team threshold", async function () {
    // Create a new DAO with -5% team-sponsored threshold. That per-DAO
    // threshold is vestigial: finalize judges at the proposal's snapshot
    // (+10% for ExecuteArbitrary), so with the pass TWAP slightly below
    // fail this sponsored proposal now fails.
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

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

    const daoWithTeamSponsorship = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      teamSponsoredPassThresholdBps: -500, // -5% threshold
    });

    await this.futarchy
      .provideLiquidityIx({
        dao: daoWithTeamSponsorship,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6), // 100,000 USDC
        maxBaseAmount: new BN(100_000 * 10 ** 6), // 100,000 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Create a simple instruction for the proposal
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao: daoWithTeamSponsorship,
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
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const multisigPda = multisig.getMultisigPda({
      createKey: daoWithTeamSponsorship,
    })[0];
    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Create the squads proposal first
    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    // Now initialize the futarchy proposal
    const teamSponsoredProposal = await this.futarchy.initializeProposal(
      daoWithTeamSponsorship,
      squadsProposalPda,
    );

    // Sponsor the proposal
    await this.futarchy
      .sponsorProposalIx({
        proposal: teamSponsoredProposal,
        dao: daoWithTeamSponsorship,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal: teamSponsoredProposal,
        dao: daoWithTeamSponsorship,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    // Split tokens into the vaults
    const { baseVault, quoteVault, question } = this.futarchy.getProposalPdas(
      teamSponsoredProposal,
      META,
      USDC,
      daoWithTeamSponsorship,
    );

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(10 * 10 ** 6), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Swap in fail market to make fail TWAP higher than pass TWAP, but within 5% threshold
    for (let i = 0; i < 100; i++) {
      await this.futarchy
        .conditionalSwapIx({
          dao: daoWithTeamSponsorship,
          baseMint: META,
          quoteMint: USDC,
          proposal: teamSponsoredProposal,
          market: "fail",
          swapType: "buy",
          inputAmount: new BN(10 * 1_000_000), // Buy in fail market
          minOutputAmount: new BN(0),
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();

      await this.advanceBySeconds(20_000);
    }

    // Fails despite team sponsorship: the pass TWAP is below fail, nowhere
    // near the +10% snapshot threshold
    await this.futarchy.finalizeProposal(teamSponsoredProposal);

    const storedProposal = await this.futarchy.getProposal(
      teamSponsoredProposal,
    );
    assert.exists(storedProposal.state.failed);
  });

  it("passes an uncontested large_spend at its -10% threshold", async function () {
    // Fresh DAO with a spending limit — the suite DAO has none and already
    // has a live proposal
    const BASE = await this.createMint(this.payer.publicKey, 6);
    const QUOTE = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(BASE, this.payer.publicKey);
    await this.createTokenAccount(QUOTE, this.payer.publicKey);

    await this.mintTo(BASE, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      QUOTE,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: BASE,
        quoteMint: QUOTE,
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
            amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [spendDao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao: spendDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal: spendProposal, squadsProposal: spendSquadsProposal } =
      await this.futarchy.initializeLargeSpendProposal({
        dao: spendDao,
        amount: new BN(1_000_000_000), // 1,000 USDC
      });

    await this.futarchy
      .sponsorProposalIx({
        proposal: spendProposal,
        dao: spendDao,
        teamAddress: this.payer.publicKey,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal: spendProposal,
        dao: spendDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        squadsProposal: spendSquadsProposal,
      })
      .rpc();

    // Nobody contests the market: one swap after the TWAP start delay
    // records an observation in both markets and leaves the TWAPs equal
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao: spendDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();

    // Past the kind's 1.5-day duration snapshot
    await this.advanceBySeconds(129_600);
    await this.futarchy.finalizeProposal(spendProposal);

    // Equal TWAPs clear the -10% snapshot threshold
    const storedProposal = await this.futarchy.getProposal(spendProposal);
    assert.exists(storedProposal.state.passed);

    const squadsProposalAccount =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        spendSquadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(squadsProposalAccount.status),
    );
  });

  it("stamps only its own cooldown timestamp when a hostile proposal fails", async function () {
    // Fresh DAO — the suite DAO already has a live proposal
    const BASE = await this.createMint(this.payer.publicKey, 6);
    const QUOTE = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(BASE, this.payer.publicKey);
    await this.createTokenAccount(QUOTE, this.payer.publicKey);

    await this.mintTo(BASE, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      QUOTE,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    const hostileDao = await setupBasicDao({
      context: this,
      baseMint: BASE,
      quoteMint: QUOTE,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao: hostileDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100 * 10 ** 6),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const { proposal: hostileProposal, squadsProposal } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao: hostileDao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: { keep: {} },
      });

    await this.futarchy
      .launchProposalIx({
        proposal: hostileProposal,
        dao: hostileDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        squadsProposal,
      })
      .rpc();

    // One swap after the TWAP start delay records an observation in both
    // markets; the equal TWAPs it leaves can't clear the +10% threshold
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao: hostileDao,
        baseMint: BASE,
        quoteMint: QUOTE,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 20);
    await this.futarchy.finalizeProposal(hostileProposal);

    const storedProposal = await this.futarchy.getProposal(hostileProposal);
    assert.exists(storedProposal.state.failed);

    // The failed takeover stamps its own timestamp and only its own
    const clock = await this.banksClient.getClock();
    const storedDao = await this.futarchy.getDao(hostileDao);
    assert.equal(
      storedDao.lastFailedTakeoverAt.toString(),
      clock.unixTimestamp.toString(),
    );
    assert.equal(storedDao.lastFailedLiquidationAt.toString(), "0");
  });
}
