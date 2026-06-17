import { PERMISSIONLESS_ACCOUNT, PriceMath } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
const { Permissions, Permission } = multisig.types;

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

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
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
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
    // Trade for ~200,000s of the 259,200s proposal duration, then stop
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

    // Trade for ~200,000 seconds (10 swaps × 20,000s each)
    // This is ~77% of the 259,200s proposal duration
    for (let i = 0; i < 10; i++) {
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

    // At ~200,000s into a 259,200s proposal — finalization should fail
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

    // Stop trading. Advance time past the proposal deadline (259,200s).
    // Last trade was at ~200,000s. We need at least 60,000 more seconds.
    await this.advanceBySeconds(70_000);

    // Finalize — should succeed because:
    // 1. Wall-clock time is past the deadline (validate() passes)
    // 2. At least one trade occurred after TWAP start delay (new check passes)
    // 3. get_twap()'s virtual crank extends the last observation to current time
    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);
  });

  it("passes proposals when the team sponsors them and pass twap is slightly below fail twap", async function () {
    // Create a new DAO with -5% team-sponsored threshold
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
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
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

    // Finalize the proposal - should pass because it's team-sponsored
    // and the pass TWAP is within the -5% threshold
    await this.futarchy.finalizeProposal(teamSponsoredProposal);

    const storedProposal = await this.futarchy.getProposal(
      teamSponsoredProposal,
    );
    assert.exists(
      storedProposal.state.passed,
      "Team-sponsored proposal should pass when within threshold",
    );
  });
}
