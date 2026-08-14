import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddrsForTransactionIndex,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import BN from "bn.js";
import {
  executeVaultTransaction,
  expectError,
  passProposal,
} from "../../utils.js";
import { TestContext } from "../../main.test.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

// The treasury's own LP position: the Squads vault is the position authority
async function provideTreasuryLiquidity(
  context: TestContext,
  {
    dao,
    vault,
    baseMint,
    quoteMint,
  }: {
    dao: PublicKey;
    vault: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  },
) {
  await context.futarchy
    .provideLiquidityIx({
      dao,
      baseMint,
      quoteMint,
      quoteAmount: new BN(25_000 * 1_000_000), // 25,000 USDC
      maxBaseAmount: new BN(25 * 1_000_000), // 25 META
      minLiquidity: new BN(1),
      positionAuthority: vault,
      liquidityProvider: context.payer.publicKey,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .rpc();
}

// A liquidatable DAO: initialized with the given spending-limit config, the
// vault's sweep-destination ATAs created, and payer-owned spot liquidity
async function initializeLiquidationDao(
  context: TestContext,
  {
    baseMint,
    quoteMint,
    initialSpendingLimit,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    initialSpendingLimit: {
      amountPerMonth: BN;
      members: PublicKey[];
    } | null;
  },
) {
  const nonce = new BN(Math.floor(Math.random() * 1000000));

  await context.futarchy
    .initializeDaoIx({
      baseMint,
      quoteMint,
      params: {
        secondsPerProposal: 60 * 60 * 24 * 3,
        twapStartDelaySeconds: 60 * 60 * 24,
        twapInitialObservation: THOUSAND_BUCK_PRICE,
        twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(10),
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

  const [dao] = getDaoAddr({ nonce, daoCreator: context.payer.publicKey });

  const storedDao = await context.futarchy.getDao(dao);
  const vault: PublicKey = storedDao.squadsMultisigVault;

  const [ammPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
    FUTARCHY_V0_6_PROGRAM_ID,
  );

  // The sweep destination: the vault's ATAs
  await context.createTokenAccount(baseMint, vault);
  await context.createTokenAccount(quoteMint, vault);

  await context.futarchy
    .provideLiquidityIx({
      dao,
      baseMint,
      quoteMint,
      quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
      maxBaseAmount: new BN(100 * 1_000_000), // 100 META
      minLiquidity: new BN(0),
      positionAuthority: context.payer.publicKey,
      liquidityProvider: context.payer.publicKey,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .rpc();

  return { dao, vault, ammPosition };
}

export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    vault: PublicKey,
    ammPosition: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);

    await this.mintTo(
      META,
      this.payer.publicKey,
      this.payer,
      1_000 * 1_000_000,
    );
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      500_000 * 1_000_000,
    );

    ({ dao, vault, ammPosition } = await initializeLiquidationDao(this, {
      baseMint: META,
      quoteMint: USDC,
      initialSpendingLimit: {
        amountPerMonth: new BN(10_000_000_000), // 10,000 USDC
        members: [this.payer.publicKey],
      },
    }));
  });

  it("refuses the sweep until the limit is synced, then sweeps the treasury position", async function () {
    await provideTreasuryLiquidity(this, {
      dao,
      vault,
      baseMint: META,
      quoteMint: USDC,
    });

    const liquidator = Keypair.generate().publicKey;
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // finalize installed the liquidator and zeroed the record; the payload
    // owes only the sweep
    const preDao = await this.futarchy.getDao(dao);
    assert.ok(preDao.liquidator.equals(liquidator));
    assert.isNull(preDao.initialSpendingLimit);
    assert.isTrue(preDao.spendingLimitDirty);

    // While the Squads-side limit is still live, the sweep refuses — otherwise
    // a limit member could spend the swept estate out of the vault in the same
    // transaction as the execution
    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have failed with SpendingLimitNotSynced");
    } catch (e) {
      // The error surfaces through the Squads CPI: SpendingLimitNotSynced (0x17b1 = 6065)
      assert(
        e.toString().includes("SpendingLimitNotSynced") ||
          e.toString().includes("0x17b1"),
        `Expected SpendingLimitNotSynced error, got: ${e}`,
      );
    }

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    // The expected sweep, computed from the live pre-execution reserves
    const preSpot = preDao.amm.state.spot.spot;
    const prePosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    const expectedBase = prePosition.liquidity
      .mul(preSpot.baseReserves)
      .div(preDao.amm.totalLiquidity);
    const expectedQuote = prePosition.liquidity
      .mul(preSpot.quoteReserves)
      .div(preDao.amm.totalLiquidity);
    const preVaultBase = await this.getTokenBalance(META, vault);
    const preVaultQuote = await this.getTokenBalance(USDC, vault);

    // Executing the baked payload is the byte-level proof that the baked
    // instruction matches the deployed apply_liquidation. The
    // compute-unit-price instruction makes this transaction's hash differ from
    // the refused attempt's, preventing duplicate-processing errors.
    await executeVaultTransaction(this, dao, squadsTransaction, [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    ]);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);

    const postPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(postPosition.liquidity.toString(), "0");

    const postVaultBase = await this.getTokenBalance(META, vault);
    const postVaultQuote = await this.getTokenBalance(USDC, vault);
    assert.equal(
      (postVaultBase - preVaultBase).toString(),
      expectedBase.toString(),
    );
    assert.equal(
      (postVaultQuote - preVaultQuote).toString(),
      expectedQuote.toString(),
    );

    const postSpot = storedDao.amm.state.spot.spot;
    assert.equal(
      postSpot.baseReserves.toString(),
      preSpot.baseReserves.sub(expectedBase).toString(),
    );
    assert.equal(
      postSpot.quoteReserves.toString(),
      preSpot.quoteReserves.sub(expectedQuote).toString(),
    );
    assert.equal(
      storedDao.amm.totalLiquidity.toString(),
      preDao.amm.totalLiquidity.sub(prePosition.liquidity).toString(),
    );
  });

  it("refuses an execute_arbitrary proposal whose payload calls apply_liquidation", async function () {
    // An arbitrary proposal carrying apply_liquidation would reach
    // liquidation at ExecuteArbitrary's terms (10 days, +10%, blockable);
    // the kind check is what closes that hole
    const { squadsProposal, squadsTransaction, proposal } =
      getProposalAddrsForTransactionIndex({ dao, transactionIndex: 1n });

    const [eventAuthority] = getEventAuthorityAddr(FUTARCHY_V0_6_PROGRAM_ID);
    const applyLiquidationIx = await this.futarchy.futarchy.methods
      .applyLiquidation()
      .accounts({
        proposal,
        dao,
        squadsMultisigVault: vault,
        ammPosition,
        ammBaseVault: getAssociatedTokenAddressSync(META, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, dao, true),
        vaultBaseAccount: getAssociatedTokenAddressSync(META, vault, true),
        vaultQuoteAccount: getAssociatedTokenAddressSync(USDC, vault, true),
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      })
      .instruction();

    const { tx: createTx } = this.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [applyLiquidationIx],
      transactionIndex: 1n,
    });
    createTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    createTx.feePayer = this.payer.publicKey;
    createTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(createTx);

    await this.futarchy.initializeProposal(dao, squadsProposal);

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have failed with InvalidProposalKind");
    } catch (e) {
      // The error surfaces through the Squads CPI: InvalidProposalKind (0x17a2 = 6050)
      assert(
        e.toString().includes("InvalidProposalKind") ||
          e.toString().includes("0x17a2"),
        `Expected InvalidProposalKind error, got: ${e}`,
      );
    }

    const storedDao = await this.futarchy.getDao(dao);
    assert.isNull(storedDao.liquidator);
  });

  it("refuses to launch a second liquidation once the first has passed", async function () {
    await provideTreasuryLiquidity(this, {
      dao,
      vault,
      baseMint: META,
      quoteMint: USDC,
    });

    const liquidatorA = Keypair.generate().publicKey;
    const liquidatorB = Keypair.generate().publicKey;

    // Both drafts exist before either market runs
    const a = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: liquidatorA,
    });
    const b = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: liquidatorB,
    });

    await this.futarchy
      .launchProposalIx({
        proposal: a.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: a.squadsProposal,
      })
      .rpc();
    await passProposal(this, {
      dao,
      proposal: a.proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // finalize wrote liquidatorA, so the pre-created second draft can never
    // reach Passed — only one liquidation record can ever hold the DAO
    const callbacks = expectError(
      "DaoLiquidated",
      "launched a liquidation after another had already passed",
    );
    await this.futarchy
      .launchProposalIx({
        proposal: b.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: b.squadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();
    await executeVaultTransaction(this, dao, a.squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidatorA));
  });

  it("succeeds when the treasury position doesn't exist", async function () {
    const liquidator = Keypair.generate().publicKey;
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    const preDao = await this.futarchy.getDao(dao);
    const preSpot = preDao.amm.state.spot.spot;

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();
    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);

    // Nothing to sweep, nothing swept
    assert.equal((await this.getTokenBalance(META, vault)).toString(), "0");
    assert.equal((await this.getTokenBalance(USDC, vault)).toString(), "0");
    const postSpot = storedDao.amm.state.spot.spot;
    assert.equal(
      postSpot.baseReserves.toString(),
      preSpot.baseReserves.toString(),
    );
    assert.equal(
      postSpot.quoteReserves.toString(),
      preSpot.quoteReserves.toString(),
    );
    assert.equal(
      storedDao.amm.totalLiquidity.toString(),
      preDao.amm.totalLiquidity.toString(),
    );
  });

  it("succeeds when the treasury position exists with zero liquidity", async function () {
    const liquidator = Keypair.generate().publicKey;
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // Manufacture an existing-but-empty position at the treasury's PDA
    const positionData = await this.futarchy.futarchy.coder.accounts.encode(
      "ammPosition",
      {
        dao,
        positionAuthority: vault,
        liquidity: new BN(0),
      },
    );
    this.context.setAccount(ammPosition, {
      lamports: 10_000_000,
      data: positionData,
      owner: FUTARCHY_V0_6_PROGRAM_ID,
      executable: false,
    });

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();
    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.equal((await this.getTokenBalance(META, vault)).toString(), "0");
    assert.equal((await this.getTokenBalance(USDC, vault)).toString(), "0");
  });

  it("reserves the DAO at finalize, so a pre-staged draft can't launch in the finalize→execute gap", async function () {
    await provideTreasuryLiquidity(this, {
      dao,
      vault,
      baseMint: META,
      quoteMint: USDC,
    });

    const liquidator = Keypair.generate().publicKey;
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator,
      });

    // The blocker draft is staged while the DAO is still healthy, ready to
    // launch the moment the liquidation market ends
    const { tx: gapCreateTx, squadsProposal: gapSquadsProposal } =
      this.futarchy.squadsProposalCreateTx({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("gap proposal"),
          },
        ],
        transactionIndex: 2n,
      });
    gapCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    gapCreateTx.feePayer = this.payer.publicKey;
    gapCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(gapCreateTx);

    const gapProposal = await this.futarchy.initializeProposal(
      dao,
      gapSquadsProposal,
    );

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // The liquidator is written by finalize itself, before any payload runs
    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));

    // So the staged blocker can no longer flip the pool out of Spot and make
    // the approved payload revert
    const callbacks = expectError(
      "DaoLiquidated",
      "launched a blocker in the finalize→execute gap",
    );
    await this.futarchy
      .launchProposalIx({
        proposal: gapProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: gapSquadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();
    await executeVaultTransaction(this, dao, squadsTransaction);

    storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);

    const postPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(postPosition.liquidity.toString(), "0");
  });

  it("liquidates without a sync when the DAO never had a spending limit", async function () {
    const noLimit = await initializeLiquidationDao(this, {
      baseMint: META,
      quoteMint: USDC,
      initialSpendingLimit: null,
    });

    const liquidator = Keypair.generate().publicKey;
    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao: noLimit.dao,
        liquidator,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao: noLimit.dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao: noLimit.dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
      cranks: 50,
    });

    // A clean None record means no live limit exists, so finalize leaves the
    // flag clear and the payload executes with no sync required
    const preDao = await this.futarchy.getDao(noLimit.dao);
    assert.isNull(preDao.initialSpendingLimit);
    assert.isFalse(preDao.spendingLimitDirty);

    await executeVaultTransaction(this, noLimit.dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(noLimit.dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);
  });
}
