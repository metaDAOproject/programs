import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import {
  PERMISSIONLESS_ACCOUNT,
  getProposalAddrV2,
  InstructionUtils,
  getDaoAddr,
  PriceMath,
  MAINNET_USDC,
  sha256,
} from "@metadaoproject/programs";
import BN from "bn.js";
import { setOptimisticGovernanceEnabled, nextDaoNonce } from "../../utils.js";
import { TestContext } from "../../main.test.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

// Builds an UpdateDaoParams object with every field defaulting to null
// (no-op), overriding only the fields under test.
function withNulls(overrides: {
  baseToStake?: BN | null;
  baseToSupermajority?: BN | null;
}) {
  return {
    passThresholdBps: null,
    secondsPerProposal: null,
    twapInitialObservation: null,
    twapMaxObservationChangePerUpdate: null,
    twapStartDelaySeconds: null,
    minQuoteFutarchicLiquidity: null,
    minBaseFutarchicLiquidity: null,
    baseToStake: null,
    teamSponsoredPassThresholdBps: null,
    teamAddress: null,
    isOptimisticGovernanceEnabled: null,
    baseToSupermajority: null,
    ...overrides,
  };
}

// update_dao must be signed by the DAO's Squads vault, whose only Vote member is
// the DAO PDA. So a standalone update_dao is driven by: create the vault tx +
// proposal, approve it through the futarchy admin path (enqueue -> execute the
// approval, which votes via the DAO PDA), then execute the vault tx as a
// SEPARATE top-level transaction. The execute is kept top-level (not via
// admin_execute_multisig_proposal) because update_dao CPIs back into futarchy,
// and futarchy -> squads -> futarchy would trip the Solana reentrancy guard.
async function executeUpdateDao(
  ctx: TestContext,
  dao: PublicKey,
  overrides: { baseToStake?: BN | null; baseToSupermajority?: BN | null },
  transactionIndex: bigint,
) {
  const daoAccount = await ctx.futarchy.getDao(dao);

  const updateIx = await ctx.futarchy
    .updateDaoIx({ dao, params: withNulls(overrides) })
    .instruction();

  const message = new TransactionMessage({
    payerKey: daoAccount.squadsMultisigVault,
    recentBlockhash: (await ctx.banksClient.getLatestBlockhash())[0],
    instructions: [updateIx],
  });

  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: daoAccount.squadsMultisig,
    transactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: ctx.payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: message,
  });
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: daoAccount.squadsMultisig,
    transactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: ctx.payer.publicKey,
  });

  const createTx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  createTx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
  createTx.feePayer = ctx.payer.publicKey;
  createTx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);
  await ctx.banksClient.processTransaction(createTx);

  const [squadsProposalPda] = multisig.getProposalPda({
    multisigPda: daoAccount.squadsMultisig,
    transactionIndex,
  });
  const [enqueuedApprovalPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("enqueued_approval"),
      dao.toBuffer(),
      new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
    ],
    ctx.futarchy.futarchy.programId,
  );

  await ctx.futarchy.futarchy.methods
    .adminEnqueueMultisigProposalApproval({
      transactionIndex: new BN(transactionIndex.toString()),
    })
    .accounts({
      dao,
      admin: ctx.payer.publicKey,
      squadsMultisig: daoAccount.squadsMultisig,
      squadsMultisigProposal: squadsProposalPda,
      enqueuedApproval: enqueuedApprovalPda,
    })
    .signers([ctx.payer])
    .rpc();

  await ctx.futarchy.futarchy.methods
    .executeMultisigProposalApproval()
    .accounts({
      dao,
      rentReceiver: ctx.payer.publicKey,
      squadsMultisig: daoAccount.squadsMultisig,
      squadsMultisigProposal: squadsProposalPda,
      enqueuedApproval: enqueuedApprovalPda,
      squadsMultisigProgram: multisig.PROGRAM_ID,
    })
    .signers([ctx.payer])
    .rpc();

  const execIx = await multisig.instructions.vaultTransactionExecute({
    connection: ctx.squadsConnection,
    multisigPda: daoAccount.squadsMultisig,
    transactionIndex,
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });
  const execTx = new Transaction().add(execIx.instruction);
  execTx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
  execTx.feePayer = ctx.payer.publicKey;
  execTx.sign(ctx.payer, PERMISSIONLESS_ACCOUNT);
  await ctx.banksClient.processTransaction(execTx);
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = MAINNET_USDC;

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.mintTo(META, this.payer.publicKey, this.payer, 10_000 * 10 ** 9);

    const nonce = nextDaoNonce();

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(1),
          minBaseFutarchicLiquidity: new BN(1),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(10_000_000_000),
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          baseToSupermajority: new BN(0),
          teamSponsoredPassThresholdBps: 0,
          teamAddress: this.payer.publicKey,
        },
        provideLiquidity: true,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({
      nonce,
      daoCreator: this.payer.publicKey,
    });

    const daoAccount = await this.futarchy.getDao(dao);

    await this.createTokenAccount(USDC, daoAccount.squadsMultisigVault);
    await this.transfer(
      USDC,
      this.payer,
      daoAccount.squadsMultisigVault,
      100_000 * 1_000_000,
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        maxBaseAmount: new BN(100_000 * 10 ** 6),
        quoteAmount: new BN(100_000 * 10 ** 6),
      })
      .rpc();
  });

  it("should fail updateDao execution when DAO is in Futarchy state", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Step 1: Create updateDao squads vault transaction (index 1)
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          baseToStake: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          twapStartDelaySeconds: null,
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: daoAccount.squadsMultisigVault,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const squadsProposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    const createSquadsTx = new Transaction().add(
      vaultTxCreateIx,
      squadsProposalCreateIx,
    );
    createSquadsTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createSquadsTx.feePayer = this.payer.publicKey;
    createSquadsTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(createSquadsTx);

    // Step 2: Create futarchy proposal A linked to updateDao squads proposal
    let [proposalA] = getProposalAddrV2({ squadsProposal: squadsProposalPda });

    await this.conditionalVault.initializeQuestion(
      sha256(`Will ${proposalA} pass?/FAIL/PASS`),
      proposalA,
      2,
    );

    const { question, baseVault, quoteVault } = this.futarchy.getProposalPdas(
      proposalA,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .initializeVaultIx(question, META, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.conditionalVault.initializeVaultIx(question, USDC, 2),
        ),
      )
      .rpc();

    await this.futarchy
      .initializeProposalIx(squadsProposalPda, dao, META, USDC, question)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Split tokens before launching proposal
    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(1000_000_000), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(1000_000_000), 2)
      .rpc();

    // Launch proposal A to put DAO in Futarchy state
    await this.futarchy
      .launchProposalIx({
        proposal: proposalA,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    // Verify DAO is in Futarchy state
    let daoState = await this.futarchy.getDao(dao);
    assert.isDefined(daoState.amm.state.futarchy);

    // Step 3: Trade on pass market to make proposal A pass
    // Using conditionalSwapIx which handles all the AMM interaction
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal: proposalA,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(900_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // Crank TWAP over time by doing small swaps (this updates the TWAP)
    for (let i = 0; i < 100; i++) {
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal: proposalA,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
          payer: this.payer.publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Step 4: Finalize proposal A - DAO returns to Spot state
    await this.futarchy.finalizeProposal(proposalA);

    // Verify proposal A is passed
    const proposalAAccount = await this.futarchy.getProposal(proposalA);
    console.log("proposalAAccount", proposalAAccount);
    assert.isDefined(proposalAAccount.state.passed);

    // Verify DAO is back in Spot state
    daoState = await this.futarchy.getDao(dao);
    assert.isDefined(daoState.amm.state.spot);

    // Step 5: Launch proposal B to put DAO back into Futarchy state
    // We need to manually create this with transaction index 2 since index 1 is used by updateDao
    const memoInstruction = {
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from("test proposal B"),
    };

    const memoMessage = new TransactionMessage({
      payerKey: daoAccount.squadsMultisigVault,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [memoInstruction],
    });

    const vaultTxCreateIx2 = multisig.instructions.vaultTransactionCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 2n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: memoMessage,
    });

    const squadsProposalCreateIx2 = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 2n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda2] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 2n,
    });

    const createSquadsTx2 = new Transaction().add(
      vaultTxCreateIx2,
      squadsProposalCreateIx2,
    );
    createSquadsTx2.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createSquadsTx2.feePayer = this.payer.publicKey;
    createSquadsTx2.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(createSquadsTx2);

    // Create futarchy proposal B linked to squads proposal 2
    let [proposalB] = getProposalAddrV2({ squadsProposal: squadsProposalPda2 });

    await this.conditionalVault.initializeQuestion(
      sha256(`Will ${proposalB} pass?/FAIL/PASS`),
      proposalB,
      2,
    );

    const proposalBPdas = this.futarchy.getProposalPdas(
      proposalB,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .initializeVaultIx(proposalBPdas.question, META, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.conditionalVault.initializeVaultIx(
            proposalBPdas.question,
            USDC,
            2,
          ),
        ),
      )
      .rpc();

    await this.futarchy
      .initializeProposalIx(
        squadsProposalPda2,
        dao,
        META,
        USDC,
        proposalBPdas.question,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Launch proposal B to put DAO in Futarchy state
    await this.futarchy
      .launchProposalIx({
        proposal: proposalB,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda2,
      })
      .rpc();

    // Verify DAO is in Futarchy state again
    daoState = await this.futarchy.getDao(dao);
    assert.isDefined(daoState.amm.state.futarchy);

    // Step 6: Try to execute updateDao squads transaction
    // This should fail because DAO is in Futarchy state
    const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    const txExecute = new Transaction().add(txExecuteIx.instruction);
    txExecute.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    txExecute.feePayer = this.payer.publicKey;
    txExecute.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    try {
      await this.banksClient.processTransaction(txExecute);
      assert.fail("Should have failed with PoolNotInSpotState");
    } catch (e) {
      // The error comes from the CPI call failing, check for PoolNotInSpotState (0x178a = 6026)
      assert(
        e.toString().includes("PoolNotInSpotState") ||
          e.toString().includes("0x178a"),
        `Expected PoolNotInSpotState error, got: ${e}`,
      );
    }
  });

  it("should fail updateDao execution when DAO has an active optimistic proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Step 1: Create updateDao squads vault transaction (index 1)
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          baseToStake: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          twapStartDelaySeconds: null,
          isOptimisticGovernanceEnabled: null,
          baseToSupermajority: null,
        },
      })
      .instruction();

    const updateDaoMessage = new TransactionMessage({
      payerKey: daoAccount.squadsMultisigVault,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx],
    });

    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: updateDaoMessage,
    });

    const squadsProposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    const createSquadsTx = new Transaction().add(
      vaultTxCreateIx,
      squadsProposalCreateIx,
    );
    createSquadsTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createSquadsTx.feePayer = this.payer.publicKey;
    createSquadsTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(createSquadsTx);

    // Step 2: Create futarchy proposal A linked to updateDao squads proposal
    let [proposalA] = getProposalAddrV2({ squadsProposal: squadsProposalPda });

    await this.conditionalVault.initializeQuestion(
      sha256(`Will ${proposalA} pass?/FAIL/PASS`),
      proposalA,
      2,
    );

    const { question, baseVault, quoteVault } = this.futarchy.getProposalPdas(
      proposalA,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .initializeVaultIx(question, META, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.conditionalVault.initializeVaultIx(question, USDC, 2),
        ),
      )
      .rpc();

    await this.futarchy
      .initializeProposalIx(squadsProposalPda, dao, META, USDC, question)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Split tokens before launching proposal
    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(1000_000_000), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(1000_000_000), 2)
      .rpc();

    // Launch proposal A to put DAO in Futarchy state
    await this.futarchy
      .launchProposalIx({
        proposal: proposalA,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    // Step 3: Trade on pass market to make proposal A pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal: proposalA,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(900_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // Crank TWAP over time by doing small swaps
    for (let i = 0; i < 100; i++) {
      await this.advanceBySeconds(20_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal: proposalA,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          minOutputAmount: new BN(0),
          payer: this.payer.publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Step 4: Finalize proposal A - DAO returns to Spot state
    await this.futarchy.finalizeProposal(proposalA);

    // Verify DAO is in Spot state
    let daoState = await this.futarchy.getDao(dao);
    assert.isDefined(daoState.amm.state.spot);

    // Step 5: Enqueue an optimistic proposal
    await setOptimisticGovernanceEnabled(this, dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        quoteMint: USDC,
        amount: new BN(1000),
        recipient: this.payer.publicKey,
        transactionIndex: 2n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();

    // Verify optimistic proposal is set
    const updatedDao = await this.futarchy.getDao(dao);
    assert.exists(updatedDao.optimisticProposal);

    // Step 6: Try to execute updateDao - should fail with ActiveOptimisticProposalAlreadyEnqueued
    const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    const txExecute = new Transaction().add(txExecuteIx.instruction);
    txExecute.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    txExecute.feePayer = this.payer.publicKey;
    txExecute.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    try {
      await this.banksClient.processTransaction(txExecute);
      assert.fail(
        "Should have failed with ActiveOptimisticProposalAlreadyEnqueued",
      );
    } catch (e) {
      assert(
        e.toString().includes("ActiveOptimisticProposalAlreadyEnqueued") ||
          e.toString().includes("0x1797"),
        `Expected ActiveOptimisticProposalAlreadyEnqueued error, got: ${e}`,
      );
    }
  });

  it("sets base_to_supermajority, enabling the supermajority path", async function () {
    const before = await this.futarchy.getDao(dao);
    assert.equal(before.baseToSupermajority.toNumber(), 0);

    await executeUpdateDao(
      this,
      dao,
      { baseToSupermajority: new BN(1_000_000) },
      1n,
    );

    const after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToSupermajority.toString(), "1000000");
    // seq_num is bumped immediately before emit_cpi!(UpdateDaoEvent), so the
    // increment is the observable proof that the event-emitting path ran
    // (bankrun exposes neither inner instructions nor emit_cpi! payloads).
    assert.equal(after.seqNum.toNumber(), before.seqNum.toNumber() + 1);
  });

  it("rejects base_to_supermajority below base_to_stake", async function () {
    // base_to_stake and base_to_supermajority are set in a single update; the
    // invariant is checked after set_inner applies all fields, so 999 < 1000 fails.
    try {
      await executeUpdateDao(
        this,
        dao,
        { baseToStake: new BN(1000), baseToSupermajority: new BN(999) },
        1n,
      );
      assert.fail("update_dao should have been rejected");
    } catch (e) {
      assert(
        e.toString().includes("InvalidSupermajorityThreshold") ||
          e.toString().includes("0x179d"),
        `Expected InvalidSupermajorityThreshold error, got: ${e}`,
      );
    }

    // The rejected update left the DAO untouched.
    const after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToStake.toNumber(), 0);
    assert.equal(after.baseToSupermajority.toNumber(), 0);
  });

  it("accepts base_to_supermajority equal to, above, or disabling the supermajority", async function () {
    // == base_to_stake (equality is benign)
    await executeUpdateDao(
      this,
      dao,
      { baseToStake: new BN(1000), baseToSupermajority: new BN(1000) },
      1n,
    );
    let after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToStake.toNumber(), 1000);
    assert.equal(after.baseToSupermajority.toNumber(), 1000);

    // > base_to_stake
    await executeUpdateDao(
      this,
      dao,
      { baseToSupermajority: new BN(2000) },
      2n,
    );
    after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToSupermajority.toNumber(), 2000);

    // 0 disables the supermajority path regardless of the (positive) base_to_stake floor.
    await executeUpdateDao(this, dao, { baseToSupermajority: new BN(0) }, 3n);
    after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToSupermajority.toNumber(), 0);
    assert.equal(after.baseToStake.toNumber(), 1000);
  });

  it("accepts raising base_to_stake and base_to_supermajority together", async function () {
    await executeUpdateDao(
      this,
      dao,
      {
        baseToStake: new BN(2_000_000),
        baseToSupermajority: new BN(2_500_000),
      },
      1n,
    );

    const after = await this.futarchy.getDao(dao);
    assert.equal(after.baseToStake.toString(), "2000000");
    assert.equal(after.baseToSupermajority.toString(), "2500000");
  });
}
