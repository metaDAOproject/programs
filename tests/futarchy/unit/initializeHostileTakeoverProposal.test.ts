import { getDaoAddr, PriceMath } from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import BN from "bn.js";
import { assert } from "chai";
import { assertVaultTransactionPayload, expectError } from "../../utils.js";
import { setTypedProposalsEnabled } from "../utils.js";

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

  // The whole payload: one memo naming the proposal and the declared regime.
  // A passed takeover is applied by finalize, so nothing in it can execute.
  function expectedMemoIx(
    proposal: PublicKey,
    newTeamAddress: PublicKey,
    spendingLimit: string,
  ) {
    return new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [],
      data: Buffer.from(
        `metadao-takeover/1 proposal=${proposal.toBase58()} new_team=${newTeamAddress.toBase58()} spending_limit=${spendingLimit}`,
        "utf8",
      ),
    });
  }

  it("bakes exactly one program-built memo as the whole payload and snapshots the kind's params", async function () {
    const newTeamAddress = Keypair.generate().publicKey;

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { keep: {} },
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedMemoIx(proposal, newTeamAddress, "keep"),
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

  it("formats a Remove action into the memo", async function () {
    const newTeamAddress = Keypair.generate().publicKey;

    const { proposal, squadsTransaction } =
      await this.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction: { remove: {} },
      });

    await assertVaultTransactionPayload(this, dao, squadsTransaction, [
      expectedMemoIx(proposal, newTeamAddress, "remove"),
    ]);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(
      storedProposal.action.hostileTakeover.spendingLimitAction.remove,
    );
  });

  it("formats a Set action's monthly amount into the memo and stores the config verbatim", async function () {
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
      expectedMemoIx(proposal, newTeamAddress, "set:25000000000"),
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

  it("throws error when the DAO has typed proposals off", async function () {
    await setTypedProposalsEnabled(this, dao, false);

    const callbacks = expectError(
      "TypedProposalsDisabled",
      "created a hostile takeover proposal on a DAO with typed proposals off",
    );
    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: { keep: {} },
      })
      .then(...callbacks);
  });
}
