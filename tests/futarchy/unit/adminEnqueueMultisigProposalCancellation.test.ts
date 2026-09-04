import {
  getEnqueuedMultisigProposalCancellationAddr,
  getProposalAddrsForTransactionIndex,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
  makeOldDaoLayout,
} from "../../utils.js";
import { assert } from "chai";
import { createMemoInstruction } from "@solana/spl-memo";

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

  // A memo vault transaction + Active proposal at `transactionIndex`
  const createPayload = async function (
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

    return getProposalAddrsForTransactionIndex({ dao, transactionIndex });
  };

  // The same payload, force-approved so it is executable without a market
  const createApprovedPayload = async function (
    context: any,
    transactionIndex: bigint,
  ) {
    const addrs = await createPayload(context, transactionIndex);
    await forceApproveSquadsProposal(context, addrs.squadsProposal);
    return addrs;
  };

  it("enqueues a cancellation for an approved Squads proposal", async function () {
    await createApprovedPayload(this, 1n);

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc();

    const [enqueuedCancellationPda] =
      getEnqueuedMultisigProposalCancellationAddr({
        dao,
        transactionIndex: 1n,
      });
    const enqueued =
      await this.futarchy.futarchy.account.enqueuedMultisigProposalCancellation.fetch(
        enqueuedCancellationPda,
      );
    assert.equal(enqueued.dao.toBase58(), dao.toBase58());
    assert.equal(enqueued.transactionIndex.toString(), "1");
  });

  it("fails with SquadsProposalNotApproved when the Squads proposal is still Active", async function () {
    await createPayload(this, 1n);

    const callbacks = expectError(
      "SquadsProposalNotApproved",
      "enqueue should fail while the Squads proposal is Active",
    );

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with SquadsProposalNotApproved when the Squads proposal was already executed", async function () {
    const { squadsTransaction } = await createApprovedPayload(this, 1n);
    await executeVaultTransaction(this, dao, squadsTransaction);

    const callbacks = expectError(
      "SquadsProposalNotApproved",
      "enqueue should fail once the payload has executed",
    );

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when enqueuing twice for the same transaction_index", async function () {
    await createApprovedPayload(this, 1n);

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex: 1n })
      .rpc();

    try {
      await this.futarchy
        .adminEnqueueMultisigProposalCancellationIx({
          dao,
          transactionIndex: 1n,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // The init constraint fails because the account already exists
      // (system program error 0x0).
      assert.include(e.message, "custom program error: 0x0");
    }
  });

  it("rejects a legacy-sized DAO whose residue decodes as a liquidator", async function () {
    await createApprovedPayload(this, 1n);

    // The attacker pays rent for the enqueued cancellation account
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

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({
        dao,
        transactionIndex: 1n,
        admin: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("enqueues while a futarchy proposal is live", async function () {
    // The market's own Squads proposal takes index 1 and stays Active; the
    // approved payload is the separate transaction at index 2
    await this.initializeAndLaunchProposal({ dao, instructions: [] });
    await createApprovedPayload(this, 2n);

    const storedDao = await this.futarchy.getDao(dao);
    assert.exists(storedDao.amm.state.futarchy);

    await this.futarchy
      .adminEnqueueMultisigProposalCancellationIx({ dao, transactionIndex: 2n })
      .rpc();

    const [enqueuedCancellationPda] =
      getEnqueuedMultisigProposalCancellationAddr({
        dao,
        transactionIndex: 2n,
      });
    const enqueued =
      await this.futarchy.futarchy.account.enqueuedMultisigProposalCancellation.fetch(
        enqueuedCancellationPda,
      );
    assert.equal(enqueued.transactionIndex.toString(), "2");
  });
}
