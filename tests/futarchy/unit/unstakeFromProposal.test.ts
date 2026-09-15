import {
  InstructionUtils,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
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

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    squadsProposalPda: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Ensure the clock is well above zero so `timestamp_enqueued == 0`
    // (the draft-state sentinel) is unambiguously in the past, regardless
    // of what earlier test files did to the clock.
    await this.advanceBySeconds(3600);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 1_000 * 10 ** 6);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 10 ** 6,
    );

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

    const tx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(tx);

    proposal = await this.futarchy.initializeProposal(dao, squadsProposalPda);
  });

  it("allows unstaking from a Draft proposal", async function () {
    const stakeAmount = new BN(100 * 10 ** 6);

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    const beforeBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    await this.futarchy
      .unstakeFromProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    const afterBalance = await this.getTokenBalance(META, this.payer.publicKey);
    assert.equal(
      (afterBalance - beforeBalance).toString(),
      stakeAmount.toString(),
    );
  });

  it("allows unstaking from a launched proposal after the delay", async function () {
    const stakeAmount = new BN(100 * 10 ** 6);

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    await this.advanceBySeconds(5);

    const beforeBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    await this.futarchy
      .unstakeFromProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    const afterBalance = await this.getTokenBalance(META, this.payer.publicKey);
    assert.equal(
      (afterBalance - beforeBalance).toString(),
      stakeAmount.toString(),
    );
  });

  it("fails when unstaking one second before the delay has elapsed", async function () {
    const stakeAmount = new BN(100 * 10 ** 6);

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    // MIN_PROPOSAL_UNSTAKE_DELAY_SECONDS is 5, so advancing by 4 is the
    // largest advance that still leaves the check `clock >= enqueued + 5` false.
    await this.advanceBySeconds(4);

    const callbacks = expectError(
      "ProposalNotReadyToUnstake",
      "Unstaking one second before the delay should fail",
    );

    await this.futarchy
      .unstakeFromProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when unstaking in the same transaction as launch (flash-loan)", async function () {
    const stakeAmount = new BN(100 * 10 ** 6);

    // stakeIxs includes the SDK's ATA-creation preInstructions for the
    // staker/proposal base accounts, which we need because this is the
    // first stake on this proposal.
    const stakeIxs = await InstructionUtils.getInstructions(
      this.futarchy.stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      }),
    );

    // Use .instruction() for launch so we don't pull in its own
    // ComputeBudget preInstruction — Solana rejects transactions with
    // duplicate compute-budget instructions.
    const launchIx = await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .instruction();

    const callbacks = expectError(
      "ProposalNotReadyToUnstake",
      "Unstaking in the same tx as launch should fail the delay check",
    );

    await this.futarchy
      .unstakeFromProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
        ...stakeIxs,
        launchIx,
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
