import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy-v2";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createMemoInstruction } from "@solana/spl-memo";
import BN from "bn.js";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 9);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Create payer's token accounts for both mints
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    // Mint tokens to payer's accounts
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
  });

  it("should approve a squads proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const vaultTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        transactionMessage: new TransactionMessage({
          payerKey: this.payer.publicKey,
          recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
          instructions: [createMemoInstruction("hello world")],
        }),
        ephemeralSigners: 0,
      });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const squadsCreateTx = new Transaction().add(
      vaultTransactionCreateIx,
      proposalCreateIx,
    );
    squadsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsCreateTx.feePayer = this.payer.publicKey;
    squadsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsCreateTx);

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: 1n,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    let squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsProposalPda,
    );

    assert.equal(squadsProposal.transactionIndex, 1);
    assert.equal(squadsProposal.approved.length, 0);
    assert.isTrue(
      multisig.generated.isProposalStatusActive(squadsProposal.status),
    );

    await this.futarchy.autocrat.methods
      .adminApproveMultisigProposal({ transactionIndex: new BN(1) })
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposalPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc();

    squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      squadsProposalPda,
    );

    assert.equal(squadsProposal.transactionIndex, 1);
    assert.equal(squadsProposal.approved[0].toBase58(), dao.toBase58());
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(squadsProposal.status),
    );
  });

  it("should fail to approve an invalidated proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Create a vault transaction that will be invalidated by the config transaction
    const vaultTransactionToInvalidateCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        transactionMessage: new TransactionMessage({
          payerKey: this.payer.publicKey,
          recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
          instructions: [
            createMemoInstruction("I will never see the light of day"),
          ],
        }),
        ephemeralSigners: 0,
      });

    const vaultProposalToInvalidateCreateIx =
      multisig.instructions.proposalCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: 1n,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
      });

    const configTransactionIndex = 2n;

    const multisigSetTimeLockIx = multisig.instructions.multisigSetTimeLock({
      multisigPda: daoAccount.squadsMultisig,
      timeLock: 100,
      configAuthority: dao,
    });

    const setTimeLockMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [multisigSetTimeLockIx],
    });

    const vaultConfigTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: configTransactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: setTimeLockMessage,
      });

    const multisigConfigProposalCreateIx = multisig.instructions.proposalCreate(
      {
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex: configTransactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
      },
    );

    // Create the squads proposals
    const squadsTransactionsCreateTx = new Transaction().add(
      vaultTransactionToInvalidateCreateIx,
      vaultProposalToInvalidateCreateIx,
      vaultConfigTransactionCreateIx,
      multisigConfigProposalCreateIx,
    );
    squadsTransactionsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsTransactionsCreateTx.feePayer = this.payer.publicKey;
    squadsTransactionsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsTransactionsCreateTx);

    const [vaultConfigTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: configTransactionIndex,
    });

    const [squadsConfigProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: configTransactionIndex,
    });

    const configTransactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultConfigTransactionPda,
      );

    const { accountMetas: configTransactionAccountMetas } =
      await multisig.utils.accountsForTransactionExecute({
        connection: this.squadsConnection,
        message: configTransactionAccount.message,
        ephemeralSignerBumps: [
          ...configTransactionAccount.ephemeralSignerBumps,
        ],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultConfigTransactionPda,
        programId: multisig.PROGRAM_ID,
      });

    // Approve and execute the config transaction using the new split instructions
    await this.futarchy.autocrat.methods
      .adminApproveMultisigProposal({
        transactionIndex: new BN(configTransactionIndex.toString()),
      })
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsConfigProposalPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc();

    await this.futarchy.autocrat.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsConfigProposalPda,
        squadsMultisigVaultTransaction: vaultConfigTransactionPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        configTransactionAccountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([this.payer])
      .rpc();

    // Now try to approve the invalidated proposal (index 1)
    const [squadsInvalidatedProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: 1n,
    });

    const [vaultInvalidatedTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: 1n,
    });

    const callbacks = expectError(
      "StaleProposal",
      "The proposal should not be approved because it should have been invalidated",
    );

    await this.futarchy.autocrat.methods
      .adminApproveMultisigProposal({ transactionIndex: new BN(1) })
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsInvalidatedProposalPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail when DAO has an active optimistic proposal", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Create a simple vault transaction + proposal for the admin to approve
    const transactionIndex = 1n;

    const memoMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [createMemoInstruction("test memo")],
    });

    const createVtAndProposalTx = new Transaction().add(
      multisig.instructions.vaultTransactionCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: memoMessage,
      }),
      multisig.instructions.proposalCreate({
        multisigPda: daoAccount.squadsMultisig,
        transactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: this.payer.publicKey,
      }),
    );
    createVtAndProposalTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createVtAndProposalTx.feePayer = this.payer.publicKey;
    createVtAndProposalTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(createVtAndProposalTx);

    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: transactionIndex,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex,
    });

    const transactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        vaultTransactionPda,
      );

    const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
      {
        connection: this.squadsConnection,
        message: transactionAccount.message,
        ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
        vaultPda: daoAccount.squadsMultisigVault,
        transactionPda: vaultTransactionPda,
        programId: multisig.PROGRAM_ID,
      },
    );

    // Set optimisticProposal on the DAO via direct state manipulation
    daoAccount.optimisticProposal = {
      squadsProposal: Keypair.generate().publicKey,
      enqueuedTimestamp: new BN(1000),
    };
    const daoAccountBuffer =
      await this.futarchy.autocrat.account.dao.coder.accounts.encode(
        "dao",
        daoAccount,
      );
    const daoBanksAccount = await this.banksClient.getAccount(dao);
    daoBanksAccount.data.set(daoAccountBuffer, 0);
    this.context.setAccount(dao, daoBanksAccount);

    const callbacks = expectError(
      "ActiveOptimisticProposalAlreadyEnqueued",
      "Should fail because DAO has an active optimistic proposal",
    );

    await this.futarchy.autocrat.methods
      .adminApproveMultisigProposal({ transactionIndex: new BN(1) })
      .accounts({
        dao: dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposalPda,
        admin: this.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
