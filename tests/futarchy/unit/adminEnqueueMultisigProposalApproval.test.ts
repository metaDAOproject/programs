import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError, makeOldDaoLayout } from "../../utils.js";
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

    // 200/200k tokens (not 100/100k): setupBasicDaoWithLiquidity mints the
    // same 10^11 atoms to the same ATAs, and identical amounts would make
    // these mintTo transactions byte-identical to the helper's, failing with
    // "This transaction has already been processed" when they share a
    // blockhash tick
    await this.mintTo(META, this.payer.publicKey, this.payer, 200 * 10 ** 9);
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

  it("should enqueue a proposal approval", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([this.payer])
      .rpc();

    const enqueued =
      await this.futarchy.futarchy.account.enqueuedMultisigProposalApproval.fetch(
        enqueuedApprovalPda,
      );
    assert.equal(enqueued.dao.toBase58(), dao.toBase58());
    assert.equal(enqueued.transactionIndex.toString(), "1");
  });

  it("rejects a legacy-sized DAO whose residue decodes as a liquidator", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );

    // The attacker pays rent for the enqueued approval account
    const attacker = Keypair.generate();
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: attacker.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    // Shrink the DAO to the pre-migration allocation and plant, immediately
    // after its Spot-layout body, the bytes a legacy DAO carries there once a
    // finalized proposal has collapsed its AMM from Futarchy back to Spot:
    // `Some(attacker)` where the new layout reads `liquidator`, then zeros for
    // the two timestamps, the dirty flag, and the buyback timestamp.
    const residue = Buffer.concat([
      Buffer.from([1]),
      attacker.publicKey.toBuffer(),
      Buffer.alloc(25),
    ]);
    await makeOldDaoLayout(this, dao, {}, { residue });

    // The account still decodes — with the attacker as the liquidator
    // authority — so only the size guard stands between them and enqueueing.
    const crafted = await this.futarchy.getDao(dao);
    assert.equal(crafted.liquidator.toBase58(), attacker.publicKey.toBase58());
    assert.exists(crafted.amm.state.spot);

    const callbacks = expectError(
      "AccountNotMigrated",
      "enqueued on an un-migrated legacy DAO",
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: attacker.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: deriveEnqueuedApprovalPda(this, dao, 1n),
      })
      .signers([attacker])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail with PoolNotInSpotState when a futarchy proposal is active", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    // Launching a futarchy proposal creates a Squads proposal at index 1 and
    // moves the AMM out of Spot. Use that Squads proposal as our approval
    // target — any Active Squads proposal would do here; we just need one
    // that exists when the AMM is non-Spot.
    const { squadsProposal } = await this.initializeAndLaunchProposal({
      dao,
      instructions: [],
    });

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    const callbacks = expectError(
      "PoolNotInSpotState",
      "enqueue should fail when the AMM is not in Spot state",
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail when enqueuing twice for the same transaction_index", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([this.payer])
      .rpc();

    try {
      await this.futarchy.futarchy.methods
        .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
        .accounts({
          dao,
          admin: this.payer.publicKey,
          squadsMultisig: daoAccount.squadsMultisig,
          squadsMultisigProposal: proposalPda,
          enqueuedApproval: enqueuedApprovalPda,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .signers([this.payer])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // The init constraint fails because the account already exists
      // (system program error 0x0).
      assert.include(e.message, "custom program error: 0x0");
    }
  });

  it("should fail with InvalidSquadsProposalStatus when the Squads proposal is no longer Active", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    const { proposalPda } = await createSquadsVaultTxAndProposal(
      this,
      daoAccount.squadsMultisig,
      1n,
    );

    const enqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .signers([this.payer])
      .rpc();

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
      .rpc();

    const callbacks = expectError(
      "InvalidSquadsProposalStatus",
      "second enqueue should fail because proposal is no longer Active",
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: proposalPda,
        enqueuedApproval: enqueuedApprovalPda,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail with RequireGtViolated when the Squads proposal is stale", async function () {
    const daoAccount = await this.futarchy.getDao(dao);

    const { proposalPda: victimProposalPda } =
      await createSquadsVaultTxAndProposal(
        this,
        daoAccount.squadsMultisig,
        1n,
        "will be invalidated",
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
    const configEnqueuedApprovalPda = deriveEnqueuedApprovalPda(
      this,
      dao,
      configTransactionIndex,
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({
        transactionIndex: new BN(configTransactionIndex.toString()),
      })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: configProposalPda,
        enqueuedApproval: configEnqueuedApprovalPda,
      })
      .signers([this.payer])
      .rpc();

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

    const victimEnqueuedApprovalPda = deriveEnqueuedApprovalPda(this, dao, 1n);

    const callbacks = expectError(
      "RequireGtViolated",
      "enqueue should fail because the proposal was invalidated by a later config tx",
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(1) })
      .accounts({
        dao,
        admin: this.payer.publicKey,
        squadsMultisig: daoAccount.squadsMultisig,
        squadsMultisigProposal: victimProposalPda,
        enqueuedApproval: victimEnqueuedApprovalPda,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([this.payer])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
