import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  METADAO_MULTISIG_VAULT,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddrsForTransactionIndex,
  getSpendingLimitAddr,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/programs";
import BN from "bn.js";
import {
  executeVaultTransaction,
  expectError,
  forceApproveSquadsProposal,
  passProposal,
  THOUSAND_BUCK_PRICE,
} from "../../utils.js";
import { TestContext } from "../../main.test.js";

// Every blocked instruction refuses on a liquidated DAO; every allowed one
// still works. Not covered here because a liquidated DAO can't reach them:
// - finalize_proposal: the liquidator is written by finalize itself, while no
//   other market can be live, and launch refuses from then on — so a
//   liquidated DAO never has a market left to finalize (the
//   finalize → sync → unwind flow is pinned by liquidationEndToEnd.test.ts)
// - the liquidator path: liquidatorPath.test.ts runs the estate cycle
// - collect_meteora_damm_fees: reads no liquidation state (its own suite
//   covers the mechanics; setup needs a full launchpad DAMM pool)
export default function suite() {
  let META: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    draftProposal: PublicKey,
    draftSquadsProposal: PublicKey,
    liquidationProposal: PublicKey;

  // A single liquidated DAO serves every case: blocked instructions are pure
  // refusals, and the allowed ones each touch disjoint state (the sync flag,
  // the LP position, the stake, the fee balances), so one `before` avoids
  // re-running the whole market flow per test.
  before(async function () {
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
          // 10% per update: TWAPs converge fast enough that the pumped pass
          // market clears HostileLiquidate's +25%
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

    // Destination ATAs for the post-liquidation collect_fees case
    await this.createTokenAccount(META, METADAO_MULTISIG_VAULT);
    await this.createTokenAccount(USDC, METADAO_MULTISIG_VAULT);

    // The third-party LP position that must stay withdrawable
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

    // Accrue protocol fees for the post-liquidation collect_fees case
    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000 * 1_000_000),
      })
      .rpc();

    // A pre-liquidation draft with stake: staking more must refuse afterward,
    // unstaking must still work
    ({ squadsProposal: draftSquadsProposal } = await createSquadsVaultTx(this, [
      {
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from("draft proposal"),
      },
    ]));
    draftProposal = await this.futarchy.initializeProposal(
      dao,
      draftSquadsProposal,
    );

    await this.futarchy
      .stakeToProposalIx({
        proposal: draftProposal,
        dao,
        baseMint: META,
        amount: new BN(100 * 1_000_000),
      })
      .rpc();

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator: Keypair.generate().publicKey,
      });
    liquidationProposal = proposal;

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

    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();
    await executeVaultTransaction(this, dao, squadsTransaction);

    const liquidatedDao = await this.futarchy.getDao(dao);
    assert.isNotNull(liquidatedDao.liquidator);
  });

  // Creates (but never executes) a Squads vault transaction + proposal at the
  // live next transaction index, so each caller gets fresh PDAs.
  const createSquadsVaultTx = async function (
    context: TestContext,
    instructions: any[],
    targetDao: PublicKey = dao,
  ) {
    const multisigPda = multisig.getMultisigPda({ createKey: targetDao })[0];
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
      context.squadsConnection,
      multisigPda,
    );
    const transactionIndex =
      BigInt(multisigAccount.transactionIndex.toString()) + 1n;

    const { tx } = context.futarchy.squadsProposalCreateTx({
      dao: targetDao,
      instructions,
      transactionIndex,
    });
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer, PERMISSIONLESS_ACCOUNT);
    await context.banksClient.processTransaction(tx);

    return getProposalAddrsForTransactionIndex({
      dao: targetDao,
      transactionIndex,
    });
  };

  it("refuses initialize_proposal", async function () {
    const { squadsProposal } = await createSquadsVaultTx(this, [
      {
        programId: MEMO_PROGRAM_ID,
        keys: [],
        data: Buffer.from("post-liquidation proposal"),
      },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeProposal(dao, squadsProposal)
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses initialize_large_spend_proposal", async function () {
    // Each failed typed create leaves its question + vaults behind at the
    // unchanged next transaction index, so bump the index first to give every
    // attempt fresh PDAs
    await createSquadsVaultTx(this, [
      { programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from("bump") },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_large_spend_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeLargeSpendProposal({
        dao,
        amount: new BN(1_000 * 1_000_000),
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses initialize_mint_tokens_proposal", async function () {
    await createSquadsVaultTx(this, [
      { programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from("bump") },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_mint_tokens_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeMintTokensProposal({
        dao,
        amount: new BN(100 * 1_000_000),
        recipient: this.payer.publicKey,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses initialize_spending_limit_change_proposal", async function () {
    await createSquadsVaultTx(this, [
      { programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from("bump") },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_spending_limit_change_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeSpendingLimitChangeProposal({
        dao,
        config: null,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses initialize_hostile_takeover_proposal", async function () {
    await createSquadsVaultTx(this, [
      { programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from("bump") },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_hostile_takeover_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeHostileTakeoverProposal({
        dao,
        newTeamAddress: Keypair.generate().publicKey,
        spendingLimitAction: { keep: {} },
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses initialize_hostile_liquidate_proposal", async function () {
    await createSquadsVaultTx(this, [
      { programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from("bump") },
    ]);

    const callbacks = expectError(
      "DaoLiquidated",
      "initialize_hostile_liquidate_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .initializeHostileLiquidateProposal({
        dao,
        liquidator: Keypair.generate().publicKey,
      })
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses stake_to_proposal", async function () {
    const callbacks = expectError(
      "DaoLiquidated",
      "stake_to_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .stakeToProposalIx({
        proposal: draftProposal,
        dao,
        baseMint: META,
        amount: new BN(10 * 1_000_000),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses launch_proposal", async function () {
    const callbacks = expectError(
      "DaoLiquidated",
      "launch_proposal should refuse on a liquidated DAO",
    );

    await this.futarchy
      .launchProposalIx({
        proposal: draftProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
        squadsProposal: draftSquadsProposal,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses spot_swap", async function () {
    const callbacks = expectError(
      "DaoLiquidated",
      "spot_swap should refuse on a liquidated DAO",
    );

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(1_000_000),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses conditional_swap", async function () {
    const callbacks = expectError(
      "DaoLiquidated",
      "conditional_swap should refuse on a liquidated DAO",
    );

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal: liquidationProposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(1_000_000),
        minOutputAmount: new BN(0),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses provide_liquidity", async function () {
    const callbacks = expectError(
      "DaoLiquidated",
      "provide_liquidity should refuse on a liquidated DAO",
    );

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(1_000 * 1_000_000),
        maxBaseAmount: new BN(2 * 1_000_000),
        minLiquidity: new BN(1),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("refuses update_dao", async function () {
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          twapStartDelaySeconds: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          baseToStake: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          isOptimisticGovernanceEnabled: null,
        },
      })
      .instruction();

    const { squadsProposal, squadsTransaction } = await createSquadsVaultTx(
      this,
      [updateDaoIx],
    );
    await forceApproveSquadsProposal(this, squadsProposal);

    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have failed with DaoLiquidated");
    } catch (e) {
      // The error surfaces through the Squads CPI: DaoLiquidated (0x179b = 6043)
      assert(
        e.toString().includes("DaoLiquidated") ||
          e.toString().includes("0x179b"),
        `Expected DaoLiquidated error, got: ${e}`,
      );
    }
  });

  it("refuses set_spending_limit", async function () {
    const setSpendingLimitIx = await this.futarchy
      .setSpendingLimitIx({
        dao,
        config: {
          amountPerMonth: new BN(1_000_000_000),
          members: [this.payer.publicKey],
        },
      })
      .instruction();

    const { squadsProposal, squadsTransaction } = await createSquadsVaultTx(
      this,
      [setSpendingLimitIx],
    );
    await forceApproveSquadsProposal(this, squadsProposal);

    try {
      await executeVaultTransaction(this, dao, squadsTransaction);
      assert.fail("Should have failed with DaoLiquidated");
    } catch (e) {
      // The error surfaces through the Squads CPI: DaoLiquidated (0x179b = 6043)
      assert(
        e.toString().includes("DaoLiquidated") ||
          e.toString().includes("0x179b"),
        `Expected DaoLiquidated error, got: ${e}`,
      );
    }
  });

  it("holds no live spending limit: the pre-sweep sync removed it, and a re-sync refuses", async function () {
    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    const storedDao = await this.futarchy.getDao(dao);
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);

    const callbacks = expectError(
      "SpendingLimitNotDirty",
      "re-sync should refuse once the flag is consumed",
    );

    await this.futarchy
      .syncSpendingLimitIx({ dao })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("allows withdraw_liquidity", async function () {
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);

    const preBase = await this.getTokenBalance(META, this.payer.publicKey);
    const preQuote = await this.getTokenBalance(USDC, this.payer.publicKey);

    const [eventAuthority] = getEventAuthorityAddr(FUTARCHY_V0_6_PROGRAM_ID);
    await this.futarchy.futarchy.methods
      .withdrawLiquidity({
        liquidityToWithdraw: position.liquidity,
        minBaseAmount: new BN(0),
        minQuoteAmount: new BN(0),
      })
      .accounts({
        dao,
        positionAuthority: this.payer.publicKey,
        liquidityProviderBaseAccount: getAssociatedTokenAddressSync(
          META,
          this.payer.publicKey,
          true,
        ),
        liquidityProviderQuoteAccount: getAssociatedTokenAddressSync(
          USDC,
          this.payer.publicKey,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(META, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, dao, true),
        ammPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      })
      .rpc();

    assert.isTrue(
      (await this.getTokenBalance(META, this.payer.publicKey)) > preBase,
    );
    assert.isTrue(
      (await this.getTokenBalance(USDC, this.payer.publicKey)) > preQuote,
    );

    const postPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(postPosition.liquidity.toString(), "0");
  });

  it("allows unstake_from_proposal", async function () {
    const preBalance = await this.getTokenBalance(META, this.payer.publicKey);

    await this.futarchy
      .unstakeFromProposalIx({
        proposal: draftProposal,
        dao,
        baseMint: META,
        amount: new BN(100 * 1_000_000),
      })
      .rpc();

    const postBalance = await this.getTokenBalance(META, this.payer.publicKey);
    assert.equal((postBalance - preBalance).toString(), "100000000");
  });

  it("allows collect_fees", async function () {
    const preDao = await this.futarchy.getDao(dao);
    const baseFees = preDao.amm.state.spot.spot.baseProtocolFeeBalance;
    const quoteFees = preDao.amm.state.spot.spot.quoteProtocolFeeBalance;
    assert.isTrue(quoteFees.gtn(0));

    const preBase = await this.getTokenBalance(META, METADAO_MULTISIG_VAULT);
    const preQuote = await this.getTokenBalance(USDC, METADAO_MULTISIG_VAULT);

    await this.futarchy
      .collectFeesIx({ dao, baseMint: META, quoteMint: USDC })
      .rpc();

    const postBase = await this.getTokenBalance(META, METADAO_MULTISIG_VAULT);
    const postQuote = await this.getTokenBalance(USDC, METADAO_MULTISIG_VAULT);
    assert.equal((postBase - preBase).toString(), baseFees.toString());
    assert.equal((postQuote - preQuote).toString(), quoteFees.toString());

    const postDao = await this.futarchy.getDao(dao);
    assert.equal(
      postDao.amm.state.spot.spot.baseProtocolFeeBalance.toString(),
      "0",
    );
    assert.equal(
      postDao.amm.state.spot.spot.quoteProtocolFeeBalance.toString(),
      "0",
    );
  });

  // dao.liquidator is written by finalize itself, so the DAO is bricked
  // the moment the market resolves. The ceremonial payload is never executed
  // here — none of these guards depend on it.
  describe("liquidation marker set by finalize", function () {
    let base: PublicKey,
      quote: PublicKey,
      reservedDao: PublicKey,
      liquidatorA: PublicKey,
      rivalLiquidation: { proposal: PublicKey; squadsProposal: PublicKey },
      stagedDraft: { proposal: PublicKey; squadsProposal: PublicKey };

    before(async function () {
      base = await this.createMint(this.payer.publicKey, 6);
      quote = await this.createMint(this.payer.publicKey, 6);

      await this.createTokenAccount(base, this.payer.publicKey);
      await this.createTokenAccount(quote, this.payer.publicKey);

      await this.mintTo(
        base,
        this.payer.publicKey,
        this.payer,
        1_000 * 1_000_000,
      );
      await this.mintTo(
        quote,
        this.payer.publicKey,
        this.payer,
        500_000 * 1_000_000,
      );

      const nonce = new BN(Math.floor(Math.random() * 1000000));

      await this.futarchy
        .initializeDaoIx({
          baseMint: base,
          quoteMint: quote,
          params: {
            secondsPerProposal: 60 * 60 * 24 * 3,
            twapStartDelaySeconds: 60 * 60 * 24,
            twapInitialObservation: THOUSAND_BUCK_PRICE,
            twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(10),
            minQuoteFutarchicLiquidity: new BN(10_000),
            minBaseFutarchicLiquidity: new BN(10_000),
            passThresholdBps: 300,
            nonce,
            initialSpendingLimit: null,
            baseToStake: new BN(0),
            teamSponsoredPassThresholdBps: 300,
            teamAddress: this.payer.publicKey,
          },
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ])
        .rpc();

      [reservedDao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

      await this.futarchy
        .provideLiquidityIx({
          dao: reservedDao,
          baseMint: base,
          quoteMint: quote,
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

      liquidatorA = Keypair.generate().publicKey;

      // Everything is staged while the DAO is still healthy: the winning
      // liquidation, a rival liquidation, and an ordinary draft
      const winner = await this.futarchy.initializeHostileLiquidateProposal({
        dao: reservedDao,
        liquidator: liquidatorA,
      });
      rivalLiquidation = await this.futarchy.initializeHostileLiquidateProposal(
        {
          dao: reservedDao,
          liquidator: Keypair.generate().publicKey,
        },
      );

      const { squadsProposal: stagedSquadsProposal } =
        await createSquadsVaultTx(
          this,
          [
            {
              programId: MEMO_PROGRAM_ID,
              keys: [],
              data: Buffer.from("gap proposal"),
            },
          ],
          reservedDao,
        );
      stagedDraft = {
        proposal: await this.futarchy.initializeProposal(
          reservedDao,
          stagedSquadsProposal,
        ),
        squadsProposal: stagedSquadsProposal,
      };

      await this.futarchy
        .launchProposalIx({
          proposal: winner.proposal,
          dao: reservedDao,
          baseMint: base,
          quoteMint: quote,
          squadsProposal: winner.squadsProposal,
        })
        .rpc();

      await passProposal(this, {
        dao: reservedDao,
        proposal: winner.proposal,
        baseMint: base,
        quoteMint: quote,
        cranks: 50,
      });
    });

    it("writes the liquidator at finalize, before the payload ever executes", async function () {
      const storedDao = await this.futarchy.getDao(reservedDao);
      assert.ok(storedDao.liquidator.equals(liquidatorA));
    });

    it("refuses to launch a second liquidation once the first has passed", async function () {
      const callbacks = expectError(
        "DaoLiquidated",
        "launched a liquidation after another had already passed",
      );

      await this.futarchy
        .launchProposalIx({
          proposal: rivalLiquidation.proposal,
          dao: reservedDao,
          baseMint: base,
          quoteMint: quote,
          squadsProposal: rivalLiquidation.squadsProposal,
        })
        .rpc()
        .then(callbacks[0], callbacks[1]);

      // First writer wins: only one liquidation record ever holds the DAO
      const storedDao = await this.futarchy.getDao(reservedDao);
      assert.ok(storedDao.liquidator.equals(liquidatorA));
    });

    it("refuses to launch a pre-staged draft in the finalize→execute gap", async function () {
      const callbacks = expectError(
        "DaoLiquidated",
        "launched a blocker in the finalize→execute gap",
      );

      await this.futarchy
        .launchProposalIx({
          proposal: stagedDraft.proposal,
          dao: reservedDao,
          baseMint: base,
          quoteMint: quote,
          squadsProposal: stagedDraft.squadsProposal,
        })
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });
}
