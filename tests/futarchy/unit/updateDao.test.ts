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
} from "@metadaoproject/futarchy-v2";
import BN from "bn.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = MAINNET_USDC;

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.mintTo(META, this.payer.publicKey, this.payer, 10_000 * 10 ** 9);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

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
          e.toString().includes("0x1798"),
        `Expected ActiveOptimisticProposalAlreadyEnqueued error, got: ${e}`,
      );
    }
  });
}
