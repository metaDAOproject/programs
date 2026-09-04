import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  PERMISSIONLESS_ACCOUNT,
  getDaoAddr,
  getSpendingLimitAddr,
  PriceMath,
} from "@metadaoproject/programs";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { TestContext } from "../../main.test.js";

const { Period } = multisig.types;

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);
const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

async function initializeTestDao(
  context: TestContext,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  initialSpendingLimit: { amountPerMonth: BN; members: PublicKey[] } | null,
): Promise<PublicKey> {
  const nonce = new BN(Math.floor(Math.random() * 1000000));

  await context.futarchy
    .initializeDaoIx({
      baseMint,
      quoteMint,
      params: {
        secondsPerProposal: 60 * 60 * 24 * 3,
        twapStartDelaySeconds: 60 * 60 * 24,
        twapInitialObservation: ONE_BUCK_PRICE,
        twapMaxObservationChangePerUpdate: ONE_BUCK_PRICE.divn(100),
        minQuoteFutarchicLiquidity: new BN(10_000),
        minBaseFutarchicLiquidity: new BN(10_000),
        passThresholdBps: 300,
        nonce,
        initialSpendingLimit,
        baseToStake: new BN(0),
        teamSponsoredPassThresholdBps: 300,
        teamAddress: context.payer.publicKey,
      },
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .rpc();

  return getDaoAddr({ nonce, daoCreator: context.payer.publicKey })[0];
}

// The vault PDA can only sign via a Squads vault transaction execution, so the
// record is written by creating + approving + executing one containing a
// single set_spending_limit instruction.
async function executeSetSpendingLimitViaVault(
  context: TestContext,
  dao: PublicKey,
  config: { amountPerMonth: BN; members: PublicKey[] } | null,
) {
  const daoAccount = await context.futarchy.getDao(dao);
  const multisigPda = daoAccount.squadsMultisig;

  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    context.squadsConnection,
    multisigPda,
  );
  const transactionIndex =
    BigInt(multisigAccount.transactionIndex.toString()) + 1n;

  const setSpendingLimitIx = await context.futarchy
    .setSpendingLimitIx({ dao, config })
    .instruction();

  const { tx: createTx } = context.futarchy.squadsProposalCreateTx({
    dao,
    instructions: [setSpendingLimitIx],
    transactionIndex,
  });
  createTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  createTx.feePayer = context.payer.publicKey;
  createTx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
  await context.banksClient.processTransaction(createTx);

  const [squadsProposal] = multisig.getProposalPda({
    multisigPda,
    transactionIndex,
  });

  const [enqueuedApproval] = PublicKey.findProgramAddressSync(
    [
      SEED_ENQUEUED_APPROVAL,
      dao.toBuffer(),
      new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
    ],
    context.futarchy.futarchy.programId,
  );

  await context.futarchy.futarchy.methods
    .adminEnqueueMultisigProposalApproval({
      transactionIndex: new BN(transactionIndex.toString()),
    })
    .accounts({
      dao,
      admin: context.payer.publicKey,
      squadsMultisig: multisigPda,
      squadsMultisigProposal: squadsProposal,
      enqueuedApproval,
    })
    .rpc();

  await context.futarchy.futarchy.methods
    .executeMultisigProposalApproval()
    .accounts({
      dao,
      rentReceiver: context.payer.publicKey,
      squadsMultisig: multisigPda,
      squadsMultisigProposal: squadsProposal,
      enqueuedApproval,
      squadsMultisigProgram: multisig.PROGRAM_ID,
    })
    .rpc();

  // Execute as a top-level Squads instruction so the vault PDA signs the
  // inner set_spending_limit
  const executeIx = await multisig.instructions.vaultTransactionExecute({
    connection: context.squadsConnection,
    multisigPda,
    transactionIndex,
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  const executeTx = new Transaction().add(executeIx.instruction);
  executeTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  executeTx.feePayer = context.payer.publicKey;
  executeTx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
  await context.banksClient.processTransaction(executeTx);
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    dao = await initializeTestDao(this, META, USDC, {
      amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
      members: [this.payer.publicKey],
    });
  });

  it("throws SpendingLimitNotDirty when the flag is clear", async function () {
    const daoAccount = await this.futarchy.getDao(dao);
    assert.isFalse(daoAccount.spendingLimitDirty);

    const callbacks = expectError(
      "SpendingLimitNotDirty",
      "sync should refuse when the record has not changed",
    );

    await this.futarchy
      .syncSpendingLimitIx({ dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("removes and recreates the Squads limit to match the record", async function () {
    const newMembers = [
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
    ];

    await executeSetSpendingLimitViaVault(this, dao, {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: newMembers,
    });

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });

    // The record is written but not yet projected: Squads still holds the old limit
    let storedLimit = await multisig.accounts.SpendingLimit.fromAccountAddress(
      this.squadsConnection,
      spendingLimitPda,
    );
    assert.equal(storedLimit.amount.toString(), "10000000000");

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    storedLimit = await multisig.accounts.SpendingLimit.fromAccountAddress(
      this.squadsConnection,
      spendingLimitPda,
    );
    assert.ok(storedLimit.createKey.equals(dao));
    assert.equal(storedLimit.vaultIndex, 0);
    assert.ok(storedLimit.mint.equals(USDC));
    assert.equal(storedLimit.amount.toString(), "25000000000");
    assert.equal(storedLimit.remainingAmount.toString(), "25000000000");
    assert.equal(storedLimit.period, Period.Month);
    // Squads stores members sorted, so compare as sets
    assert.sameMembers(
      storedLimit.members.map((m) => m.toBase58()),
      newMembers.map((m) => m.toBase58()),
    );
    assert.equal(storedLimit.destinations.length, 0);

    const daoAccount = await this.futarchy.getDao(dao);
    assert.isFalse(daoAccount.spendingLimitDirty);

    // The flag is consumed: an immediate re-sync (a would-be monthly budget
    // refresh) refuses
    const callbacks = expectError(
      "SpendingLimitNotDirty",
      "re-sync should refuse once the flag is cleared",
    );

    await this.futarchy
      .syncSpendingLimitIx({ dao })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("removes the Squads limit without recreating when the record is None", async function () {
    await executeSetSpendingLimitViaVault(this, dao, null);

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    const limitAccountBefore =
      await this.banksClient.getAccount(spendingLimitPda);
    const freedRent = limitAccountBefore.lamports;

    const rentPayer = Keypair.generate();

    await this.futarchy
      .syncSpendingLimitIx({ dao, rentPayer: rentPayer.publicKey })
      .signers([rentPayer])
      .rpc();

    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    const rentPayerAccount = await this.banksClient.getAccount(
      rentPayer.publicKey,
    );
    assert.equal(rentPayerAccount.lamports.toString(), freedRent.toString());

    const daoAccount = await this.futarchy.getDao(dao);
    assert.isNull(daoAccount.initialSpendingLimit);
    assert.isFalse(daoAccount.spendingLimitDirty);
  });

  it("creates the Squads limit from scratch when none exists", async function () {
    const noLimitDao = await initializeTestDao(this, META, USDC, null);

    const [spendingLimitPda] = getSpendingLimitAddr({ dao: noLimitDao });
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    const members = [Keypair.generate().publicKey];
    await executeSetSpendingLimitViaVault(this, noLimitDao, {
      amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
      members,
    });

    await this.futarchy.syncSpendingLimitIx({ dao: noLimitDao }).rpc();

    const storedLimit =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        this.squadsConnection,
        spendingLimitPda,
      );
    assert.equal(storedLimit.amount.toString(), "1000000000");
    assert.equal(storedLimit.remainingAmount.toString(), "1000000000");
    assert.deepEqual(
      storedLimit.members.map((m) => m.toBase58()),
      members.map((m) => m.toBase58()),
    );

    const daoAccount = await this.futarchy.getDao(noLimitDao);
    assert.isFalse(daoAccount.spendingLimitDirty);
  });

  it("succeeds when both legs are no-ops", async function () {
    const noLimitDao = await initializeTestDao(this, META, USDC, null);

    await executeSetSpendingLimitViaVault(this, noLimitDao, null);

    let daoAccount = await this.futarchy.getDao(noLimitDao);
    assert.isTrue(daoAccount.spendingLimitDirty);

    await this.futarchy.syncSpendingLimitIx({ dao: noLimitDao }).rpc();

    const [spendingLimitPda] = getSpendingLimitAddr({ dao: noLimitDao });
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    daoAccount = await this.futarchy.getDao(noLimitDao);
    assert.isFalse(daoAccount.spendingLimitDirty);
  });
}
