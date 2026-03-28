import { PERMISSIONLESS_ACCOUNT, PriceMath } from "@metadaoproject/futarchy-v2";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, proposal: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
    });

    // Create a proposal in Draft state
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

    const [squadsProposalPda] = multisig.getProposalPda({
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

  it("should move proposal from Draft to Removed state", async function () {
    // Verify initial state is Draft
    let storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.draft);

    // Call admin_remove_proposal
    await this.futarchy.autocrat.methods
      .adminRemoveProposal()
      .accounts({
        proposal,
        dao,
        admin: this.payer.publicKey,
      })
      .signers([this.payer])
      .rpc();

    // Verify state is now Removed
    storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.removed);
  });

  it("should allow unstaking from Removed proposals", async function () {
    const stakeAmount = new BN(10 * 10 ** 9);

    // Stake first
    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
        staker: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    // Remove the proposal
    await this.futarchy.autocrat.methods
      .adminRemoveProposal()
      .accounts({
        proposal,
        dao,
        admin: this.payer.publicKey,
      })
      .signers([this.payer])
      .rpc();

    // Verify state is Removed
    let storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.removed);

    // Unstake should still work from Removed state
    const initialBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );

    await this.futarchy
      .unstakeFromProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
        staker: this.payer.publicKey,
      })
      .rpc();

    const finalBalance = await this.getTokenBalance(META, this.payer.publicKey);
    assert(finalBalance > initialBalance, "Tokens should be returned");
  });

  it("should not allow staking to Removed proposals", async function () {
    // Remove the proposal first
    await this.futarchy.autocrat.methods
      .adminRemoveProposal()
      .accounts({
        proposal,
        dao,
        admin: this.payer.publicKey,
      })
      .signers([this.payer])
      .rpc();

    // Verify state is Removed
    let storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.removed);

    // Try to stake - should fail with ProposalNotInDraftState
    const callbacks = expectError(
      "ProposalNotInDraftState",
      "Should not allow staking to Removed proposal",
    );

    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: new BN(10 * 10 ** 9),
        staker: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should not allow removing Pending proposals", async function () {
    // Add liquidity to the DAO AMM so launch can succeed
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 10 ** 6),
        maxBaseAmount: new BN(100 * 10 ** 9),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Get squads proposal PDA
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Launch the proposal to move it to Pending state
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    // Verify state is Pending
    let storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);

    // Try to remove - should fail
    const callbacks = expectError(
      "ProposalNotInDraftState",
      "Should not allow removing Pending proposal",
    );

    await this.futarchy.autocrat.methods
      .adminRemoveProposal()
      .accounts({
        proposal,
        dao,
        admin: this.payer.publicKey,
      })
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
