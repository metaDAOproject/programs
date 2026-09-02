import {
  getEnqueuedMultisigProposalCancellationAddr,
  getProposalAddrsForTransactionIndex,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import { PublicKey } from "@solana/web3.js";
import {
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
} from "../../utils.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createMemoInstruction } from "@solana/spl-memo";

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    squadsMultisig: PublicKey,
    squadsMultisigVault: PublicKey;

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

    const storedDao = await this.futarchy.getDao(dao);
    squadsMultisig = storedDao.squadsMultisig;
    squadsMultisigVault = storedDao.squadsMultisigVault;
  });

  // A memo vault transaction + proposal at `transactionIndex`, force-approved
  // so it is executable without a market
  const createApprovedPayload = async function (
    context: any,
    transactionIndex: bigint,
  ) {
    const { tx } = context.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [createMemoInstruction("hello world")],
      transactionIndex,
    });
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
    await context.banksClient.processTransaction(tx);

    const addrs = getProposalAddrsForTransactionIndex({
      dao,
      transactionIndex,
    });
    await forceApproveSquadsProposal(context, addrs.squadsProposal);
    return addrs;
  };

  const enqueue = async function (context: any, transactionIndex: bigint) {
    await context.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex })
      .rpc();
    return getEnqueuedMultisigProposalCancellationAddr({
      dao,
      transactionIndex,
    })[0];
  };

  // Runs a multisig_set_time_lock config instruction as vault transaction
  // `configTransactionIndex`: approved through the approval set, then executed
  // through admin_execute_multisig_proposal so the DAO PDA signs as config
  // authority. Squads invalidates every prior transaction on the way.
  const advanceStaleIndex = async function (
    context: any,
    configTransactionIndex: bigint,
  ) {
    const setTimeLockIx = multisig.instructions.multisigSetTimeLock({
      multisigPda: squadsMultisig,
      timeLock: 100,
      configAuthority: dao,
    });

    const { tx } = context.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [setTimeLockIx],
      transactionIndex: configTransactionIndex,
    });
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
    await context.banksClient.processTransaction(tx);

    const { squadsProposal: configProposal, squadsTransaction } =
      getProposalAddrsForTransactionIndex({
        dao,
        transactionIndex: configTransactionIndex,
      });

    await context.futarchy
      .adminEnqueueMultisigProposalApprovalIx({
        dao,
        transactionIndex: configTransactionIndex,
      })
      .rpc();

    await context.futarchy
      .executeMultisigProposalApprovalIx({
        dao,
        transactionIndex: configTransactionIndex,
      })
      .rpc();

    const configTransactionAccount =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        context.squadsConnection,
        squadsTransaction,
      );
    const { accountMetas } = await multisig.utils.accountsForTransactionExecute(
      {
        connection: context.squadsConnection,
        message: configTransactionAccount.message,
        ephemeralSignerBumps: [
          ...configTransactionAccount.ephemeralSignerBumps,
        ],
        vaultPda: squadsMultisigVault,
        transactionPda: squadsTransaction,
        programId: multisig.PROGRAM_ID,
      },
    );

    await context.futarchy.futarchy.methods
      .adminExecuteMultisigProposal()
      .accounts({
        dao,
        squadsMultisig,
        squadsMultisigProposal: configProposal,
        squadsMultisigVaultTransaction: squadsTransaction,
        admin: context.payer.publicKey,
        squadsMultisigProgram: multisig.PROGRAM_ID,
      })
      .remainingAccounts(
        accountMetas.map((meta) =>
          meta.pubkey.equals(dao) ? { ...meta, isSigner: false } : meta,
        ),
      )
      .signers([context.payer])
      .rpc();
  };

  it("cancels the Squads proposal with a permissionless signer and closes the enqueued cancellation", async function () {
    const { squadsProposal, squadsTransaction } = await createApprovedPayload(
      this,
      1n,
    );
    const enqueuedCancellationPda = await enqueue(this, 1n);

    await this.futarchy
      .executeMultisigProposalCancellationIx({
        dao,
        transactionIndex: 1n,
        rentReceiver: PERMISSIONLESS_ACCOUNT.publicKey,
      })
      .signers([PERMISSIONLESS_ACCOUNT])
      .rpc();

    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusCancelled(storedSquadsProposal.status),
    );
    assert.deepEqual(
      storedSquadsProposal.cancelled.map((k) => k.toBase58()),
      [dao.toBase58()],
    );

    assert.isNull(await this.banksClient.getAccount(enqueuedCancellationPda));

    // The payload is dead: Squads' execute requires Approved
    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have thrown error");
    } catch (e) {
      // Squads' InvalidProposalStatus (0x1778 = 6008)
      assert.isTrue(e.toString().includes("0x1778"), `unexpected error: ${e}`);
    }
  });

  it("fails when no enqueued cancellation exists", async function () {
    await createApprovedPayload(this, 1n);

    const callbacks = expectError(
      "AccountNotInitialized",
      "execute should fail without an enqueued cancellation PDA",
    );

    await this.futarchy
      .executeMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with SquadsProposalNotApproved when the payload executes between enqueue and execute", async function () {
    const { squadsTransaction } = await createApprovedPayload(this, 1n);
    const enqueuedCancellationPda = await enqueue(this, 1n);

    await executeVaultTransaction(this, dao, squadsTransaction);

    const callbacks = expectError(
      "SquadsProposalNotApproved",
      "execute should fail once the payload has executed",
    );

    await this.futarchy
      .executeMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    assert.isNotNull(
      await this.banksClient.getAccount(enqueuedCancellationPda),
    );
  });

  it("cancels a stale Approved proposal", async function () {
    const { squadsProposal: victimProposal } = await createApprovedPayload(
      this,
      1n,
    );

    await advanceStaleIndex(this, 2n);

    const storedMultisig = await multisig.accounts.Multisig.fromAccountAddress(
      this.squadsConnection,
      squadsMultisig,
    );
    assert.equal(storedMultisig.staleTransactionIndex.toString(), "2");

    await enqueue(this, 1n);

    await this.futarchy
      .executeMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc();

    const storedVictim = await multisig.accounts.Proposal.fromAccountAddress(
      this.squadsConnection,
      victimProposal,
    );
    assert.isTrue(
      multisig.generated.isProposalStatusCancelled(storedVictim.status),
    );
  });
}
