import {
  PERMISSIONLESS_ACCOUNT,
  CONDITIONAL_VAULT_v0_4_PROGRAM_ID,
  SQUADS_PROGRAM_ID,
  getEventAuthorityAddr,
} from "@metadaoproject/futarchy";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
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

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
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
          isOptimisticGovernanceEnabled: null,
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

  it("should cancel a pending proposal", async function () {
    let storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.pending);

    const storedDao = await this.futarchy.getDao(dao);
    const seqNumBefore = storedDao.seqNum.toNumber();

    const {
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.futarchy.getProposalPdas(
      proposal,
      storedDao.baseMint,
      storedDao.quoteMint,
      dao,
    );

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [vaultEventAuthority] = getEventAuthorityAddr(
      CONDITIONAL_VAULT_v0_4_PROGRAM_ID,
    );

    await this.futarchy.futarchy.methods
      .adminCancelProposal()
      .accounts({
        proposal,
        dao,
        question,
        squadsProposal: storedProposal.squadsProposal,
        squadsMultisig: multisigPda,
        squadsMultisigProgram: SQUADS_PROGRAM_ID,
        admin: this.payer.publicKey,
        ammPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          dao,
          true,
        ),
        ammPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          dao,
          true,
        ),
        ammFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          dao,
          true,
        ),
        ammFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          dao,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(
          storedDao.baseMint,
          dao,
          true,
        ),
        ammQuoteVault: getAssociatedTokenAddressSync(
          storedDao.quoteMint,
          dao,
          true,
        ),
        vaultProgram: CONDITIONAL_VAULT_v0_4_PROGRAM_ID,
        vaultEventAuthority,
        quoteVault,
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          storedDao.quoteMint,
          quoteVault,
          true,
        ),
        passQuoteMint,
        failQuoteMint,
        passBaseMint,
        failBaseMint,
        baseVault,
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          storedDao.baseMint,
          baseVault,
          true,
        ),
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .signers([this.payer])
      .rpc();

    storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.failed);

    const storedDaoAfter = await this.futarchy.getDao(dao);
    assert.exists(storedDaoAfter.amm.state.spot);
    assert.notExists(storedDaoAfter.amm.state.futarchy);
    assert.equal(storedDaoAfter.seqNum.toNumber(), seqNumBefore + 1);
  });

  it("should not cancel an already cancelled proposal", async function () {
    const storedProposal = await this.futarchy.getProposal(proposal);
    const storedDao = await this.futarchy.getDao(dao);

    const {
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.futarchy.getProposalPdas(
      proposal,
      storedDao.baseMint,
      storedDao.quoteMint,
      dao,
    );

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [vaultEventAuthority] = getEventAuthorityAddr(
      CONDITIONAL_VAULT_v0_4_PROGRAM_ID,
    );

    const accounts = {
      proposal,
      dao,
      question,
      squadsProposal: storedProposal.squadsProposal,
      squadsMultisig: multisigPda,
      squadsMultisigProgram: SQUADS_PROGRAM_ID,
      admin: this.payer.publicKey,
      ammPassBaseVault: getAssociatedTokenAddressSync(passBaseMint, dao, true),
      ammPassQuoteVault: getAssociatedTokenAddressSync(
        passQuoteMint,
        dao,
        true,
      ),
      ammFailBaseVault: getAssociatedTokenAddressSync(failBaseMint, dao, true),
      ammFailQuoteVault: getAssociatedTokenAddressSync(
        failQuoteMint,
        dao,
        true,
      ),
      ammBaseVault: getAssociatedTokenAddressSync(
        storedDao.baseMint,
        dao,
        true,
      ),
      ammQuoteVault: getAssociatedTokenAddressSync(
        storedDao.quoteMint,
        dao,
        true,
      ),
      vaultProgram: CONDITIONAL_VAULT_v0_4_PROGRAM_ID,
      vaultEventAuthority,
      quoteVault,
      quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
        storedDao.quoteMint,
        quoteVault,
        true,
      ),
      passQuoteMint,
      failQuoteMint,
      passBaseMint,
      failBaseMint,
      baseVault,
      baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
        storedDao.baseMint,
        baseVault,
        true,
      ),
    };

    // Cancel the proposal first
    await this.futarchy.futarchy.methods
      .adminCancelProposal()
      .accounts(accounts)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .signers([this.payer])
      .rpc();

    const cancelledProposal = await this.futarchy.getProposal(proposal);
    assert.exists(cancelledProposal.state.failed);

    // Try to cancel again — should fail with ProposalNotActive
    const callbacks = expectError(
      "ProposalNotActive",
      "should not cancel an already cancelled proposal",
    );

    await this.futarchy.futarchy.methods
      .adminCancelProposal()
      .accounts(accounts)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_001 }),
      ])
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
