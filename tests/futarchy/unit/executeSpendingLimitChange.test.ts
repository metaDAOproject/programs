import {
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/futarchy/v0.6";
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
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
const { Permissions, Permission } = multisig.types;

// TODO: abstract away these tests to make code cleaner

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    multisigPda: PublicKey,
    squadsProposal: PublicKey;

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

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });

    multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  });

  it("executes spending limit change proposal", async function () {
    const newSpendingLimitPda = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    const addSpendingLimitIx = multisig.instructions.multisigAddSpendingLimit({
      multisigPda,
      spendingLimit: newSpendingLimitPda,
      configAuthority: dao,
      rentPayer: this.payer.publicKey,
      createKey: dao,
      vaultIndex: 0,
      mint: USDC,
      amount: new BN(50_000 * 10 ** 6), // 50,000 USDC
      period: multisig.types.Period.Month,
      members: [this.payer.publicKey], // Only the DAO can use this spending limit
      destinations: [], // No specific destinations
      memo: "",
    });

    const proposalResult = await this.initializeAndLaunchProposal({
      dao,
      instructions: [addSpendingLimitIx],
    });

    proposal = proposalResult.proposal;
    squadsProposal = proposalResult.squadsProposal;

    const { question, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Trade heavily on pass market to make it pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
      })
      .rpc();

    // Crank TWAP to build up price history
    for (let i = 0; i < 100; i++) {
      this.advanceBySeconds(10_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
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

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: multisigPda,
      index: 1n,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: transactionAccount.vaultIndex,
      programId: multisig.PROGRAM_ID,
    });

    const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
      {
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      },
    );

    await this.futarchy.futarchy.methods
      .executeSpendingLimitChange()
      .accounts({
        squadsMultisig: multisigPda,
        proposal,
        dao,
        squadsProposal,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .rpc();
  });

  it("throws if the transaction is to remove the DAO as a member", async function () {
    const removeMemberIx = multisig.instructions.multisigRemoveMember({
      multisigPda,
      configAuthority: dao,
      oldMember: dao,
    });

    const proposalResult = await this.initializeAndLaunchProposal({
      dao,
      instructions: [removeMemberIx],
    });

    proposal = proposalResult.proposal;
    squadsProposal = proposalResult.squadsProposal;

    const { question, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Trade heavily on pass market to make it pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
      })
      .rpc();

    // Crank TWAP to build up price history
    for (let i = 0; i < 100; i++) {
      this.advanceBySeconds(10_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
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

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: multisigPda,
      index: 1n,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: transactionAccount.vaultIndex,
      programId: multisig.PROGRAM_ID,
    });

    const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
      {
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      },
    );

    const callbacks = expectError(
      "InvalidTransaction",
      "The transaction should not be executed because it contains a call to remove the DAO as a member",
    );

    await this.futarchy.futarchy.methods
      .executeSpendingLimitChange()
      .accounts({
        squadsMultisig: multisigPda,
        proposal,
        dao,
        squadsProposal,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws if the vault transaction is a memo instruction", async function () {
    const proposalResult = await this.initializeAndLaunchProposal({
      dao,
      instructions: [
        {
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from("Hello, world!"),
        },
      ],
    });

    proposal = proposalResult.proposal;
    squadsProposal = proposalResult.squadsProposal;

    const { question, quoteVault } = this.futarchy.getProposalPdas(
      proposal,
      META,
      USDC,
      dao,
    );

    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(11_000 * 1_000_000), 2)
      .rpc();

    // Trade heavily on pass market to make it pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000),
      })
      .rpc();

    // Crank TWAP to build up price history
    for (let i = 0; i < 100; i++) {
      this.advanceBySeconds(10_000);

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          quoteMint: USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
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

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: multisigPda,
      index: 1n,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: transactionAccount.vaultIndex,
      programId: multisig.PROGRAM_ID,
    });

    const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
      {
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      },
    );

    const callbacks = expectError(
      "InvalidTransaction",
      "The transaction should not be executed because it contains a call to remove the DAO as a member",
    );

    await this.futarchy.futarchy.methods
      .executeSpendingLimitChange()
      .accounts({
        squadsMultisig: multisigPda,
        proposal,
        dao,
        squadsProposal,
        squadsMultisigProgram: multisig.PROGRAM_ID,
        vaultTransaction: vaultTransactionPda,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
