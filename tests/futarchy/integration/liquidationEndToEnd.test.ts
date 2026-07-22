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
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  createLookupTableForTransaction,
  executeVaultTransaction,
  pumpPassMarket,
} from "../../utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);
const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

// The no-window path (#38): finalize + execute + sync land as one
// transaction, then the liquidated DAO runs as an estate — liquidator-gated
// enqueue, permissionless approve, ordinary Squads execution — while
// third-party LPs exit on their own schedule.
export default function suite() {
  it("liquidates in one transaction, runs the estate cycle, and lets a third-party LP exit", async function () {
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

    // The baked apply_liquidation payload requires the vault's ATAs to exist
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

    // The treasury's own LP position, swept at liquidation
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

    // Runs out the 10-day snapshot with the pass market above +25%, without
    // finalizing — finalize rides in the packed transaction below
    await pumpPassMarket(this, {
      dao,
      proposal,
      baseMint: META,
      quoteMint: USDC,
    });

    // finalize + execute + sync packed in ONE transaction: the DAO never
    // exists in a passed-but-not-liquidated state
    const vaultTransaction =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        this.squadsConnection,
        squadsTransaction,
      );
    const packIxs = [
      await this.futarchy
        .finalizeProposalIxV2({
          squadsProposal,
          dao,
          baseMint: META,
          quoteMint: USDC,
        })
        .instruction(),
      (
        await multisig.instructions.vaultTransactionExecute({
          connection: this.squadsConnection,
          multisigPda,
          transactionIndex: BigInt(vaultTransaction.index.toString()),
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

    // The liquidated end state, all landed by the single transaction
    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.liquidator.equals(liquidator.publicKey));
    assert.isNull(storedDao.initialSpendingLimit);
    assert.isFalse(storedDao.spendingLimitDirty);

    const [spendingLimitPda] = getSpendingLimitAddr({ dao });
    assert.isNull(await this.banksClient.getAccount(spendingLimitPda));

    const [treasuryPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), vault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
    const storedTreasuryPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(treasuryPosition);
    assert.equal(storedTreasuryPosition.liquidity.toString(), "0");

    const sweptBase = await this.getTokenBalance(META, vault);
    const sweptQuote = await this.getTokenBalance(USDC, vault);
    assert.isTrue(sweptBase > 0n);
    assert.isTrue(sweptQuote > 0n);

    // The estate cycle: the liquidator enqueues a distribution from the swept
    // treasury, the approval executes permissionlessly, and ordinary Squads
    // execution pays out
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

    const recipient = Keypair.generate().publicKey;
    const recipientAta = await this.createTokenAccount(USDC, recipient);
    const vaultUsdcAta = getAssociatedTokenAddressSync(USDC, vault, true);

    // The liquidation payload was transaction 1; the estate starts at 2
    const { tx: estateCreateTx } = this.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [
        createTransferInstruction(
          vaultUsdcAta,
          recipientAta,
          vault,
          600 * 1_000_000,
        ),
      ],
      transactionIndex: 2n,
    });
    estateCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    estateCreateTx.feePayer = this.payer.publicKey;
    estateCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(estateCreateTx);

    const {
      squadsProposal: estateSquadsProposal,
      squadsTransaction: estateSquadsTransaction,
    } = getProposalAddrsForTransactionIndex({ dao, transactionIndex: 2n });

    const [enqueuedApproval] = PublicKey.findProgramAddressSync(
      [
        SEED_ENQUEUED_APPROVAL,
        dao.toBuffer(),
        new BN(2).toArrayLike(Buffer, "le", 8),
      ],
      this.futarchy.futarchy.programId,
    );

    await this.futarchy.futarchy.methods
      .adminEnqueueMultisigProposalApproval({ transactionIndex: new BN(2) })
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

    const storedEstateProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        estateSquadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(storedEstateProposal.status),
    );

    await executeVaultTransaction(this, dao, estateSquadsTransaction);

    assert.equal(
      (await this.getTokenBalance(USDC, recipient)).toString(),
      (600 * 1_000_000).toString(),
    );
    assert.equal(
      (await this.getTokenBalance(USDC, vault)).toString(),
      (sweptQuote - BigInt(600 * 1_000_000)).toString(),
    );

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

    const [eventAuthority] = getEventAuthorityAddr(FUTARCHY_V0_6_PROGRAM_ID);
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
  });
}
