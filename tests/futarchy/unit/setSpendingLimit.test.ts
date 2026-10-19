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
  PriceMath,
} from "@metadaoproject/programs";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { TestContext } from "../../main.test.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

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

  await context.futarchy
    .adminEnqueueMultisigProposalApprovalIx({ dao, transactionIndex })
    .rpc();

  await context.futarchy
    .executeMultisigProposalApprovalIx({ dao, transactionIndex })
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

// A rejected set_spending_limit surfaces through the Squads execute CPI as a
// raw transaction error, so match on the error name or its hex code and then
// confirm the record and dirty flag were left untouched.
async function assertSetSpendingLimitRejected(
  context: TestContext,
  dao: PublicKey,
  config: { amountPerMonth: BN; members: PublicKey[] },
  errorName: string,
  errorHex: string,
) {
  await executeSetSpendingLimitViaVault(context, dao, config).then(
    () => assert.fail(`set_spending_limit should have thrown ${errorName}`),
    (e) =>
      assert(
        e.toString().includes(errorName) || e.toString().includes(errorHex),
        `Expected ${errorName} error, got: ${e}`,
      ),
  );

  const daoAccount = await context.futarchy.getDao(dao);
  assert.equal(
    daoAccount.initialSpendingLimit.amountPerMonth.toString(),
    "10000000000",
  );
  assert.isFalse(daoAccount.spendingLimitDirty);
}

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: ONE_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: ONE_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
            members: [this.payer.publicKey],
          },
          baseToStake: new BN(0),
          teamSponsoredPassThresholdBps: 300,
          teamAddress: this.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });
  });

  it("replaces the record with the declared config and sets the dirty flag", async function () {
    let daoAccount = await this.futarchy.getDao(dao);
    assert.isFalse(daoAccount.spendingLimitDirty);
    const seqNumBefore = daoAccount.seqNum;

    const newMembers = [
      Keypair.generate().publicKey,
      Keypair.generate().publicKey,
    ];

    await executeSetSpendingLimitViaVault(this, dao, {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: newMembers,
    });

    daoAccount = await this.futarchy.getDao(dao);
    assert.equal(
      daoAccount.initialSpendingLimit.amountPerMonth.toString(),
      "25000000000",
    );
    assert.deepEqual(
      daoAccount.initialSpendingLimit.members.map((m) => m.toBase58()),
      newMembers.map((m) => m.toBase58()),
    );
    assert.isTrue(daoAccount.spendingLimitDirty);
    assert.equal(daoAccount.seqNum.toString(), seqNumBefore.addn(1).toString());
  });

  it("deletes the record on a None config and sets the dirty flag", async function () {
    let daoAccount = await this.futarchy.getDao(dao);
    assert.isNotNull(daoAccount.initialSpendingLimit);
    assert.isFalse(daoAccount.spendingLimitDirty);

    await executeSetSpendingLimitViaVault(this, dao, null);

    daoAccount = await this.futarchy.getDao(dao);
    assert.isNull(daoAccount.initialSpendingLimit);
    assert.isTrue(daoAccount.spendingLimitDirty);
  });

  it("throws when the signer is not the multisig vault", async function () {
    const attacker = Keypair.generate();

    const callbacks = expectError(
      "ConstraintHasOne",
      "set_spending_limit should require the vault signature",
    );

    await this.futarchy.futarchy.methods
      .setSpendingLimit({ config: null })
      .accounts({
        dao,
        squadsMultisigVault: attacker.publicKey,
      })
      .signers([attacker])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("throws when the config has more than 10 members", async function () {
    const elevenMembers = Array.from(
      { length: 11 },
      () => Keypair.generate().publicKey,
    );

    await assertSetSpendingLimitRejected(
      this,
      dao,
      {
        amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
        members: elevenMembers,
      },
      "TooManySpendingLimitMembers",
      "0x17a3", // 6051
    );
  });

  it("throws when the config's monthly amount is zero", async function () {
    await assertSetSpendingLimitRejected(
      this,
      dao,
      {
        amountPerMonth: new BN(0),
        members: [Keypair.generate().publicKey],
      },
      "InvalidSpendingLimitAmount",
      "0x17b2", // 6066
    );
  });

  it("throws when the config has no members", async function () {
    await assertSetSpendingLimitRejected(
      this,
      dao,
      {
        amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
        members: [],
      },
      "EmptySpendingLimitMembers",
      "0x17b3", // 6067
    );
  });

  it("throws when the config has duplicate members", async function () {
    const member = Keypair.generate().publicKey;

    await assertSetSpendingLimitRejected(
      this,
      dao,
      {
        amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
        // Non-adjacent so the check must sort before comparing neighbours
        members: [member, Keypair.generate().publicKey, member],
      },
      "DuplicateSpendingLimitMember",
      "0x17b4", // 6068
    );
  });
}
