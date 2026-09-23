import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError } from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createMemoInstruction } from "@solana/spl-memo";
import BN from "bn.js";

const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

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

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  const deriveEnqueuedApprovalPda = (
    context: any,
    daoKey: PublicKey,
    transactionIndex: bigint,
  ): PublicKey => {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        SEED_ENQUEUED_APPROVAL,
        daoKey.toBuffer(),
        new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
      ],
      context.futarchy.futarchy.programId,
    );
    return pda;
  };

  const createSquadsVaultTxAndProposal = async function (
    context: any,
    squadsMultisig: PublicKey,
    transactionIndex: bigint,
    memo = "hello world",
  ) {
    const vaultTransactionCreateIx =
      multisig.instructions.vaultTransactionCreate({
        multisigPda: squadsMultisig,
        transactionIndex,
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: context.payer.publicKey,
        vaultIndex: 0,
        transactionMessage: new TransactionMessage({
          payerKey: context.payer.publicKey,
          recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
          instructions: [createMemoInstruction(memo)],
        }),
        ephemeralSigners: 0,
      });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: squadsMultisig,
      transactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: context.payer.publicKey,
    });

    const tx = new Transaction().add(
      vaultTransactionCreateIx,
      proposalCreateIx,
    );
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);

    await context.banksClient.processTransaction(tx);

    const [proposalPda] = multisig.getProposalPda({
      multisigPda: squadsMultisig,
      transactionIndex,
    });

    return { proposalPda };
  };

  const enqueue = async function (
    context: any,
    daoKey: PublicKey,
    squadsMultisigKey: PublicKey,
    squadsProposalPda: PublicKey,
    transactionIndex: bigint,
  ) {
    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(
      context,
      daoKey,
      transactionIndex,
    );
    await context.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({
        transactionIndex: new BN(transactionIndex.toString()),
      })
      .accounts({
        dao: daoKey,
        admin: context.payer.publicKey,
        squadsMultisig: squadsMultisigKey,
        squadsMultisigProposal: squadsProposalPda,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([context.payer])
      .rpc();
    return enqueuedApprovalPda;
  };

  it("should execute an enqueued approval with a permissionless signer", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );
    const enqueuedApprovalPda = await enqueue(
      this,
      dao,
      daoAccount.squadsMultisig,
      proposalPda,
      1n,
    );

    let squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      proposalPda,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusActive(squadsProposal.status),
    );

    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: PERMISSIONLESS_ACCOUNT.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([PERMISSIONLESS_ACCOUNT])
      .rpc();

    squadsProposal = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      proposalPda,
    );
    assert.equal(squadsProposal.approved[0].toBase58(), dao.toBase58());
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(squadsProposal.status),
    );

    const enqueuedAccount =
      await this.banksClient.getAccount(enqueuedApprovalPda);
    assert.isNull(enqueuedAccount);
  });

  it("should fail when no enqueued approval exists", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    const callbacks = expectError(
      "AccountNotInitialized",
      "execute should fail without an enqueued approval PDA",
    );

    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail with PoolNotInSpotState when a futarchy proposal launches between enqueue and execute", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Initialize (but don't launch) a futarchy proposal. This creates a
    // Squads proposal at index 1 and leaves the AMM in Spot — so we can
    // enqueue approval against it. Launching is done separately below.
    const { proposal, squadsProposal: proposalPda } =
      await this.initializeProposal({ dao, instructions: [] });

    const enqueuedApprovalPda = await enqueue(
      this,
      dao,
      daoAccount.squadsMultisig,
      proposalPda,
      1n,
    );

    // Now launch the futarchy proposal to push the AMM out of Spot.
    const storedDao = await this.futarchy.getDao(dao);
    const { squadsVaultTransaction } =
      await this.futarchy.getSquadsVaultTransactionAccounts(proposalPda);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: storedDao.baseMint,
        quoteMint: storedDao.quoteMint,
        squadsProposal: proposalPda,
        squadsVaultTransaction,
      })
      .rpc();

    const callbacks = expectError(
      "PoolNotInSpotState",
      "execute should fail once the AMM is no longer in Spot state",
    );

    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const enqueuedAccount =
      await this.banksClient.getAccount(enqueuedApprovalPda);
    assert.isNotNull(enqueuedAccount);
  });

  it("should fail with RequireGtViolated when the Squads proposal is invalidated between enqueue and execute", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const { proposalPda: victimProposalPda } =
      await createSquadsVaultTxAndProposal(
        this,
        daoAccount.squadsMultisig,
        1n,
        "will be invalidated",
      );

    const victimEnqueuedApprovalPda = await enqueue(
      this,
      dao,
      daoAccount.squadsMultisig,
      victimProposalPda,
      1n,
    );

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

    const configProposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: configTransactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const squadsCreateConfigTx = new Transaction().add(
      vaultConfigTransactionCreateIx,
      configProposalCreateIx,
    );
    squadsCreateConfigTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsCreateConfigTx.feePayer = this.payer.publicKey;
    squadsCreateConfigTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(squadsCreateConfigTx);

    const [vaultConfigTransactionPda] = multisig.getTransactionPda({
      multisigPda: daoAccount.squadsMultisig,
      index: configTransactionIndex,
    });
    const [configProposalPda] = multisig.getProposalPda({
      multisigPda: daoAccount.squadsMultisig,
      transactionIndex: configTransactionIndex,
    });
    const configEnqueuedApprovalPda = await enqueue(
      this,
      dao,
      daoAccount.squadsMultisig,
      configProposalPda,
      configTransactionIndex,
    );

    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: configProposalPda,
        enqueuedApproval: configEnqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .signers([this.payer])
      .rpc();

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

    await this.futarchy.futarchy.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: configProposalPda,
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

    const callbacks = expectError(
      "RequireGtViolated",
      "execute should fail because the proposal was invalidated by the config tx",
    );

    await this.futarchy.futarchy.methods
      .executeMultisigProposalApproval()
      .accounts({
        dao,
        rentReceiver: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: victimProposalPda,
        enqueuedApproval: victimEnqueuedApprovalPda,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    const stillEnqueued = await this.banksClient.getAccount(
      victimEnqueuedApprovalPda,
    );
    assert.isNotNull(stillEnqueued);
  });
}
