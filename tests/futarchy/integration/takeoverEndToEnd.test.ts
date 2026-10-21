import {
  getDaoAddr,
  getSpendingLimitAddr,
  PriceMath,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { expectError, passProposal } from "../../utils.js";
import { TestContext } from "../../main.test.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

const OLD_LIMIT_PER_MONTH = new BN(10_000 * 1_000_000); // 10,000 USDC

type Regime = {
  META: PublicKey;
  USDC: PublicKey;
  dao: PublicKey;
  multisigPda: PublicKey;
  oldMember: Keypair;
  spendingLimitPda: PublicKey;
};

type SpendingLimitAction = Parameters<
  TestContext["futarchy"]["initializeHostileTakeoverProposal"]
>[0]["spendingLimitAction"];

// Declaration semantics through the whole chain: what the market approved
// lands on the DAO record the moment the takeover finalizes, and on the Squads
// projection at sync — and a regime change cuts off the old members' pull
// rights.
export default function suite() {
  // A DAO whose live spending limit lets the old member pull, proven by one pull
  async function setupRegime(ctx: TestContext): Promise<Regime> {
    const META = await ctx.createMint(ctx.payer.publicKey, 6);
    const USDC = await ctx.createMint(ctx.payer.publicKey, 6);

    await ctx.createTokenAccount(META, ctx.payer.publicKey);
    await ctx.createTokenAccount(USDC, ctx.payer.publicKey);

    await ctx.mintTo(META, ctx.payer.publicKey, ctx.payer, 2_000 * 1_000_000);
    await ctx.mintTo(USDC, ctx.payer.publicKey, ctx.payer, 500_000 * 1_000_000);

    const oldMember = Keypair.generate();
    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await ctx.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          nonce,
          initialSpendingLimit: {
            amountPerMonth: OLD_LIMIT_PER_MONTH,
            members: [oldMember.publicKey],
          },
          baseToStake: new BN(1_000 * 1_000_000), // 1,000 META
          teamSponsoredPassThresholdBps: 300,
          teamAddress: ctx.payer.publicKey,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const [dao] = getDaoAddr({ nonce, daoCreator: ctx.payer.publicKey });

    const storedDao = await ctx.futarchy.getDao(dao);
    const vault = storedDao.squadsMultisigVault;
    const multisigPda = storedDao.squadsMultisig;

    await ctx.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: ctx.payer.publicKey,
        liquidityProvider: ctx.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    await ctx.createTokenAccount(USDC, vault);
    await ctx.mintTo(USDC, vault, ctx.payer, 1_000 * 1_000_000);
    await ctx.createTokenAccount(USDC, oldMember.publicKey);

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    const regime = {
      META,
      USDC,
      dao,
      multisigPda,
      oldMember,
      spendingLimitPda,
    };

    await pullAsOldMember(ctx, regime, 100 * 1_000_000, 0);
    assert.equal(
      (await ctx.getTokenBalance(USDC, oldMember.publicKey)).toString(),
      (100 * 1_000_000).toString(),
    );

    return regime;
  }

  // The old member draws from the treasury through the live Squads limit. The
  // compute unit price makes each pull's transaction hash unique, so a repeat
  // pull isn't rejected as already processed.
  async function pullAsOldMember(
    ctx: TestContext,
    { USDC, multisigPda, oldMember, spendingLimitPda }: Regime,
    amount: number,
    computeUnitPrice: number,
  ) {
    const pullIx = multisig.instructions.spendingLimitUse({
      multisigPda,
      member: oldMember.publicKey,
      spendingLimit: spendingLimitPda,
      mint: USDC,
      vaultIndex: 0,
      amount,
      decimals: 6,
      destination: oldMember.publicKey,
    });
    const pullTx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice,
      }),
      pullIx,
    );
    pullTx.recentBlockhash = (await ctx.banksClient.getLatestBlockhash())[0];
    pullTx.feePayer = ctx.payer.publicKey;
    pullTx.sign(ctx.payer, oldMember);
    await ctx.banksClient.processTransaction(pullTx);
  }

  // Creates, stakes, launches and passes the takeover; the market runs out the
  // kind's 20-day snapshot and finalizes to Passed at +10%
  async function passTakeover(
    ctx: TestContext,
    { META, USDC, dao }: Regime,
    newTeamAddress: PublicKey,
    spendingLimitAction: SpendingLimitAction,
  ) {
    const { proposal, squadsProposal } =
      await ctx.futarchy.initializeHostileTakeoverProposal({
        dao,
        newTeamAddress,
        spendingLimitAction,
      });

    await ctx.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: new BN(1_000 * 1_000_000),
      })
      .rpc();

    await ctx.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(ctx, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 90,
    });
  }

  it("Set: the declared regime lands on the record at finalize and on Squads at sync", async function () {
    const regime = await setupRegime(this);
    const { dao, spendingLimitPda } = regime;

    const newTeamAddress = Keypair.generate().publicKey;
    const declaredConfig = {
      amountPerMonth: new BN(25_000_000_000), // 25,000 USDC
      members: [Keypair.generate().publicKey],
    };

    await passTakeover(this, regime, newTeamAddress, {
      set: { 0: declaredConfig },
    });

    // Finalize alone moved the team and wrote the declaration; Squads still
    // holds the old limit until the sync
    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.teamAddress.equals(newTeamAddress));
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.deepEqual(
      storedDao.initialSpendingLimit.members.map((m) => m.toBase58()),
      declaredConfig.members.map((m) => m.toBase58()),
    );
    assert.isTrue(storedDao.spendingLimitDirty);

    let storedLimit = await multisig.accounts.SpendingLimit.fromAccountAddress(
      this.squadsConnection,
      spendingLimitPda,
    );
    assert.equal(storedLimit.amount.toString(), OLD_LIMIT_PER_MONTH.toString());

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    storedDao = await this.futarchy.getDao(dao);
    assert.isFalse(storedDao.spendingLimitDirty);

    storedLimit = await multisig.accounts.SpendingLimit.fromAccountAddress(
      this.squadsConnection,
      spendingLimitPda,
    );
    assert.equal(
      storedLimit.amount.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.equal(
      storedLimit.remainingAmount.toString(),
      declaredConfig.amountPerMonth.toString(),
    );
    assert.sameMembers(
      storedLimit.members.map((m) => m.toBase58()),
      declaredConfig.members.map((m) => m.toBase58()),
    );

    // The old member's pull rights are gone — the takeover's economic point
    try {
      await pullAsOldMember(this, regime, 200 * 1_000_000, 1);
      assert.fail("Should have failed with Unauthorized");
    } catch (e) {
      // Squads' Unauthorized (0x1774 = 6004)
      assert(
        e.toString().includes("Unauthorized") ||
          e.toString().includes("0x1774"),
        `Expected Unauthorized error, got: ${e}`,
      );
    }
  });

  it("Remove: the record is cleared at finalize and the sync closes the live limit", async function () {
    const regime = await setupRegime(this);
    const { dao, spendingLimitPda } = regime;

    const newTeamAddress = Keypair.generate().publicKey;
    await passTakeover(this, regime, newTeamAddress, { remove: {} });

    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.teamAddress.equals(newTeamAddress));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isTrue(storedDao.spendingLimitDirty);

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    storedDao = await this.futarchy.getDao(dao);
    assert.isFalse(storedDao.spendingLimitDirty);
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));
  });

  it("Keep: the record, the flag and the live limit are untouched", async function () {
    const regime = await setupRegime(this);
    const { dao, USDC, oldMember } = regime;

    const newTeamAddress = Keypair.generate().publicKey;
    await passTakeover(this, regime, newTeamAddress, { keep: {} });

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.teamAddress.equals(newTeamAddress));
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      OLD_LIMIT_PER_MONTH.toString(),
    );
    assert.deepEqual(
      storedDao.initialSpendingLimit.members.map((m) => m.toBase58()),
      [oldMember.publicKey.toBase58()],
    );
    assert.isFalse(storedDao.spendingLimitDirty);

    const callbacks = expectError(
      "SpendingLimitNotDirty",
      "synced a limit the takeover kept",
    );
    await this.futarchy
      .syncSpendingLimitIx({ dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // The old member keeps pulling under the new team
    await pullAsOldMember(this, regime, 100 * 1_000_000, 1);
    assert.equal(
      (await this.getTokenBalance(USDC, oldMember.publicKey)).toString(),
      (200 * 1_000_000).toString(),
    );
  });
}
