import {
  FUTARCHY_V0_6_PROGRAM_ID,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddrsForTransactionIndex,
  getSpendingLimitAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { executeVaultTransaction, passProposal } from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);
const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

// The lazy-unwind path: finalize bricks the DAO (liquidator written, limit
// zeroed), the payload is ceremony (memo only), and the treasury position
// exits afterward through a liquidator-authored estate cycle, while
// third-party LPs exit on their own schedule.
export default function suite() {
  it("liquidates at finalize, unwinds the treasury through the estate cycle, and lets a third-party LP exit", async function () {
    const META = await this.createMint(this.payer.publicKey, 6);
    const USDC = await this.createMint(this.payer.publicKey, 6);

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
          // the pumped pass market clears HostileLiquidate's +25%
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

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

    const storedDaoBefore = await this.futarchy.getDao(dao);
    const vault = storedDaoBefore.squadsMultisigVault;
    const multisigPda = storedDaoBefore.squadsMultisig;

    // The unwind destination: the vault's ATAs
    await this.createTokenAccount(META, vault);
    await this.createTokenAccount(USDC, vault);

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

    // The treasury's own LP position, unwound after liquidation
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(25_000 * 1_000_000), // 25,000 USDC
        maxBaseAmount: new BN(25 * 1_000_000), // 25 META
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const liquidator = Keypair.generate();

    const { proposal, squadsProposal, squadsTransaction } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator: liquidator.publicKey,
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

    // Finalize marks the DAO as liquidated: the liquidator is installed and the
    // spending-limit record zeroed before any payload runs
    let storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator.publicKey));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isTrue(storedDao.spendingLimitDirty);

    // The permissionless sync removes the Squads-side limit, so the outgoing
    // team's pull rights die before any funds reach the vault
    await this.futarchy.syncSpendingLimitIx({ dao }).rpc();

    storedDao = await this.futarchy.getDao(dao);
    assert.isFalse(storedDao.spendingLimitDirty);
    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    // The ceremonial payload
    await executeVaultTransaction(this, dao, squadsTransaction);
    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusExecuted(storedSquadsProposal.status),
    );

    // The liquidator pays rent for the enqueued approval accounts
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: liquidator.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.feePayer = this.payer.publicKey;
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    // One estate cycle: liquidator-authored vault transaction, liquidator
    // enqueue, permissionless approve, ordinary Squads execution
    const runEstateCycle = async (
      transactionIndex: bigint,
      instructions: TransactionInstruction[],
    ) => {
      const { tx: createTx } = this.futarchy.squadsProposalCreateTx({
        dao,
        instructions,
        transactionIndex,
      });
      createTx.recentBlockhash = (
        await this.banksClient.getLatestBlockhash()
      )[0];
      createTx.feePayer = this.payer.publicKey;
      createTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
      await this.banksClient.processTransaction(createTx);

      const {
        squadsProposal: estateSquadsProposal,
        squadsTransaction: estateSquadsTransaction,
      } = getProposalAddrsForTransactionIndex({ dao, transactionIndex });

      const [enqueuedApproval] = PublicKey.findProgramAddressSync(
        [
          SEED_ENQUEUED_APPROVAL,
          dao.toBuffer(),
          new BN(transactionIndex.toString()).toArrayLike(Buffer, "le", 8),
        ],
        this.futarchy.futarchy.programId,
      );

      await this.futarchy.futarchy.methods
        .adminEnqueueMultisigProposalApproval({
          transactionIndex: new BN(transactionIndex.toString()),
        })
        .accounts({
          dao,
          admin: liquidator.publicKey,
          squadsMultisig: multisigPda,
          squadsMultisigProposal: estateSquadsProposal,
          enqueuedApproval,
        })
        .signers([liquidator])
        .rpc();

      await this.futarchy.futarchy.methods
        .executeMultisigProposalApproval()
        .accounts({
          dao,
          rentReceiver: this.payer.publicKey,
          squadsMultisig: multisigPda,
          squadsMultisigProposal: estateSquadsProposal,
          enqueuedApproval,
          squadsMultisigProgram: multisig.PROGRAM_ID,
        })
        .rpc();

      await executeVaultTransaction(this, dao, estateSquadsTransaction);
    };

    // Estate cycle #1 unwinds the treasury position into the vault's ATAs.
    const preUnwindDao = await this.futarchy.getDao(dao);
    const preUnwindSpot = preUnwindDao.amm.state.spot.spot;

    const [treasuryPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
    const storedTreasuryPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(treasuryPosition);
    const expectedBase = storedTreasuryPosition.liquidity
      .mul(preUnwindSpot.baseReserves)
      .div(preUnwindDao.amm.totalLiquidity);
    const expectedQuote = storedTreasuryPosition.liquidity
      .mul(preUnwindSpot.quoteReserves)
      .div(preUnwindDao.amm.totalLiquidity);

    const [eventAuthority] = getEventAuthorityAddr(FUTARCHY_V0_6_PROGRAM_ID);
    const withdrawIx = await this.futarchy.futarchy.methods
      .withdrawLiquidity({
        liquidityToWithdraw: storedTreasuryPosition.liquidity,
        minBaseAmount: new BN(0),
        minQuoteAmount: new BN(0),
      })
      .accounts({
        dao,
        positionAuthority: vault,
        liquidityProviderBaseAccount: getAssociatedTokenAddressSync(
          META,
          vault,
          true,
        ),
        liquidityProviderQuoteAccount: getAssociatedTokenAddressSync(
          USDC,
          vault,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(META, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, dao, true),
        ammPosition: treasuryPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      })
      .instruction();

    // The memo payload was transaction 1; the estate starts at 2
    await runEstateCycle(2n, [withdrawIx]);

    const postUnwindPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(treasuryPosition);
    assert.equal(postUnwindPosition.liquidity.toString(), "0");

    const sweptBase = await this.getTokenBalance(META, vault);
    const sweptQuote = await this.getTokenBalance(USDC, vault);
    assert.equal(sweptBase.toString(), expectedBase.toString());
    assert.equal(sweptQuote.toString(), expectedQuote.toString());

    // Liquidation never traps third-party LPs: withdraw_liquidity is exempt
    // from the liquidated guards
    const [lpPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
    const storedLpPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(lpPosition);

    const preBase = await this.getTokenBalance(META, this.payer.publicKey);
    const preQuote = await this.getTokenBalance(USDC, this.payer.publicKey);

    await this.futarchy.futarchy.methods
      .withdrawLiquidity({
        liquidityToWithdraw: storedLpPosition.liquidity,
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
        ammPosition: lpPosition,
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

    const postLpPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(lpPosition);
    assert.equal(postLpPosition.liquidity.toString(), "0");

    // Estate cycle #2 distributes from the swept treasury
    // Simply proof that the liquidator can move funds out of the DAO
    const recipient = Keypair.generate().publicKey;
    const recipientAta = await this.createTokenAccount(USDC, recipient);
    const vaultUsdcAta = getAssociatedTokenAddressSync(USDC, vault, true);

    await runEstateCycle(3n, [
      createTransferInstruction(
        vaultUsdcAta,
        recipientAta,
        vault,
        600 * 1_000_000,
      ),
    ]);

    assert.equal(
      (await this.getTokenBalance(USDC, recipient)).toString(),
      (600 * 1_000_000).toString(),
    );
    assert.equal(
      (await this.getTokenBalance(USDC, vault)).toString(),
      (sweptQuote - BigInt(600 * 1_000_000)).toString(),
    );
  });
}
