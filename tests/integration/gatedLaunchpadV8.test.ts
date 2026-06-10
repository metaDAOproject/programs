import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import BN from "bn.js";
import {
  DAMM_V2_PROGRAM_ID,
  FutarchyClient,
  GatedMintClient,
  MAINNET_USDC,
  LAUNCHPAD_V0_8_PROGRAM_ID,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
  getGatedMintConfigAddr,
} from "@metadaoproject/programs";
import {
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/programs/launchpad/v0.8";
import { CpAmm } from "@meteora-ag/cp-amm-sdk";
import { whitelistUser } from "../gatedMint/utils.js";
import { createLookupTableForTransaction } from "../utils.js";

const TOKEN_ACCOUNT_STATE_OFFSET = 108;
const TOKEN_STATE_INITIALIZED = 1;
const TOKEN_STATE_FROZEN = 2;

async function getTokenAccountState(
  banksClient: any,
  addr: PublicKey,
): Promise<number> {
  const acc = await banksClient.getAccount(addr);
  return acc.data[TOKEN_ACCOUNT_STATE_OFFSET];
}

export default async function suite() {
  before(async function () {
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    const poolCreatorAuthorityOffset = 8 + 32;
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_8_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );
  });

  it("gated launchpad v8 lifecycle: init → start → fund → settle → claim → disable → thaw", async function () {
    const launchpadClient: LaunchpadClient = this.launchpad_v8;
    const gatedMintClient: GatedMintClient = GatedMintClient.createClient({
      provider: this.provider,
    });

    const gatedMintAdmin = Keypair.generate();
    const launchAuthority = Keypair.generate();
    const funder1 = Keypair.generate();

    // Fund operator keypairs with SOL — they pay for inner-ix account
    // creation (launch, vaults, mint_governor, funding_record).
    const fundSol = async (recipient: PublicKey, lamports: number) => {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.payer.publicKey,
          toPubkey: recipient,
          lamports,
        }),
      );
      tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
      tx.feePayer = this.payer.publicKey;
      tx.sign(this.payer);
      await this.banksClient.processTransaction(tx);
    };
    await fundSol(gatedMintAdmin.publicKey, 5_000_000_000);
    await fundSol(launchAuthority.publicKey, 5_000_000_000);
    await fundSol(funder1.publicKey, 1_000_000_000);

    const minRaise = new BN(300_000 * 10 ** 6);
    const launchPeriod = 60 * 60 * 24 * 2;

    // =====================
    // Setup: create base mint with mint authority = launchSigner, freeze authority = payer
    // =====================
    const mintKeypair = Keypair.generate();
    const META = mintKeypair.publicKey;
    const [launch] = getLaunchAddr(launchpadClient.getProgramId(), META);
    const [launchSigner] = getLaunchSignerAddr(
      launchpadClient.getProgramId(),
      launch,
    );

    const rent = await this.banksClient.getRent();
    const mintLamports = Number(rent.minimumBalance(BigInt(token.MINT_SIZE)));

    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: META,
        lamports: mintLamports,
        space: token.MINT_SIZE,
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(
        META,
        6,
        launchSigner,
        this.payer.publicKey,
      ),
    );
    createMintTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createMintTx.feePayer = this.payer.publicKey;
    createMintTx.sign(this.payer, mintKeypair);
    await this.banksClient.processTransaction(createMintTx);

    // =====================
    // initialize_gated_mint — freeze authority moves from payer → gated_mint_config PDA
    // =====================
    await gatedMintClient
      .initializeGatedMintIx({
        mint: META,
        currentFreezeAuthority: this.payer.publicKey,
        admin: gatedMintAdmin.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    const [gatedMintConfig] = getGatedMintConfigAddr({ mint: META });
    const mintAfterInit = await this.getMint(META);
    assert.ok(mintAfterInit.freezeAuthority.equals(gatedMintConfig));

    // =====================
    // add_whitelisted_user × 3
    // =====================
    await whitelistUser(
      gatedMintClient,
      META,
      gatedMintAdmin,
      gatedMintAdmin.publicKey,
      this.payer,
    );
    await whitelistUser(
      gatedMintClient,
      META,
      gatedMintAdmin,
      launchAuthority.publicKey,
      this.payer,
    );
    await whitelistUser(
      gatedMintClient,
      META,
      gatedMintAdmin,
      funder1.publicKey,
      this.payer,
    );

    // =====================
    // gated_invoke(initialize_launch) — caller = metadaoOps
    // =====================
    const initLaunchIx = await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: launchPeriod,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(25_000 * 10 ** 6),
        monthlySpendingLimitMembers: [gatedMintAdmin.publicKey],
        performancePackageGrantee: gatedMintAdmin.publicKey,
        performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        additionalTokensAmount: new BN(0),
        hasBidWall: false,
        payer: gatedMintAdmin.publicKey,
      })
      .instruction();

    const launchBaseVault = token.getAssociatedTokenAddressSync(
      META,
      launchSigner,
      true,
    );

    await gatedMintClient
      .gatedInvokeIx({
        caller: gatedMintAdmin.publicKey,
        mint: META,
        instruction: initLaunchIx,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .signers([gatedMintAdmin])
      .rpc();

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { initialized: {} });

    assert.equal(
      await getTokenAccountState(this.banksClient, launchBaseVault),
      TOKEN_STATE_FROZEN,
    );

    // =====================
    // start_launch (direct)
    // =====================
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { live: {} });

    // =====================
    // fund (direct, USDC only)
    // =====================
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      500_000_000000,
    );

    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(500_000_000000),
        funder: funder1.publicKey,
        payer: funder1.publicKey,
      })
      .signers([funder1])
      .rpc();

    // =====================
    // close_launch + set_funding_record_approval (direct)
    // =====================
    await this.advanceBySeconds(launchPeriod + 1);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(500_000_000000),
      })
      .signers([launchAuthority])
      .rpc();

    // =====================
    // gated_invoke(settle_launch) — caller = launchAuthority
    // =====================
    const settleIx = await launchpadClient
      .settleLaunchIx({
        launch,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
        payer: launchAuthority.publicKey,
      })
      .instruction();

    const wrappedSettleTx = await gatedMintClient
      .gatedInvokeIx({
        caller: launchAuthority.publicKey,
        mint: META,
        instruction: settleIx,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 255 * 1024 }),
      ])
      .signers([launchAuthority])
      .transaction();

    const lut = await createLookupTableForTransaction(wrappedSettleTx, this);

    const settleMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: wrappedSettleTx.instructions,
    }).compileToV0Message([lut]);

    const settleVersionedTx = new VersionedTransaction(settleMessage);
    settleVersionedTx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(settleVersionedTx);

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });

    // launch_base_vault still frozen
    assert.equal(
      await getTokenAccountState(this.banksClient, launchBaseVault),
      TOKEN_STATE_FROZEN,
    );

    // futarchy AMM base vault frozen
    const futarchyAmmBaseVault = token.getAssociatedTokenAddressSync(
      META,
      launchAccount.dao,
      true,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, futarchyAmmBaseVault),
      TOKEN_STATE_FROZEN,
    );

    // DAMM v2 token_a_vault frozen
    const [dammPool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG.toBuffer(),
        Buffer.compare(META.toBuffer(), MAINNET_USDC.toBuffer()) === 1
          ? META.toBuffer()
          : MAINNET_USDC.toBuffer(),
        Buffer.compare(META.toBuffer(), MAINNET_USDC.toBuffer()) === 1
          ? MAINNET_USDC.toBuffer()
          : META.toBuffer(),
      ],
      new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"),
    );
    const [dammTokenAVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), META.toBuffer(), dammPool.toBuffer()],
      new PublicKey("cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG"),
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, dammTokenAVault),
      TOKEN_STATE_FROZEN,
    );

    // =====================
    // gated_invoke(claim) — caller = funder1
    // =====================
    const claimIx = await launchpadClient
      .claimIx({
        launch,
        baseMint: META,
        funder: funder1.publicKey,
      })
      .instruction();

    const funder1BaseAta = token.getAssociatedTokenAddressSync(
      META,
      funder1.publicKey,
    );
    const createFunder1AtaIx =
      token.createAssociatedTokenAccountIdempotentInstruction(
        funder1.publicKey,
        funder1BaseAta,
        funder1.publicKey,
        META,
      );

    await gatedMintClient
      .gatedInvokeIx({
        caller: funder1.publicKey,
        mint: META,
        instruction: claimIx,
      })
      .preInstructions([createFunder1AtaIx])
      .signers([funder1])
      .rpc();

    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    assert.equal(funder1Balance.toString(), (10_000_000 * 10 ** 6).toString());

    assert.equal(
      await getTokenAccountState(this.banksClient, funder1BaseAta),
      TOKEN_STATE_FROZEN,
    );

    // =====================
    // gated_invoke(futarchy::spot_swap) — buy META on futarchy AMM
    // =====================
    // Top up funder1's USDC for the swaps (they spent everything funding).
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      200_000_000_000,
    );

    const futarchyClient: FutarchyClient = this.futarchy;
    const futarchyAmmQuoteVault = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchAccount.dao,
      true,
    );

    const futarchyAmmBaseBefore = (
      await this.banksClient.getAccount(futarchyAmmBaseVault)
    ).data;
    const ammBaseAmountBefore = Buffer.from(
      futarchyAmmBaseBefore,
    ).readBigUInt64LE(64);

    const funder1MetaBefore = await this.getTokenBalance(
      META,
      funder1.publicKey,
    );

    const spotSwapIx = await futarchyClient
      .spotSwapIx({
        dao: launchAccount.dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        swapType: "buy",
        inputAmount: new BN(100_000_000),
        minOutputAmount: new BN(0),
        trader: funder1.publicKey,
      })
      .instruction();

    await gatedMintClient
      .gatedInvokeIx({
        caller: funder1.publicKey,
        mint: META,
        instruction: spotSwapIx,
      })
      .signers([funder1])
      .rpc();

    const funder1MetaAfterSpot = await this.getTokenBalance(
      META,
      funder1.publicKey,
    );
    assert(funder1MetaAfterSpot > funder1MetaBefore);

    // Both gated-mint accounts touched by the swap end up frozen post-CPI.
    assert.equal(
      await getTokenAccountState(this.banksClient, funder1BaseAta),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, futarchyAmmBaseVault),
      TOKEN_STATE_FROZEN,
    );

    // Sanity check: the AMM moved META out (i.e., the swap actually executed,
    // it wasn't silently a no-op against a still-frozen vault).
    const futarchyAmmBaseAfter = (
      await this.banksClient.getAccount(futarchyAmmBaseVault)
    ).data;
    const ammBaseAmountAfter =
      Buffer.from(futarchyAmmBaseAfter).readBigUInt64LE(64);
    assert(ammBaseAmountAfter < ammBaseAmountBefore);

    // futarchyAmmQuoteVault sanity: not gated, balance increased by input amount
    const ammQuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.dao,
    );
    assert.equal(
      ammQuoteBalance.toString(),
      (100_000 * 10 ** 6 + 100_000_000).toString(),
    );

    // =====================
    // gated_invoke(damm_v2::swap) — buy META on DAMM v2 pool
    // =====================
    const cpAmm = new CpAmm(this.squadsConnection);
    const funder1MetaBeforeDamm = await this.getTokenBalance(
      META,
      funder1.publicKey,
    );
    const dammPoolMetaBefore = (
      await this.banksClient.getAccount(dammTokenAVault)
    ).data;
    const dammPoolMetaAmountBefore =
      Buffer.from(dammPoolMetaBefore).readBigUInt64LE(64);

    const dammSwapIx = await cpAmm._program.methods
      .swap({
        amountIn: new BN(100_000_000),
        minimumAmountOut: new BN(0),
      })
      .accounts({
        tokenAMint: META,
        tokenBMint: MAINNET_USDC,
        tokenAProgram: token.TOKEN_PROGRAM_ID,
        tokenBProgram: token.TOKEN_PROGRAM_ID,
        referralTokenAccount: null,
        inputTokenAccount: token.getAssociatedTokenAddressSync(
          MAINNET_USDC,
          funder1.publicKey,
          true,
        ),
        outputTokenAccount: funder1BaseAta,
        payer: funder1.publicKey,
        pool: dammPool,
        program: DAMM_V2_PROGRAM_ID,
      })
      .instruction();

    await gatedMintClient
      .gatedInvokeIx({
        caller: funder1.publicKey,
        mint: META,
        instruction: dammSwapIx,
      })
      .signers([funder1])
      .rpc();

    const funder1MetaAfterDamm = await this.getTokenBalance(
      META,
      funder1.publicKey,
    );
    assert(funder1MetaAfterDamm > funder1MetaBeforeDamm);

    // Both gated-mint accounts touched end up frozen post-CPI.
    assert.equal(
      await getTokenAccountState(this.banksClient, funder1BaseAta),
      TOKEN_STATE_FROZEN,
    );
    assert.equal(
      await getTokenAccountState(this.banksClient, dammTokenAVault),
      TOKEN_STATE_FROZEN,
    );

    // Sanity: DAMM v2 vault drained some META (swap really executed).
    const dammPoolMetaAfter = (
      await this.banksClient.getAccount(dammTokenAVault)
    ).data;
    const dammPoolMetaAmountAfter =
      Buffer.from(dammPoolMetaAfter).readBigUInt64LE(64);
    assert(dammPoolMetaAmountAfter < dammPoolMetaAmountBefore);

    // =====================
    // disable_gating
    // =====================
    await gatedMintClient
      .disableGatingIx({ mint: META, admin: gatedMintAdmin.publicKey })
      .signers([gatedMintAdmin])
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.gatingDisabled, true);

    // =====================
    // thaw_account from a fresh keypair (permissionless after disable)
    // =====================
    const freshThawer = Keypair.generate();
    await fundSol(freshThawer.publicKey, 100_000_000);

    const thawIx = await gatedMintClient
      .thawAccountIx({ mint: META, tokenAccount: funder1BaseAta })
      .instruction();
    const thawTx = new Transaction().add(thawIx);
    thawTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    thawTx.feePayer = freshThawer.publicKey;
    thawTx.sign(freshThawer);
    await this.banksClient.processTransaction(thawTx);

    assert.equal(
      await getTokenAccountState(this.banksClient, funder1BaseAta),
      TOKEN_STATE_INITIALIZED,
    );
  });
}
