import {
  FUTARCHY_V0_6_PROGRAM_ID,
  GatedMintClient,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddrsForTransactionIndex,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { executeVaultTransaction, passProposal } from "../../utils.js";
import {
  setupGatedMint,
  whitelistUser,
  freezeTokenAccount,
  getTokenAccountState,
  TOKEN_STATE_FROZEN,
  TOKEN_STATE_INITIALIZED,
} from "../../gatedMint/utils.js";

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);
const SEED_ENQUEUED_APPROVAL = Buffer.from("enqueued_approval");

export default function suite() {
  it("liquidates a gated DAO with a frozen AMM base vault and unwinds via gated_invoke", async function () {
    const gatedMintClient = GatedMintClient.createClient({
      provider: this.provider as any,
    });

    const gatedAdmin = Keypair.generate();
    const { mint: GATED } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      gatedAdmin.publicKey,
    );
    const USDC = await this.createMint(this.payer.publicKey, 6);

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

    const nonce = new BN(Math.floor(Math.random() * 1000000));

    await this.futarchy
      .initializeDaoIx({
        baseMint: GATED,
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

    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });

    const storedDaoBefore = await this.futarchy.getDao(dao);
    const vault = storedDaoBefore.squadsMultisigVault;
    const multisigPda = storedDaoBefore.squadsMultisig;

    // The unwind destination: the vault's ATAs
    const vaultBaseAta = await this.createTokenAccount(GATED, vault);
    const vaultQuoteAta = await this.createTokenAccount(USDC, vault);

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: GATED,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 GATED
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
        baseMint: GATED,
        quoteMint: USDC,
        quoteAmount: new BN(25_000 * 1_000_000), // 25,000 USDC
        maxBaseAmount: new BN(25 * 1_000_000), // 25 GATED
        minLiquidity: new BN(1),
        positionAuthority: vault,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // The liquidator's cooperative whitelisted caller for the gated leg
    const unwinder = Keypair.generate();
    await whitelistUser(
      gatedMintClient,
      GATED,
      gatedAdmin,
      unwinder.publicKey,
      this.payer,
    );

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
        baseMint: GATED,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: GATED,
      quoteMint: USDC,
      cranks: 50,
    });

    const ammBaseVault = getAssociatedTokenAddressSync(GATED, dao, true);
    const ammQuoteVault = getAssociatedTokenAddressSync(USDC, dao, true);

    // The gated ratchet has left the AMM base vault frozen on a liquidated
    // DAO
    await freezeTokenAccount(this.context, this.banksClient, ammBaseVault);

    // The memo payload touches no accounts, so the immutable transaction
    // executes even against the frozen vault — where the old token-moving
    // payload rolled back forever
    await executeVaultTransaction(this, dao, squadsTransaction);
    const storedSquadsProposal =
      await multisig.accounts.Proposal.fromAccountAddress(
        this.squadsConnection,
        squadsProposal,
      );
    assert.isTrue(
      multisig.generated.isProposalStatusExecuted(storedSquadsProposal.status),
    );

    // The liquidator pays rent for the enqueued approval account
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

    // The unwind payload, authored at unwind time when "is this mint gated?"
    // is a known fact: gated_invoke thaws the frozen vault, invokes
    // withdraw_liquidity with the Squads-minted vault signature, and refreezes
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
        liquidityProviderBaseAccount: vaultBaseAta,
        liquidityProviderQuoteAccount: vaultQuoteAta,
        ammBaseVault,
        ammQuoteVault,
        ammPosition: treasuryPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      })
      .instruction();

    const gatedWithdrawIx = await gatedMintClient
      .gatedInvokeIx({
        caller: unwinder.publicKey,
        mint: GATED,
        instruction: withdrawIx,
      })
      .instruction();

    // The memo payload was transaction 1; the estate starts at 2
    const { tx: estateCreateTx } = this.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [gatedWithdrawIx],
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

    // The whitelisted caller co-signs the execution alongside the Squads
    // member; the vault's signature comes from Squads itself
    await executeVaultTransaction(
      this,
      dao,
      estateSquadsTransaction,
      [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })],
      [unwinder],
    );

    // The sweep landed
    const postUnwindPosition =
      await this.futarchy.futarchy.account.ammPosition.fetch(treasuryPosition);
    assert.equal(postUnwindPosition.liquidity.toString(), "0");

    assert.equal(
      (await this.getTokenBalance(GATED, vault)).toString(),
      expectedBase.toString(),
    );
    assert.equal(
      (await this.getTokenBalance(USDC, vault)).toString(),
      expectedQuote.toString(),
    );

    // The ratchet: every gated-mint account in the invoke ends frozen, the
    // AMM vault again and the swept base alongside it
    assert.equal(
      await getTokenAccountState(this.banksClient, ammBaseVault),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, vaultBaseAta),
      TOKEN_STATE_FROZEN,
    );

    // The quote leg is not gated, so the swept quote stays spendable
    assert.equal(
      await getTokenAccountState(this.banksClient, vaultQuoteAta),
      TOKEN_STATE_INITIALIZED,
    );
  });

  it("a liquidated DAO holding gating authority drops the gate through its liquidator", async function () {
    const gatedMintClient = GatedMintClient.createClient({
      provider: this.provider as any,
    });

    // The DAO treasury itself is the gating admin. The vault address is
    // derivable before the DAO exists, so the mint is configured up front
    const nonce = new BN(Math.floor(Math.random() * 1000000));
    const [dao] = getDaoAddr({ nonce, daoCreator: this.payer.publicKey });
    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [vault] = multisig.getVaultPda({ multisigPda, index: 0 });

    const { mint: GATED, gatedMintConfig } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      vault,
    );
    const USDC = await this.createMint(this.payer.publicKey, 6);

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

    await this.futarchy
      .initializeDaoIx({
        baseMint: GATED,
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

    const storedDao = await this.futarchy.getDao(dao);
    assert.ok(storedDao.squadsMultisigVault.equals(vault));

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: GATED,
        quoteMint: USDC,
        quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
        maxBaseAmount: new BN(100 * 1_000_000), // 100 GATED
        minLiquidity: new BN(0),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    const liquidator = Keypair.generate();

    const { proposal, squadsProposal } =
      await this.futarchy.initializeHostileLiquidateProposal({
        dao,
        liquidator: liquidator.publicKey,
      });

    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: GATED,
        quoteMint: USDC,
        squadsProposal,
      })
      .rpc();

    await passProposal(this, {
      dao,
      proposal,
      baseMint: GATED,
      quoteMint: USDC,
      cranks: 50,
    });

    // The ratcheted estate the gate drop must free
    const ammBaseVault = getAssociatedTokenAddressSync(GATED, dao, true);
    await freezeTokenAccount(this.context, this.banksClient, ammBaseVault);

    // The liquidator pays rent for the enqueued approval account
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

    // The estate cycle carries disable_gating: the config's admin is the
    // vault, whose signature Squads mints at execution
    const disableGatingIx = await gatedMintClient
      .disableGatingIx({ mint: GATED, admin: vault })
      .instruction();

    // The memo payload was transaction 1; the estate starts at 2
    const { tx: estateCreateTx } = this.futarchy.squadsProposalCreateTx({
      dao,
      instructions: [disableGatingIx],
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

    await executeVaultTransaction(this, dao, estateSquadsTransaction);

    const storedConfig =
      await gatedMintClient.program.account.gatedMintConfig.fetch(
        gatedMintConfig,
      );
    assert.isTrue(storedConfig.gatingDisabled);

    // With the gate down, the frozen estate thaws permissionlessly
    await gatedMintClient
      .thawAccountIx({ mint: GATED, tokenAccount: ammBaseVault })
      .rpc();
    assert.equal(
      await getTokenAccountState(this.banksClient, ammBaseVault),
      TOKEN_STATE_INITIALIZED,
    );
  });
}
