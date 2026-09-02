import {
  getDaoAddr,
  getSpendingLimitAddr,
  PriceMath,
} from "@metadaoproject/programs";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  assertVaultTransactionPayload,
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
} from "../../utils.js";

const ONE_BUCK_PRICE = PriceMath.getAmmPrice(1, 6, 6);

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

  it("bakes exactly one vault-signed set_spending_limit and snapshots the kind's params", async function () {
    const config = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [Keypair.generate().publicKey, Keypair.generate().publicKey],
    };

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config,
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      await this.futarchy.setSpendingLimitIx({ dao, config }).instruction(),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isNull(storedProposal.sponsoredBy);

    assert.equal(
      storedProposal.action.spendingLimitChange.config.amountPerMonth.toString(),
      config.amountPerMonth.toString(),
    );
    assert.deepEqual(
      storedProposal.action.spendingLimitChange.config.members.map((m) =>
        m.toBase58(),
      ),
      config.members.map((m) => m.toBase58()),
    );
    assert.equal(storedProposal.durationInSeconds, 432_000);
    assert.equal(storedProposal.passThresholdBps, 500);
    assert.isTrue(storedProposal.councilCanBlock);

    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.proposalCount, 1);
  });

  it("bakes a None config verbatim when removing the limit", async function () {
    const { proposal, squadsTransaction } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config: null,
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      await this.futarchy
        .setSpendingLimitIx({ dao, config: null })
        .instruction(),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.isNull(storedProposal.action.spendingLimitChange.config);
  });

  it("throws error when the config has more than 10 members", async function () {
    const elevenMembers = Array.from(
      { length: 11 },
      () => Keypair.generate().publicKey,
    );

    const callbacks = expectError(
      "TooManySpendingLimitMembers",
      "created a spending limit change proposal with more than 10 members",
    );
    await this.futarchy
      .initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
          members: elevenMembers,
        },
      })
      .then(...callbacks);
  });

  it("throws error when the config's monthly amount is zero", async function () {
    const callbacks = expectError(
      "InvalidSpendingLimitAmount",
      "created a spending limit change proposal with a zero monthly amount",
    );
    await this.futarchy
      .initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(0),
          members: [Keypair.generate().publicKey],
        },
      })
      .then(...callbacks);
  });

  it("throws error when the config has no members", async function () {
    const callbacks = expectError(
      "EmptySpendingLimitMembers",
      "created a spending limit change proposal with no members",
    );
    await this.futarchy
      .initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
          members: [],
        },
      })
      .then(...callbacks);
  });

  it("throws error when the config has duplicate members", async function () {
    const member = Keypair.generate().publicKey;

    const callbacks = expectError(
      "DuplicateSpendingLimitMember",
      "created a spending limit change proposal with duplicate members",
    );
    await this.futarchy
      .initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
          // Non-adjacent so the check must sort before comparing neighbours
          members: [member, Keypair.generate().publicKey, member],
        },
      })
      .then(...callbacks);
  });

  it("the executed and synced end state matches the declaration", async function () {
    const config = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [Keypair.generate().publicKey, Keypair.generate().publicKey],
    };

    const { squadsProposal, squadsTransaction } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config,
      });

    await forceApproveSquadsProposal(this, squadsProposal);
    await executeVaultTransaction(this, dao, squadsTransaction);

    let storedDao = await this.futarchy.getDao(dao);
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      config.amountPerMonth.toString(),
    );
    assert.deepEqual(
      storedDao.initialSpendingLimit.members.map((m) => m.toBase58()),
      config.members.map((m) => m.toBase58()),
    );
    assert.isTrue(storedDao.spendingLimitDirty);

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    const storedLimit =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        this.squadsConnection,
        spendingLimitPda,
      );
    assert.equal(
      storedLimit.amount.toString(),
      config.amountPerMonth.toString(),
    );
    assert.equal(
      storedLimit.remainingAmount.toString(),
      config.amountPerMonth.toString(),
    );
    // Squads stores members sorted, so compare as sets
    assert.sameMembers(
      storedLimit.members.map((m) => m.toBase58()),
      config.members.map((m) => m.toBase58()),
    );

    storedDao = await this.futarchy.getDao(dao);
    assert.isFalse(storedDao.spendingLimitDirty);
  });
}
