import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddrsForTransactionIndex,
  getSpendingLimitAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import BN from "bn.js";
import {
  createLookupTableForTransaction,
  executeVaultTransaction,
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

// Pumps the pass market far enough above fail to clear any kind's threshold
// (including HostileLiquidate's +25%), runs out the proposal duration, and
// finalizes to Passed.
async function passProposal(
  context: TestContext,
  {
    dao,
    proposal,
    baseMint,
    quoteMint,
  }: {
    dao: PublicKey;
    proposal: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  },
) {
  const { question, baseVault, quoteVault } = context.futarchy.getProposalPdas(
    proposal,
    baseMint,
    quoteMint,
    dao,
  );

  // Splitting both sides also creates the trader's conditional token ATAs
  await context.conditionalVault
    .splitTokensIx(question, baseVault, baseMint, new BN(10 * 1_000_000), 2)
    .rpc();
  await context.conditionalVault
    .splitTokensIx(
      question,
      quoteVault,
      quoteMint,
      new BN(33_000 * 1_000_000),
      2,
    )
    .rpc();

  await context.futarchy
    .conditionalSwapIx({
      dao,
      baseMint,
      quoteMint,
      proposal,
      market: "pass",
      swapType: "buy",
      inputAmount: new BN(20_000 * 1_000_000),
      minOutputAmount: new BN(0),
    })
    .rpc();

  for (let i = 0; i < 100; i++) {
    await context.advanceBySeconds(20_000);

    await context.futarchy
      .conditionalSwapIx({
        dao,
        baseMint,
        quoteMint,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10),
        minOutputAmount: new BN(0),
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
      ])
      .rpc();
  }

  await context.futarchy.finalizeProposal(proposal);

  const storedProposal = await context.futarchy.getProposal(proposal);
  assert.exists(storedProposal.state.passed);
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

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: META,
        quoteMint: USDC,
        params: {
          secondsPerProposal: 60 * 60 * 24 * 3,
          twapStartDelaySeconds: 60 * 60 * 24,
          twapInitialObservation: THOUSAND_BUCK_PRICE,
          // 10% per update: TWAPs converge to actual prices fast enough that
          // a pumped pass market clears +25% even on a repeat run, where the
          // fail market starts at an already-appreciated spot price
          twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(10),
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

    const storedDao = await this.futarchy.getDao(dao);
    vault = storedDao.squadsMultisigVault;

    [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    // The sweep destination: the vault's ATAs
    await this.createTokenAccount(META, vault);
    await this.createTokenAccount(USDC, vault);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 META
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();
  });

  it("installs the liquidator, zeroes the record, and sweeps the treasury position", async function () {
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
    });

    // The expected sweep, computed from the live pre-execution reserves
    const preDao = await this.futarchy.getDao(dao);
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
    // instruction matches the deployed apply_liquidation
    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isTrue(storedDao.spendingLimitDirty);

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

  it("refuses a second passed liquidation after the first has executed", async function () {
    await provideTreasuryLiquidity(this, {
      dao,
      vault,
      baseMint: META,
      quoteMint: USDC,
    });

    const liquidatorA = Keypair.generate().publicKey;
    const liquidatorB = Keypair.generate().publicKey;

    const a = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: liquidatorA,
    });
    const b = await this.futarchy.initializeHostileLiquidateProposal({
      dao,
      liquidator: liquidatorB,
    });

    // Both markets run to Passed before either payload executes — possible
    // because the DAO only becomes liquidated at execution
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
    });

    await this.futarchy
      .launchProposalIx({
        proposal: b.proposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: b.squadsProposal,
      })
      .rpc();
    await passProposal(this, {
      dao,
      proposal: b.proposal,
      baseMint: META,
      quoteMint: USDC,
    });

    await executeVaultTransaction(this, dao, a.squadsTransaction);

    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidatorA));

    try {
      await executeVaultTransaction(this, dao, b.squadsTransaction);
      assert.fail("Should have failed with AlreadyLiquidated");
    } catch (e) {
      // The error surfaces through the Squads CPI: AlreadyLiquidated (0x17a3 = 6051)
      assert(
        e.toString().includes("AlreadyLiquidated") ||
          e.toString().includes("0x17a3"),
        `Expected AlreadyLiquidated error, got: ${e}`,
      );
    }

    // The first liquidator is not overwritten
    storedDao = await this.futarchy.getDao(dao);
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
    });

    const preDao = await this.futarchy.getDao(dao);
    const preSpot = preDao.amm.state.spot.spot;

    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isTrue(storedDao.spendingLimitDirty);

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

    await executeVaultTransaction(this, dao, squadsTransaction);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.equal((await this.getTokenBalance(META, vault)).toString(), "0");
    assert.equal((await this.getTokenBalance(USDC, vault)).toString(), "0");
  });

  it("reverts mid-market and lands with the packed finalize + execute + sync once that market finalizes", async function () {
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
    });

    // A proposal launched in the finalize→execute gap puts the pool
    // mid-market before anyone executes the liquidation payload
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
        proposal: gapProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: gapSquadsProposal,
      })
      .rpc();

    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have failed with PoolNotInSpotState");
    } catch (e) {
      // The error surfaces through the Squads CPI: PoolNotInSpotState (0x178a = 6026)
      assert(
        e.toString().includes("PoolNotInSpotState") ||
          e.toString().includes("0x178a"),
        `Expected PoolNotInSpotState error, got: ${e}`,
      );
    }

    // Nothing was lost: the approved Squads transaction stays retryable
    let storedDao = await this.futarchy.getDao(dao);
    assert.isNull(storedDao.liquidator);

    // Run out the gap market uncontested (one observation after the TWAP
    // start delay lets it finalize)
    await this.advanceBySeconds(60 * 60 * 24 + 60);
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000),
      })
      .rpc();
    await this.advanceBySeconds(864_000);

    // The same payload lands as one transaction: the gap market's
    // finalize_proposal + vault_transaction_execute + sync_spending_limit.
    const packIxs = [
      await this.futarchy
        .finalizeProposalIxV2({
          squadsProposal: gapSquadsProposal,
          dao,
          baseMint: META,
          quoteMint: USDC,
        })
        .instruction(),
      (
        await multisig.instructions.vaultTransactionExecute({
          connection: this.squadsConnection,
          multisigPda: multisig.getMultisigPda({ createKey: dao })[0],
          transactionIndex: 1n,
          member: PERMISSIONLESS_ACCOUNT.publicKey,
        })
      ).instruction,
      await this.futarchy.syncSpendingLimitIx({ dao }).instruction(),
    ];

    const lut = await createLookupTableForTransaction(
      new Transaction().add(...packIxs),
      this,
    );

    const packMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ...packIxs,
      ],
    }).compileToV0Message([lut]);
    const packTx = new VersionedTransaction(packMessage);
    packTx.sign([this.payer, PERMISSIONLESS_ACCOUNT]);
    await this.banksClient.processTransaction(packTx);

    const storedGap = await this.futarchy.getProposal(gapProposal);
    assert.exists(storedGap.state.failed);

    storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator));
    assert.isNull(storedDao.initialSpendingLimit);
    // The packed sync already projected the removal onto Squads
    assert.isFalse(storedDao.spendingLimitDirty);
    const [spendingLimit] = getSpendingLimitAddr({ dao });
    assert.isNull(await this.banksClient.getAccount(spendingLimit));

    const postPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(postPosition.liquidity.toString(), "0");
  });
}
