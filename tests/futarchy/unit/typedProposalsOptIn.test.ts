import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { expectError, setupBasicDao } from "../../utils.js";
import { setTypedProposalsEnabled } from "../utils.js";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// Every term differs from the catalog's 10 days, +10% and 1-day warm-up.
const SECONDS_PER_PROPOSAL = 60 * 60 * 24 * 2;
const TWAP_START_DELAY_SECONDS = 60 * 60 * 12;
const PASS_THRESHOLD_BPS = 300;
const TEAM_SPONSORED_PASS_THRESHOLD_BPS = -300;
const BASE_TO_STAKE = new BN(100_000_000); // 100 tokens

const CATALOG_DURATION_SECONDS = 60 * 60 * 24 * 10;
const CATALOG_PASS_THRESHOLD_BPS = 1000;
const CATALOG_TWAP_START_DELAY_SECONDS = 60 * 60 * 24;

const memoIx = new TransactionInstruction({
  programId: MEMO_PROGRAM_ID,
  keys: [],
  data: Buffer.from("arbitrary", "utf8"),
});

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      200_000 * 1_000_000,
    );

    dao = await setupBasicDao({
      context: this,
      baseMint: META,
      quoteMint: USDC,
      secondsPerProposal: SECONDS_PER_PROPOSAL,
      twapStartDelaySeconds: TWAP_START_DELAY_SECONDS,
      passThresholdBps: PASS_THRESHOLD_BPS,
      teamSponsoredPassThresholdBps: TEAM_SPONSORED_PASS_THRESHOLD_BPS,
      baseToStake: BASE_TO_STAKE,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100_000 * 1_000_000),
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    await setTypedProposalsEnabled(this, dao, false);
  });

  it("still creates a plain proposal while off", async function () {
    const { proposal } = await this.initializeProposal({
      dao,
      instructions: [memoIx],
    });

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.draft);
    assert.exists(storedProposal.action.executeArbitrary);
  });

  describe("preview", function () {
    it("a plain draft previews the DAO's own duration and threshold while off", async function () {
      const { proposal } = await this.initializeProposal({
        dao,
        instructions: [memoIx],
      });

      const storedProposal = await this.futarchy.getProposal(proposal);
      assert.equal(storedProposal.durationInSeconds, SECONDS_PER_PROPOSAL);
      assert.equal(storedProposal.passThresholdBps, PASS_THRESHOLD_BPS);
    });

    it("a plain draft previews the catalog's duration and threshold while on", async function () {
      await setTypedProposalsEnabled(this, dao, true);

      const { proposal } = await this.initializeProposal({
        dao,
        instructions: [memoIx],
      });

      const storedProposal = await this.futarchy.getProposal(proposal);
      assert.equal(storedProposal.durationInSeconds, CATALOG_DURATION_SECONDS);
      assert.equal(storedProposal.passThresholdBps, CATALOG_PASS_THRESHOLD_BPS);
    });
  });

  describe("admin tuning", function () {
    it("accepts a duration above the DAO's warm-up but below the catalog's while off", async function () {
      const { proposal } = await this.initializeProposal({
        dao,
        instructions: [memoIx],
      });

      const durationInSeconds =
        (TWAP_START_DELAY_SECONDS + CATALOG_TWAP_START_DELAY_SECONDS) / 2;
      await this.futarchy
        .adminUpdateProposalParamsIx({ proposal, dao, durationInSeconds })
        .rpc();

      const storedProposal = await this.futarchy.getProposal(proposal);
      assert.equal(storedProposal.durationInSeconds, durationInSeconds);
      assert.isTrue(storedProposal.paramsOverridden);
    });

    it("refuses a duration equal to the DAO's warm-up while off", async function () {
      const { proposal } = await this.initializeProposal({
        dao,
        instructions: [memoIx],
      });

      const callbacks = expectError(
        "ProposalDurationTooShort",
        "tuned a duration equal to the DAO's warm-up",
      );
      await this.futarchy
        .adminUpdateProposalParamsIx({
          proposal,
          dao,
          durationInSeconds: TWAP_START_DELAY_SECONDS,
        })
        .rpc()
        .then(...callbacks);

      const storedProposal = await this.futarchy.getProposal(proposal);
      assert.equal(storedProposal.durationInSeconds, SECONDS_PER_PROPOSAL);
      assert.isFalse(storedProposal.paramsOverridden);
    });
  });

  it("refuses to launch a typed draft after the switch is flipped off underneath it", async function () {
    await setTypedProposalsEnabled(this, dao, true);

    const { proposal, squadsProposal } =
      await this.futarchy.initializeSpendingLimitChangeProposal({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000), // 1,000 USDC
          members: [Keypair.generate().publicKey],
        },
      });
    await this.futarchy.sponsorProposalIx({ proposal, dao }).rpc();

    await setTypedProposalsEnabled(this, dao, false);

    const callbacks = expectError(
      "TypedProposalsDisabled",
      "launched a typed draft on a DAO with typed proposals off",
    );
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc()
      .then(...callbacks);

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.draft);
  });
}
