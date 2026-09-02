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
import { TestContext } from "../../main.test.js";

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

  // update_dao re-pointing the team and changing nothing else
  function expectedUpdateDaoIx(
    context: TestContext,
    newTeamAddress: PublicKey,
  ) {
    return context.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: null,
          secondsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          twapStartDelaySeconds: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          baseToStake: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: newTeamAddress,
          isOptimisticGovernanceEnabled: null,
        },
      })
      .instruction();
  }

  it("bakes only a vault-signed update_dao when keeping the limit and snapshots the kind's params", async function () {
    const newTeamAddress = Keypair.generate().publicKey;

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { keep: {} },
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      await expectedUpdateDaoIx(this, newTeamAddress),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.equal(storedProposal.number, 1);
    assert.ok(storedProposal.dao.equals(dao));
    assert.ok(storedProposal.proposer.equals(this.payer.publicKey));
    assert.ok(storedProposal.squadsProposal.equals(squadsProposal));
    assert.exists(storedProposal.state.draft);
    assert.isNull(storedProposal.sponsoredBy);

    assert.ok(
      storedProposal.action.hostileTakeover.newTeamAddress.equals(
        newTeamAddress,
      ),
    );
    assert.exists(
      storedProposal.action.hostileTakeover.spendingLimitAction.keep,
    );

    // 20 days, +10%, blockable
    assert.equal(storedProposal.durationInSeconds, 1_728_000);
    assert.equal(storedProposal.passThresholdBps, 1000);
    assert.isTrue(storedProposal.councilCanBlock);

    const storedDao = await this.futarchy.getDao(dao);
    assert.equal(storedDao.proposalCount, 1);
  });

  it("appends a set_spending_limit with a None config when removing the limit", async function () {
    const newTeamAddress = Keypair.generate().publicKey;

    const { proposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { remove: {} },
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      await expectedUpdateDaoIx(this, newTeamAddress),
      await this.futarchy
        .setSpendingLimitIx({ dao, config: null })
        .instruction(),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(
      storedProposal.action.hostileTakeover.spendingLimitAction.remove,
    );
  });

  it("appends a set_spending_limit carrying the declared config verbatim when setting the limit", async function () {
    const newTeamAddress = Keypair.generate().publicKey;
    const config = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [Keypair.generate().publicKey, Keypair.generate().publicKey],
    };

    const { proposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { set: { 0: config } },
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      await expectedUpdateDaoIx(this, newTeamAddress),
      await this.futarchy.setSpendingLimitIx({ dao, config }).instruction(),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    const storedAction = storedProposal.action.hostileTakeover;
    assert.ok(storedAction.newTeamAddress.equals(newTeamAddress));
    assert.equal(
      storedAction.spendingLimitAction.set[0].amountPerMonth.toString(),
      config.amountPerMonth.toString(),
    );
    assert.deepEqual(
      storedAction.spendingLimitAction.set[0].members.map((m) => m.toBase58()),
      config.members.map((m) => m.toBase58()),
    );
  });

  it("the executed and synced end state matches the declaration", async function () {
    const newTeamAddress = Keypair.generate().publicKey;
    const config = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [Keypair.generate().publicKey, Keypair.generate().publicKey],
    };

    const { squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { set: { 0: config } },
      });

    await forceApproveSquadsProposal(this, squadsProposal);
    await executeVaultTransaction(this, dao, squadsTransaction);

    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.teamAddress.equals(newTeamAddress));
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

  it("throws error when a Set action has more than 10 members", async function () {
    const elevenMembers = Array.from(
      { length: 11 },
      () => Keypair.generate().publicKey,
    );

    const callbacks = expectError(
      "TooManySpendingLimitMembers",
      "created a hostile takeover proposal with more than 10 members",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: {
          set: {
            0: {
              amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
              members: elevenMembers,
            },
          },
        },
      })
      .then(...callbacks);
  });

  it("throws error when a Set action's monthly amount is zero", async function () {
    const callbacks = expectError(
      "InvalidSpendingLimitAmount",
      "created a hostile takeover proposal with a zero monthly amount",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: {
          set: {
            0: {
              amountPerMonth: new BN(0),
              members: [Keypair.generate().publicKey],
            },
          },
        },
      })
      .then(...callbacks);
  });

  it("throws error when a Set action has no members", async function () {
    const callbacks = expectError(
      "EmptySpendingLimitMembers",
      "created a hostile takeover proposal with no members",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: {
          set: {
            0: {
              amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
              members: [],
            },
          },
        },
      })
      .then(...callbacks);
  });

  it("throws error when a Set action has duplicate members", async function () {
    const member = Keypair.generate().publicKey;

    const callbacks = expectError(
      "DuplicateSpendingLimitMember",
      "created a hostile takeover proposal with duplicate members",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: {
          set: {
            0: {
              amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
              // Non-adjacent so the check must sort before comparing neighbours
              members: [member, Keypair.generate().publicKey, member],
            },
          },
        },
      })
      .then(...callbacks);
  });

  it("throws error when the new team address is the current team", async function () {
    const callbacks = expectError(
      "InvalidTeamAddress",
      "created a hostile takeover proposal targeting the current team",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: this.payer.publicKey,
        spendingLimitAction: { keep: {} },
      })
      .then(...callbacks);
  });
}
