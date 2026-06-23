import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import {
  expectError,
  setupBasicDao,
  setProposalValidationEnabled,
} from "../../utils.js";
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

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    // Validation enabled so the MetaDAO approval point is live (approve_proposal
    // requires it); setupBasicDao uses baseToStake: 0, so a draft proposal can
    // still launch.
    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      isProposalValidationEnabled: true,
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

    // Wrap an arbitrary instruction in a squads vault transaction so we have a
    // valid active squads proposal to initialize the futarchy proposal against.
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
          isProposalValidationEnabled: null,
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

  it("approves a draft proposal and sets is_metadao_approved", async function () {
    const before = await this.futarchy.getProposal(proposal);
    assert.isFalse(before.isMetadaoApproved);

    const daoBefore = await this.futarchy.getDao(dao);

    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .rpc();

    const after = await this.futarchy.getProposal(proposal);
    assert.isTrue(after.isMetadaoApproved);

    // ApproveProposalEvent carries common.dao_seq_num, sourced from this bump.
    // bankrun's transaction metadata exposes neither inner instructions nor
    // emit_cpi! payloads, so the seq_num increment is the observable proof that
    // the event-emitting code path ran to completion.
    const daoAfter = await this.futarchy.getDao(dao);
    assert.equal(daoAfter.seqNum.toNumber(), daoBefore.seqNum.toNumber() + 1);
  });

  it("rejects a second approval with ProposalAlreadyApproved", async function () {
    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .rpc();

    const callbacks = expectError(
      "ProposalAlreadyApproved",
      "a second approval should fail",
    );

    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects approval once the proposal has left Draft", async function () {
    // Sponsor so the proposal can launch without being MetaDAO-approved.
    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    const launched = await this.futarchy.getProposal(proposal);
    assert.exists(launched.state.pending);

    const callbacks = expectError(
      "ProposalNotInDraftState",
      "approval should fail once the proposal has launched",
    );

    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects approval when proposal validation is disabled", async function () {
    // Flip the DAO onto the legacy gate, where the MetaDAO approval point is inert;
    // approving must then be rejected rather than write dead state.
    await setProposalValidationEnabled(this, dao, false);

    const callbacks = expectError(
      "ProposalValidationDisabled",
      "approval on a non-validating DAO must be rejected",
    );

    await this.futarchy
      .approveProposalIx({ proposal, dao, approver: this.payer.publicKey })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
