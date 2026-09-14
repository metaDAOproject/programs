import {
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  GatedMintClient,
  getEventAuthorityAddr,
  PERMISSIONLESS_ACCOUNT,
  SQUADS_PROGRAM_ID,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import {
  createLookupTableForTransaction,
  pumpPassMarket,
  setupBasicDao,
} from "../../utils.js";
import {
  getTokenAccountState,
  setupGatedMint,
  TOKEN_STATE_FROZEN,
  whitelistUser,
} from "../../gatedMint/utils.js";
import { TestContext } from "../../main.test.js";

const ata = (mint: PublicKey, owner: PublicKey) =>
  getAssociatedTokenAddressSync(mint, owner, true);

function adminCancelProposalIx(
  ctx: TestContext,
  {
    proposal,
    dao,
    squadsProposal,
    baseMint,
    quoteMint,
    admin,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    squadsProposal: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    admin: PublicKey;
  },
) {
  const {
    question,
    baseVault,
    quoteVault,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
  } = ctx.futarchy.getProposalPdas(proposal, baseMint, quoteMint, dao);
  const [vaultEventAuthority] = getEventAuthorityAddr(
    CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  );

  return ctx.futarchy.futarchy.methods.adminCancelProposal().accounts({
    proposal,
    dao,
    question,
    squadsProposal,
    squadsMultisig: multisig.getMultisigPda({ createKey: dao })[0],
    squadsMultisigProgram: SQUADS_PROGRAM_ID,
    admin,
    ammPassBaseVault: ata(passBaseMint, dao),
    ammPassQuoteVault: ata(passQuoteMint, dao),
    ammFailBaseVault: ata(failBaseMint, dao),
    ammFailQuoteVault: ata(failQuoteMint, dao),
    ammBaseVault: ata(baseMint, dao),
    ammQuoteVault: ata(quoteMint, dao),
    vaultProgram: CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
    vaultEventAuthority,
    quoteVault,
    quoteVaultUnderlyingTokenAccount: ata(quoteMint, quoteVault),
    passQuoteMint,
    failQuoteMint,
    passBaseMint,
    failBaseMint,
    baseVault,
    baseVaultUnderlyingTokenAccount: ata(baseMint, baseVault),
  });
}

// A gated_invoke wrapper carries the inner instruction's accounts plus its own,
// which overflows a legacy transaction, so the wrapped call goes out as a v0
// transaction with a lookup table.
async function sendGated(
  ctx: TestContext,
  wrapped: { transaction(): Promise<Transaction> },
  signers: Keypair[],
) {
  const tx = await wrapped.transaction();
  const lut = await createLookupTableForTransaction(tx, ctx);
  const message = new TransactionMessage({
    payerKey: ctx.payer.publicKey,
    recentBlockhash: (await ctx.banksClient.getLatestBlockhash())[0],
    instructions: tx.instructions,
  }).compileToV0Message([lut]);
  const versioned = new VersionedTransaction(message);
  versioned.sign([ctx.payer, ...signers]);
  await ctx.banksClient.processTransaction(versioned);
}

export default function suite() {
  let gatedMintClient: GatedMintClient;
  let GATED: PublicKey,
    USDC: PublicKey,
    dao: PublicKey,
    proposal: PublicKey,
    squadsProposal: PublicKey,
    baseVault: PublicKey,
    passBaseMint: PublicKey,
    failBaseMint: PublicKey,
    ammBaseVault: PublicKey,
    baseVaultUnderlying: PublicKey;
  let settler: Keypair;

  beforeEach(async function () {
    gatedMintClient = GatedMintClient.createClient({
      provider: this.provider as any,
    });

    const gatedAdmin = Keypair.generate();
    ({ mint: GATED } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      gatedAdmin.publicKey,
    ));
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.createTokenAccount(GATED, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);
    await this.mintTo(
      GATED,
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

    dao = await setupBasicDao({
      context: this,
      baseMint: GATED,
      quoteMint: USDC,
    });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: GATED,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000),
        maxBaseAmount: new BN(100 * 1_000_000),
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          baseToStake: null,
          twapInitialObservation: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          twapStartDelaySeconds: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
          isOptimisticGovernanceEnabled: null,
        },
      })
      .instruction();
    const { tx: squadsCreateTx, squadsProposal: createdSquadsProposal } =
      this.futarchy.squadsProposalCreateTx({
        dao,
        instructions: [updateDaoIx],
        transactionIndex: 1n,
      });
    squadsCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsCreateTx.feePayer = this.payer.publicKey;
    squadsCreateTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(squadsCreateTx);
    squadsProposal = createdSquadsProposal;

    proposal = await this.futarchy.initializeProposal(dao, squadsProposal);
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: GATED,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    const pdas = this.futarchy.getProposalPdas(proposal, GATED, USDC, dao);
    baseVault = pdas.baseVault;
    passBaseMint = pdas.passBaseMint;
    failBaseMint = pdas.failBaseMint;
    ammBaseVault = ata(GATED, dao);
    baseVaultUnderlying = ata(GATED, baseVault);

    await pumpPassMarket(this, {
      dao,
      proposal,
      baseMint: GATED,
      quoteMint: USDC,
    });

    settler = Keypair.generate();
    await whitelistUser(
      gatedMintClient,
      GATED,
      gatedAdmin,
      settler.publicKey,
      this.payer,
    );
    await this.createTokenAccount(USDC, settler.publicKey);
    await this.mintTo(USDC, settler.publicKey, this.payer, 1_000 * 1_000_000);
    await this.conditionalVault
      .splitTokensIx(
        pdas.question,
        pdas.quoteVault,
        USDC,
        new BN(1_000 * 1_000_000),
        2,
        settler.publicKey,
      )
      .signers([settler])
      .rpc();
    await this.createTokenAccount(passBaseMint, settler.publicKey);

    // The first gated trade leaves the market's two gated-mint accounts frozen.
    const swapIx = await this.futarchy
      .conditionalSwapIx({
        dao,
        trader: settler.publicKey,
        baseMint: GATED,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(100 * 1_000_000),
        minOutputAmount: new BN(0),
      })
      .instruction();
    await sendGated(
      this,
      gatedMintClient
        .gatedInvokeIx({
          caller: settler.publicKey,
          mint: GATED,
          instruction: swapIx,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ]),
      [settler],
    );

    assert.equal(
      await getTokenAccountState(this.banksClient, ammBaseVault),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, baseVaultUnderlying),
      TOKEN_STATE_FROZEN,
    );
  });

  it("finalizes through gated_invoke while the AMM base vault and the vault underlying are frozen", async function () {
    try {
      await this.futarchy.finalizeProposal(proposal);
      assert.fail("finalized directly against a frozen AMM base vault");
    } catch (e) {
      assert.match(e.message, /custom program error: 0x11\b/);
    }

    const ammBaseBefore = await this.getTokenBalance(GATED, dao);
    const underlyingBefore = await this.getTokenBalance(GATED, baseVault);
    const passBaseRedeemed = await this.getTokenBalance(passBaseMint, dao);

    const finalizeIx = await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal,
        dao,
        baseMint: GATED,
        quoteMint: USDC,
      })
      .instruction();
    await sendGated(
      this,
      gatedMintClient
        .gatedInvokeIx({
          caller: settler.publicKey,
          mint: GATED,
          instruction: finalizeIx,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ]),
      [settler],
    );

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.passed);
    const storedDao = await this.futarchy.getDao(dao);
    assert.exists(storedDao.amm.state.spot);

    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusApproved(storedSquadsProposal.status),
    );

    assert.equal(
      (await this.getTokenBalance(GATED, dao)).toString(),
      (ammBaseBefore + passBaseRedeemed).toString(),
    );
    assert.equal(
      (await this.getTokenBalance(GATED, baseVault)).toString(),
      (underlyingBefore - passBaseRedeemed).toString(),
    );

    assert.equal(
      await getTokenAccountState(this.banksClient, ammBaseVault),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, baseVaultUnderlying),
      TOKEN_STATE_FROZEN,
    );
  });

  it("cancels through gated_invoke on the council path while the same accounts are frozen", async function () {
    const cancelArgs = {
      proposal,
      dao,
      squadsProposal,
      baseMint: GATED,
      quoteMint: USDC,
      admin: this.payer.publicKey,
    };

    try {
      await adminCancelProposalIx(this, cancelArgs)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ])
        .rpc();
      assert.fail("cancelled directly against a frozen AMM base vault");
    } catch (e) {
      assert.match(e.message, /custom program error: 0x11\b/);
    }

    const ammBaseBefore = await this.getTokenBalance(GATED, dao);
    const underlyingBefore = await this.getTokenBalance(GATED, baseVault);
    const failBaseRedeemed = await this.getTokenBalance(failBaseMint, dao);

    const cancelIx = await adminCancelProposalIx(
      this,
      cancelArgs,
    ).instruction();
    await sendGated(
      this,
      gatedMintClient
        .gatedInvokeIx({
          caller: settler.publicKey,
          mint: GATED,
          instruction: cancelIx,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ]),
      [settler],
    );

    const storedProposal = await this.futarchy.getProposal(proposal);
    assert.exists(storedProposal.state.failed);
    const storedDao = await this.futarchy.getDao(dao);
    assert.exists(storedDao.amm.state.spot);

    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusRejected(storedSquadsProposal.status),
    );

    assert.equal(
      (await this.getTokenBalance(GATED, dao)).toString(),
      (ammBaseBefore + failBaseRedeemed).toString(),
    );
    assert.equal(
      (await this.getTokenBalance(GATED, baseVault)).toString(),
      (underlyingBefore - failBaseRedeemed).toString(),
    );

    assert.equal(
      await getTokenAccountState(this.banksClient, ammBaseVault),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, baseVaultUnderlying),
      TOKEN_STATE_FROZEN,
    );
  });
}
