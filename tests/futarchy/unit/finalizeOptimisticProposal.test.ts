import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.7";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import BN from "bn.js";
import { expectError, setOptimisticGovernanceEnabled } from "../../utils.js";
import { getDaoAddr, MAINNET_USDC } from "@metadaoproject/futarchy/v0.7";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { assert } from "chai";
import * as squads from "@sqds/multisig";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 9, 6);

export default function suite() {
  let META: PublicKey,
    dao: PublicKey,
    spendingLimit: BN,
    transferAmount: bigint;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    spendingLimit = new BN(10_000);
    transferAmount = 1000n;
    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);

    // Mint tokens to payer's accounts
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: MAINNET_USDC,
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

    await this.createTokenAccount(MAINNET_USDC, daoAccount.squadsMultisigVault);

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      daoAccount.squadsMultisigVault,
      100_000 * 1_000_000,
    );

    await setOptimisticGovernanceEnabled(this, dao, true);

    await this.futarchy
      .initiateVaultSpendOptimisticProposalIx({
        dao,
        amount: new BN(transferAmount),
        recipient: this.payer.publicKey,
        transactionIndex: 1n,
      })
      .signers([this.payer, PERMISSIONLESS_ACCOUNT])
      .rpc();
  });

  it("can finalize a vault spend optimistic proposal and execute the squads proposal afterwards", async function () {
    this.advanceBySeconds(60 * 60 * 24 * 3);

    let daoAccount = await this.futarchy.getDao(dao);

    await this.futarchy
      .finalizeOptimisticProposalIx({
        dao,
        squadsProposal: daoAccount.optimisticProposal.squadsProposal,
      })
      .rpc();

    daoAccount = await this.futarchy.getDao(dao);

    assert.notExists(daoAccount.optimisticProposal);

    const payerUsdcBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // Confirm that we can execute the squads proposal
    const txExecuteIx = await squads.instructions.vaultTransactionExecute({
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

    await this.banksClient.processTransaction(txExecute);

    const payerUsdcBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    assert.equal(
      payerUsdcBalanceAfter,
      payerUsdcBalanceBefore + transferAmount,
    );
  });

  it("can't finalize a vault spend optimistic proposal if the proposal account is not the same as the optimistic proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    let transferIx = createTransferInstruction(
      getAssociatedTokenAddressSync(
        MAINNET_USDC,
        daoAccount.squadsMultisigVault,
        true,
      ),
      getAssociatedTokenAddressSync(MAINNET_USDC, this.payer.publicKey),
      daoAccount.squadsMultisigVault,
      123,
    );

    let transactionMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [transferIx],
    });

    const dupeProposalTx = new Transaction().add(
      squads.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 2n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: transactionMessage,
      }),
      squads.instructions.proposalCreate({
        multisigPda: daoAccount.squadsMultisig,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        transactionIndex: 2n,
        isDraft: false,
      }),
    );

    dupeProposalTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    dupeProposalTx.feePayer = this.payer.publicKey;
    dupeProposalTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(dupeProposalTx);

    const callbacks = expectError(
      "ConstraintAddress",
      "An address constraint was violated",
    );

    await this.futarchy
      .finalizeOptimisticProposalIx({
        dao,
        squadsProposal: squads.getProposalPda({
          multisigPda: daoAccount.squadsMultisig,
          transactionIndex: 2n,
        })[0],
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't finalize a vault spend optimistic proposal if the proposal is too young", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const callbacks = expectError(
      "ProposalTooYoung",
      "Proposal is too young to be executed or rejected",
    );

    await this.futarchy
      .finalizeOptimisticProposalIx({
        dao,
        squadsProposal: daoAccount.optimisticProposal.squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("can't finalize a vault spend optimistic proposal if there is no active optimistic proposal", async function () {
    this.advanceBySeconds(60 * 60 * 24 * 3);

    const daoAccount = await this.futarchy.getDao(dao);

    // Finalize the running optimistic proposal
    await this.futarchy
      .finalizeOptimisticProposalIx({
        dao,
        squadsProposal: daoAccount.optimisticProposal.squadsProposal,
      })
      .rpc();

    try {
      await this.futarchy
        .finalizeOptimisticProposalIx({
          dao,
          squadsProposal: daoAccount.optimisticProposal.squadsProposal,
        })
        .preInstructions([
          // Add any instruction to prevent banksClient from reverting the transaction - compute budget is perfectly fine
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ])
        .rpc();

      assert.fail("Should have thrown error");
    } catch (error) {
      const logsAggregated = error.logs.map((log: string) => log).join("\n");
      assert.include(
        logsAggregated,
        "panicked at 'called `Option::unwrap()` on a `None` value'",
      );
    }
  });
}
