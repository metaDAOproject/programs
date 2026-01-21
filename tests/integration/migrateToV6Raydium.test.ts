import "dotenv/config";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import { getAccount } from "spl-token-bankrun";
import {
  PERMISSIONLESS_ACCOUNT as PERMISSIONLESS_ACCOUNT_V6,
  MAINNET_USDC,
  getDaoAddr,
  DAMM_V2_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.6";
import {
  AutocratClient,
  AmmClient,
  getMetadataAddr,
  getLiquidityPoolAddr,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  PERMISSIONLESS_ACCOUNT,
  LaunchpadClient,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.5";
import { FutarchyClient as FutarchyClientV6 } from "@metadaoproject/futarchy/v0.6";
import * as token from "@solana/spl-token";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import { IDL as RaydiumMigrationHelperIDL } from "../../target/types/raydium_migration_helper.js";
import { getMetadataAccountDataSerializer } from "@metaplex-foundation/mpl-token-metadata";
import { createLookupTableForTransaction } from "../utils.js";
import { getSquadsPdasFromDao } from "../../scripts/utils/squads.js";

// Memo program ID for Raydium withdraw
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// Raydium Migration Helper program ID
const RAYDIUM_MIGRATION_HELPER_PROGRAM_ID = new PublicKey(
  "migR87BnBEkJbbDECLzRxhmNsQ44WMzhDCpCJhfPvR1",
);

const MIGRATION_METEORIA_CONFIG = new PublicKey(
  "5FSCTMuJcrsahe8nB7P3LooAYv5U5GNgBPY8JYjWKfHr",
);

// Helper functions for Meteora PDA derivation
function maxKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBuffer = left.toBuffer();
  const rightBuffer = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBuffer[i] > rightBuffer[i]) return leftBuffer;
    if (leftBuffer[i] < rightBuffer[i]) return rightBuffer;
  }
  return leftBuffer;
}

function minKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBuffer = left.toBuffer();
  const rightBuffer = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBuffer[i] < rightBuffer[i]) return leftBuffer;
    if (leftBuffer[i] > rightBuffer[i]) return rightBuffer;
  }
  return leftBuffer;
}

function getMeteoraPdas(baseMint: PublicKey, quoteMint: PublicKey) {
  // migration_signer PDA - used to sign for token transfers in Meteora CPI
  const [migrationSigner] = PublicKey.findProgramAddressSync(
    [Buffer.from("migration_signer"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  // position_nft_mint is seeded by our migration helper program
  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  // pool_creator_authority is seeded by our migration helper program
  const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("damm_pool_creator_authority")],
    RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
  );

  // pool is seeded by DAMM v2 program
  const [pool] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      MIGRATION_METEORIA_CONFIG.toBuffer(),
      maxKey(baseMint, quoteMint),
      minKey(baseMint, quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );

  // position_nft_account is seeded by DAMM v2 program
  const [positionNftAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // position is seeded by DAMM v2 program
  const [position] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // token_a_vault (base) is seeded by DAMM v2 program
  const [tokenAVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), baseMint.toBuffer(), pool.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // token_b_vault (quote) is seeded by DAMM v2 program
  const [tokenBVault] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), quoteMint.toBuffer(), pool.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // pool_authority is seeded by DAMM v2 program
  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("pool_authority")],
    DAMM_V2_PROGRAM_ID,
  );

  // damm_v2_event_authority is seeded by DAMM v2 program
  const [dammV2EventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    DAMM_V2_PROGRAM_ID,
  );

  return {
    migrationSigner,
    positionNftMint,
    poolCreatorAuthority,
    pool,
    positionNftAccount,
    position,
    tokenAVault,
    tokenBVault,
    poolAuthority,
    dammV2EventAuthority,
  };
}

/**
 * Test suite for V5 to V6 DAO migration with Raydium LP
 *
 * This tests the complete migration flow:
 * 1. Initialize V5 DAO and V6 DAO
 * 2. Create Raydium pool with DAO tokens
 * 3. Execute migration via Squads vault transaction including:
 *    - Withdraw Raydium LP tokens
 *    - Transfer all tokens from V5 vault to V6 vault
 *    - Transfer mint authority
 *    - Transfer metadata update authority
 */
export default async function suite() {
  let baseMint: PublicKey;
  let v5DaoAddress: PublicKey;
  let v6DaoAddress: PublicKey;
  let v5MultisigPda: PublicKey;
  let v5VaultPda: PublicKey;
  let v6MultisigPda: PublicKey;
  let v6VaultPda: PublicKey;
  let ammBaseVault: PublicKey;
  let ammQuoteVault: PublicKey;
  let futarchyV6: FutarchyClientV6;

  it("should perform complete V5 to V6 migration including Raydium LP withdrawal", async function () {
    // Initialize V6 futarchy client
    futarchyV6 = FutarchyClientV6.createClient({ provider: this.provider });

    // Setup Meteora config to accept our migration helper's pool_creator_authority
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    // discriminator + vault config authority
    const poolCreatorAuthorityOffset = 8 + 32;
    // discriminator + vault config authority + pool creator authority + pool fees config + activation type + collect fee mode
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [migrationPoolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      migrationPoolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(MIGRATION_METEORIA_CONFIG, dynamicConfig);
    console.log(
      "✓ Set up Meteora config with migration helper's pool_creator_authority:",
      migrationPoolCreatorAuthority.toBase58(),
    );

    console.log("\n=== SETUP: Creating funders ===");
    // Create multiple funders
    const funder1 = Keypair.generate();
    const funder2 = Keypair.generate();
    const funder3 = Keypair.generate();

    let META: PublicKey;
    let launch: PublicKey;
    let dao: PublicKey;

    const minRaise = new BN(600_000_000); // 600 USDC
    const launchPeriod = 60 * 60 * 24 * 2; // 2 days

    console.log("=== STEP 1: Initializing launch mint ===");

    // Create v0.5 launchpad client
    const launchpadClient = LaunchpadClient.createClient({
      provider: this.provider,
    });

    // Load the pre-ground keypair that ends in "meta" from environment variable
    if (!process.env.META_KEYPAIR) {
      throw new Error("META_KEYPAIR environment variable is required");
    }
    const metaMintKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.META_KEYPAIR)),
    );
    META = metaMintKeypair.publicKey;

    [launch] = getLaunchAddr(launchpadClient.getProgramId(), META);
    const [launchSigner] = getLaunchSignerAddr(
      launchpadClient.getProgramId(),
      launch,
    );

    console.log("✓ Using META mint:", META.toBase58());
    console.log("✓ Launch:", launch.toBase58());

    // Create and initialize the mint
    const rent = await this.banksClient.getRent();
    const lamports = Number(rent.minimumBalance(BigInt(token.MINT_SIZE)));

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: META,
        lamports,
        space: token.MINT_SIZE,
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(META, 6, launchSigner, null),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, metaMintKeypair);

    await this.banksClient.processTransaction(tx);
    console.log("✓ Mint initialized");

    console.log("\n=== STEP 2: Setting up funder token accounts ===");
    // Setup token accounts for funders
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);
    console.log("✓ Funder token accounts created");

    console.log("\n=== STEP 3: Minting USDC to funders ===");
    // Mint USDC to funders
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      5000_000_000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      3000_000_000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      4000_000_000,
    );
    console.log("✓ USDC transferred to funders");

    console.log("\n=== STEP 4: Initializing launch ===");
    // Initialize launch
    try {
      await launchpadClient
        .initializeLaunchIx(
          "META",
          "META",
          "https://example.com",
          minRaise,
          launchPeriod,
          META,
          MAINNET_USDC,
          new BN(100_000_000), // monthlySpendingLimitAmount - 100 USDC
          [this.payer.publicKey], // monthlySpendingLimitMembers
        )
        .rpc();
      console.log("✓ Launch initialized");
    } catch (e: any) {
      console.error("Failed to initialize launch:", e.message);
      console.error("Full error:", e);
      throw e;
    }

    console.log("\n=== STEP 5: Starting launch ===");
    // Start launch
    await launchpadClient.startLaunchIx(launch).rpc();
    console.log("✓ Launch started");

    console.log("\n=== STEP 6: Funding launch ===");
    // Fund from multiple sources
    await launchpadClient
      .fundIx(launch, new BN(5000_000000), funder1.publicKey, MAINNET_USDC)
      .signers([funder1])
      .rpc();
    console.log("✓ Funder1 contributed 5000 USDC");

    await launchpadClient
      .fundIx(launch, new BN(1500_000000), this.payer.publicKey, MAINNET_USDC)
      .rpc();
    console.log("✓ Payer contributed 1500 USDC");

    await launchpadClient
      .fundIx(launch, new BN(3500_000000), funder3.publicKey, MAINNET_USDC)
      .signers([funder3])
      .rpc();
    console.log("✓ Funder3 contributed 3500 USDC");

    console.log("\n=== STEP 7: Advancing time and completing launch ===");
    // Advance time and complete launch
    await this.advanceBySeconds(launchPeriod + 3600);
    console.log("✓ Time advanced");

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
      ])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const completeLaunchVersionedTx = new VersionedTransaction(
      completeLaunchMessage,
    );
    completeLaunchVersionedTx.sign([this.payer]);

    await this.banksClient.processTransaction(completeLaunchVersionedTx);
    console.log("✓ Launch completed");

    // Verify launch completion and DAO creation
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.exists(launchAccount.state.complete);
    assert.exists(launchAccount.dao);
    dao = launchAccount.dao;

    // this is where our script begins

    // Set V5 DAO addresses using same utility function as the script
    v5DaoAddress = dao;
    baseMint = META;
    const v5SquadsPdas = await getSquadsPdasFromDao(v5DaoAddress);
    v5MultisigPda = v5SquadsPdas.multisigPda;
    v5VaultPda = v5SquadsPdas.vaultPda;

    console.log("V5 DAO launched:", v5DaoAddress.toBase58());
    console.log("V5 Multisig:", v5MultisigPda.toBase58());
    console.log("V5 Vault:", v5VaultPda.toBase58());

    // Derive the Raydium pool created by completeLaunch
    const [raydiumPoolState] = getLiquidityPoolAddr(
      launchpadClient.getProgramId(),
      v5DaoAddress,
    );

    // Token ordering: smaller pubkey is token0
    const isBaseToken0 =
      baseMint.toBuffer().compare(MAINNET_USDC.toBuffer()) < 0;
    const token0Mint = isBaseToken0 ? baseMint : MAINNET_USDC;
    const token1Mint = isBaseToken0 ? MAINNET_USDC : baseMint;

    // Derive Raydium CPMM PDAs from the launchpad-created pool
    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_lp_mint"), raydiumPoolState.toBuffer()],
      RAYDIUM_CP_SWAP_PROGRAM_ID,
    );

    const [token0Vault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool_vault"),
        raydiumPoolState.toBuffer(),
        token0Mint.toBuffer(),
      ],
      RAYDIUM_CP_SWAP_PROGRAM_ID,
    );

    const [token1Vault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool_vault"),
        raydiumPoolState.toBuffer(),
        token1Mint.toBuffer(),
      ],
      RAYDIUM_CP_SWAP_PROGRAM_ID,
    );

    const vaultLpAta = token.getAssociatedTokenAddressSync(
      lpMint,
      v5VaultPda,
      true,
    );

    console.log(
      "Raydium Pool State (from launchpad):",
      raydiumPoolState.toBase58(),
    );
    console.log("Raydium LP Mint:", lpMint.toBase58());

    // Get LP balance from the vault (created by completeLaunch)
    const vaultLpBalance = await this.getTokenBalance(lpMint, v5VaultPda);
    console.log(
      "V5 Vault LP balance from launchpad:",
      vaultLpBalance.toString(),
    );

    // Claim tokens for all funders
    await launchpadClient.claimIx(launch, META, funder1.publicKey).rpc();

    await launchpadClient.claimIx(launch, META).rpc();

    await launchpadClient.claimIx(launch, META, funder3.publicKey).rpc();

    // Verify token distributions
    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    const payerBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);

    assert.equal(funder1Balance.toString(), "5000000000000"); // 5M tokens
    assert.equal(payerBalance.toString(), "1500000000000"); // 1.5M tokens
    assert.equal(funder3Balance.toString(), "3500000000000"); // 3.5M tokens

    console.log("\n=== INITIALIZING V6 DAO ===");

    const v6Nonce = new BN(Math.floor(Math.random() * 1000000));

    try {
      const txSig = await futarchyV6
        .initializeDaoIx({
          baseMint, // Shared mint between V5 launch and V6 DAO
          quoteMint: MAINNET_USDC,
          params: {
            nonce: v6Nonce,
            twapInitialObservation: new BN(1_000_000),
            twapMaxObservationChangePerUpdate: new BN(100_000),
            minBaseFutarchicLiquidity: new BN(10_000_000000),
            minQuoteFutarchicLiquidity: new BN(10_000_000000),
            twapStartDelaySeconds: 100,
            passThresholdBps: 300,
            secondsPerProposal: 60 * 60 * 24 * 3, // 3 days
            initialSpendingLimit: null,
            baseToStake: new BN(0),
            teamSponsoredPassThresholdBps: 300,
            teamAddress: this.payer.publicKey,
          },
          provideLiquidity: false,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
        ])
        .rpc();
      console.log("DAO initialization tx:", txSig);
    } catch (e: any) {
      console.error("DAO initialization failed:", e);
      throw e;
    }

    // from here is where the script starts

    // Derive V6 addresses
    [v6DaoAddress] = getDaoAddr({
      nonce: v6Nonce,
      daoCreator: this.payer.publicKey,
    });
    const v6MultisigPda = multisig.getMultisigPda({
      createKey: v6DaoAddress,
    })[0];
    const v6VaultPda = multisig.getVaultPda({
      multisigPda: v6MultisigPda,
      index: 0,
    })[0];

    console.log("V6 DAO initialized:", v6DaoAddress.toBase58());
    console.log("V6 Multisig:", v6MultisigPda.toBase58());
    console.log("V6 Vault:", v6VaultPda.toBase58());

    // Create token accounts for vaults and DAO AMM using idempotent instructions
    const v5VaultBaseAta = token.getAssociatedTokenAddressSync(
      baseMint,
      v5VaultPda,
      true,
    );
    const v5VaultQuoteAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      v5VaultPda,
      true,
    );
    const v6VaultBaseAta = token.getAssociatedTokenAddressSync(
      baseMint,
      v6VaultPda,
      true,
    );
    const v6VaultQuoteAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      v6VaultPda,
      true,
    );
    const ammBaseVault = token.getAssociatedTokenAddressSync(
      baseMint,
      v6DaoAddress,
      true,
    );
    const ammQuoteVault = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      v6DaoAddress,
      true,
    );

    // Get migration_signer PDA and its ATAs (needed for Meteora CPI)
    const meteoraPdasForAtas = getMeteoraPdas(baseMint, MAINNET_USDC);
    const migrationSignerBaseAta = token.getAssociatedTokenAddressSync(
      baseMint,
      meteoraPdasForAtas.migrationSigner,
      true,
    );
    const migrationSignerQuoteAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      meteoraPdasForAtas.migrationSigner,
      true,
    );

    const createAtasIx = [
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v5VaultBaseAta,
        v5VaultPda,
        baseMint,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v6VaultBaseAta,
        v6VaultPda,
        baseMint,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v5VaultQuoteAta,
        v5VaultPda,
        MAINNET_USDC,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v6VaultQuoteAta,
        v6VaultPda,
        MAINNET_USDC,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        ammBaseVault,
        v6DaoAddress,
        baseMint,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        ammQuoteVault,
        v6DaoAddress,
        MAINNET_USDC,
      ),
      // Migration signer ATAs (needed for Meteora CPI)
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        migrationSignerBaseAta,
        meteoraPdasForAtas.migrationSigner,
        baseMint,
      ),
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        migrationSignerQuoteAta,
        meteoraPdasForAtas.migrationSigner,
        MAINNET_USDC,
      ),
    ];

    const createAtasTx = new Transaction().add(...createAtasIx);
    createAtasTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createAtasTx.feePayer = this.payer.publicKey;
    createAtasTx.sign(this.payer);
    await this.banksClient.processTransaction(createAtasTx);

    // Transfer tokens to V5 vault (simulating existing treasury)
    const transferToV5Ix = token.createTransferInstruction(
      token.getAssociatedTokenAddressSync(baseMint, this.payer.publicKey, true),
      v5VaultBaseAta,
      this.payer.publicKey,
      100_000_000000, // 100k tokens
    );

    const transferToV5Tx = new Transaction().add(transferToV5Ix);
    transferToV5Tx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    transferToV5Tx.feePayer = this.payer.publicKey;
    transferToV5Tx.sign(this.payer);
    await this.banksClient.processTransaction(transferToV5Tx);

    console.log("V5 vault funded with 100k base tokens");
    console.log("=== SETUP COMPLETE ===\n");

    console.log("\n=== PHASE 1: Using Launchpad-Created Raydium Pool ===");
    console.log(
      "Pool already created by completeLaunch - using launchpad pool addresses",
    );

    // Add initial treasury funds to V5 vault (distinct from LP tokens)
    // These should be transferred to V6 vault ATAs after migration
    const initialTreasuryBase = 5_000_000_000; // 5k base tokens
    const initialTreasuryQuote = 10_000_000_000; // 10k USDC

    console.log("\n=== Adding initial treasury funds to V5 vault ===");

    // Create V5 vault ATAs if needed and transfer initial treasury
    // (v5VaultBaseAta and v5VaultQuoteAta already declared earlier)
    const payerBaseAta = token.getAssociatedTokenAddressSync(
      baseMint,
      this.payer.publicKey,
      true,
    );
    const payerQuoteAta = token.getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
      true,
    );

    const createV5BaseAtaIx =
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v5VaultBaseAta,
        v5VaultPda,
        baseMint,
      );
    const createV5QuoteAtaIx =
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        v5VaultQuoteAta,
        v5VaultPda,
        MAINNET_USDC,
      );

    const transferBaseToVaultIx = token.createTransferInstruction(
      payerBaseAta,
      v5VaultBaseAta,
      this.payer.publicKey,
      initialTreasuryBase,
    );

    const transferQuoteToVaultIx = token.createTransferInstruction(
      payerQuoteAta,
      v5VaultQuoteAta,
      this.payer.publicKey,
      initialTreasuryQuote,
    );

    const seedTreasuryTx = new Transaction().add(
      createV5BaseAtaIx,
      createV5QuoteAtaIx,
      transferBaseToVaultIx,
      transferQuoteToVaultIx,
    );
    seedTreasuryTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    seedTreasuryTx.feePayer = this.payer.publicKey;
    seedTreasuryTx.sign(this.payer);
    await this.banksClient.processTransaction(seedTreasuryTx);

    const v5BaseAfterSeed = await this.getTokenBalance(baseMint, v5VaultPda);
    const v5QuoteAfterSeed = await this.getTokenBalance(
      MAINNET_USDC,
      v5VaultPda,
    );
    console.log(
      "V5 vault treasury seeded - Base:",
      v5BaseAfterSeed.toString(),
      "Quote:",
      v5QuoteAfterSeed.toString(),
    );

    console.log("\n=== PHASE 2: Building Migration Vault Transaction ===");

    // Fund vault PDA with SOL for rent (futarchy provideLiquidity needs to create AMM position)
    const ammPositionRent = 1 * anchor.web3.LAMPORTS_PER_SOL; // 1 SOL should be enough for rent
    const fundVaultIx = SystemProgram.transfer({
      fromPubkey: this.payer.publicKey,
      toPubkey: v5VaultPda,
      lamports: ammPositionRent,
    });
    const fundVaultTx = new Transaction().add(fundVaultIx);
    fundVaultTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    fundVaultTx.feePayer = this.payer.publicKey;
    fundVaultTx.sign(this.payer);
    await this.banksClient.processTransaction(fundVaultTx);
    console.log(
      `Funded vault with ${ammPositionRent / anchor.web3.LAMPORTS_PER_SOL} SOL for rent`,
    );

    // Fund migration_signer PDA with SOL for Meteora pool creation rent
    const migrationSignerRent = 0.1 * anchor.web3.LAMPORTS_PER_SOL; // 0.1 SOL for rent
    const fundMigrationSignerIx = SystemProgram.transfer({
      fromPubkey: this.payer.publicKey,
      toPubkey: meteoraPdasForAtas.migrationSigner,
      lamports: migrationSignerRent,
    });
    const fundMigrationSignerTx = new Transaction().add(fundMigrationSignerIx);
    fundMigrationSignerTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    fundMigrationSignerTx.feePayer = this.payer.publicKey;
    fundMigrationSignerTx.sign(this.payer);
    await this.banksClient.processTransaction(fundMigrationSignerTx);
    console.log(
      `Funded migration_signer with ${migrationSignerRent / anchor.web3.LAMPORTS_PER_SOL} SOL for Meteora rent`,
    );

    // Get current balances
    const v5BaseBalanceBefore = await this.getTokenBalance(
      baseMint,
      v5VaultPda,
    );
    const v5QuoteBalanceBefore = await this.getTokenBalance(
      MAINNET_USDC,
      v5VaultPda,
    );

    console.log("V5 base balance before:", v5BaseBalanceBefore.toString());
    console.log("V5 quote balance before:", v5QuoteBalanceBefore.toString());
    console.log("V5 LP balance:", vaultLpBalance.toString());

    // Build vault transaction instructions
    const vaultInstructions: anchor.web3.TransactionInstruction[] = [];

    // Add compute budget instructions to vault transaction for Squads simulation
    // Need high compute: Raydium withdraw + futarchy provideLiquidity (creates AMM position) + Meteora pool creation
    vaultInstructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    );
    vaultInstructions.push(
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
    );

    // 1. Withdraw LP and transfer all tokens using helper program
    const helperProgram = new anchor.Program(
      RaydiumMigrationHelperIDL,
      RAYDIUM_MIGRATION_HELPER_PROGRAM_ID,
      this.provider,
    );

    // Get V6 futarchy AMM accounts
    // Note: position_authority is v6VaultPda - the V6 vault will own the AMM position
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        v6DaoAddress.toBuffer(),
        v6VaultPda.toBuffer(), // position_authority (the V6 vault owns the AMM position)
      ],
      futarchyV6.getProgramId(),
    );

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      futarchyV6.getProgramId(),
    );

    // Get Meteora DAMM v2 PDAs for the new pool creation
    const meteoraPdas = getMeteoraPdas(baseMint, MAINNET_USDC);
    console.log("  Meteora Pool PDA:", meteoraPdas.pool.toBase58());
    console.log(
      "  Meteora Position NFT Mint:",
      meteoraPdas.positionNftMint.toBase58(),
    );

    const withdrawAndProvideLiquidityIx = await helperProgram.methods
      .withdrawAndProvideLiquidity(
        new BN(vaultLpBalance.toString()),
        new BN(0), // min_raydium_amount_0 - no slippage protection for governance
        new BN(0), // min_raydium_amount_1
        new BN(0), // min_futarchy_liquidity
      )
      .accounts({
        vaultAuthority: v5VaultPda,
        // Migration signer accounts (needed for Meteora CPI)
        migrationSigner: meteoraPdas.migrationSigner,
        migrationSignerBaseAta: migrationSignerBaseAta,
        migrationSignerQuoteAta: migrationSignerQuoteAta,
        // Raydium accounts - from launchpad pool
        poolState: raydiumPoolState,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        lpMint: lpMint,
        vaultLpToken: vaultLpAta,
        vaultToken0: isBaseToken0 ? v5VaultBaseAta : v5VaultQuoteAta,
        vaultToken1: isBaseToken0 ? v5VaultQuoteAta : v5VaultBaseAta,
        poolToken0Vault: token0Vault,
        poolToken1Vault: token1Vault,
        // V6 Futarchy accounts
        dao: v6DaoAddress,
        baseMint: baseMint,
        quoteMint: MAINNET_USDC,
        ammPosition: ammPosition,
        ammBaseVault: ammBaseVault,
        ammQuoteVault: ammQuoteVault,
        v6VaultBaseAta: v6VaultBaseAta,
        v6VaultQuoteAta: v6VaultQuoteAta,
        v6VaultPda: v6VaultPda,
        eventAuthority: eventAuthority,
        // Meteora DAMM v2 accounts
        meteoraAccounts: {
          dammV2Program: DAMM_V2_PROGRAM_ID,
          config: MIGRATION_METEORIA_CONFIG,
          token2022Program: token.TOKEN_2022_PROGRAM_ID,
          positionNftAccount: meteoraPdas.positionNftAccount,
          pool: meteoraPdas.pool,
          position: meteoraPdas.position,
          positionNftMint: meteoraPdas.positionNftMint,
          baseMint: baseMint,
          quoteMint: MAINNET_USDC,
          tokenAVault: meteoraPdas.tokenAVault,
          tokenBVault: meteoraPdas.tokenBVault,
          poolCreatorAuthority: meteoraPdas.poolCreatorAuthority,
          poolAuthority: meteoraPdas.poolAuthority,
          dammV2EventAuthority: meteoraPdas.dammV2EventAuthority,
        },
        // Programs
        raydiumProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        futarchyProgram: futarchyV6.getProgramId(),
        tokenProgram: token.TOKEN_PROGRAM_ID,
        tokenProgram2022: token.TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        memoProgram: MEMO_PROGRAM_ID,
      })
      .instruction();

    console.log(
      "Instruction accounts:",
      withdrawAndProvideLiquidityIx.keys.map(
        (k) =>
          `${k.pubkey.toBase58()}: ${k.isSigner ? "signer" : ""} ${k.isWritable ? "writable" : "readonly"}`,
      ),
    );

    vaultInstructions.push(withdrawAndProvideLiquidityIx);
    console.log(
      "Added: Withdraw LP, provide liquidity to V6 AMM, transfer treasury",
    );

    // 4. Transfer mint authority
    vaultInstructions.push(
      token.createSetAuthorityInstruction(
        baseMint,
        v5VaultPda,
        token.AuthorityType.MintTokens,
        v6VaultPda,
      ),
    );
    console.log("Added: Transfer mint authority");

    // 5. Transfer metadata authority
    const [metadataAddr] = getMetadataAddr(baseMint);
    try {
      const metadataAccountInfo =
        await this.provider.connection.getAccountInfo(metadataAddr);
      if (metadataAccountInfo) {
        const metadataSerializer = getMetadataAccountDataSerializer();
        const [metadata] = metadataSerializer.deserialize(
          metadataAccountInfo.data,
        );
        const updateAuthority = new PublicKey(metadata.updateAuthority);

        if (updateAuthority.equals(v5VaultPda)) {
          // Manually construct metadata update instruction for bankrun
          // This is equivalent to updateMetadataAccountV2 but without UMI
          const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
            "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
          );

          const updateMetadataIx = new TransactionInstruction({
            programId: MPL_TOKEN_METADATA_PROGRAM_ID,
            keys: [
              { pubkey: metadataAddr, isSigner: false, isWritable: true },
              { pubkey: v5VaultPda, isSigner: true, isWritable: false },
            ],
            data: Buffer.from([
              // Discriminator for UpdateMetadataAccountV2 instruction
              15,
              // Data update (null = no change)
              0,
              // Update authority (Some(new_authority))
              1,
              ...v6VaultPda.toBytes(),
              // Primary sale happened (null = no change)
              0,
              // Is mutable (null = no change)
              0,
            ]),
          });

          vaultInstructions.push(updateMetadataIx);
          console.log("Added: Transfer metadata authority");
        }
      }
    } catch (e: any) {
      console.log("  ⚠ Could not check metadata authority:", e.message || e);
    }

    console.log("Total vault instructions:", vaultInstructions.length);

    // Step: Detailed instruction debugging
    console.log("\n=== DETAILED INSTRUCTION ANALYSIS ===");
    const uniqueProgramIds = new Set<string>();
    for (let i = 0; i < vaultInstructions.length; i++) {
      const ix = vaultInstructions[i];
      uniqueProgramIds.add(ix.programId.toBase58());
      console.log(`\n  Instruction ${i + 1}/${vaultInstructions.length}:`);
      console.log(`    Program ID: ${ix.programId.toBase58()}`);
      console.log(`    Data length: ${ix.data.length} bytes`);
      console.log(`    Accounts (${ix.keys.length}):`);
      ix.keys.forEach((key, idx) => {
        console.log(
          `      [${idx}] ${key.pubkey.toBase58()} ${key.isSigner ? "(signer)" : ""} ${key.isWritable ? "(writable)" : "(readonly)"}`,
        );
      });
    }

    // Verify all program IDs exist on-chain
    console.log("\n  Verifying program IDs exist on-chain...");
    for (const programId of uniqueProgramIds) {
      const programInfo = await this.provider.connection.getAccountInfo(
        new PublicKey(programId),
      );
      if (!programInfo) {
        throw new Error(`❌ Program ID ${programId} does not exist on-chain!`);
      }
      if (!programInfo.executable) {
        throw new Error(`❌ Program ID ${programId} is not executable!`);
      }
      console.log(`    ✓ ${programId} (executable)`);
    }

    // ==== TRANSACTION SIZE CHECK ====
    const tempTxForSize = new Transaction().add(...vaultInstructions);
    tempTxForSize.recentBlockhash = "11111111111111111111111111111111";
    tempTxForSize.feePayer = v5VaultPda;
    const uncompressedSize = tempTxForSize.serializeMessage().length;

    console.log("\n" + "=".repeat(70));
    console.log("📊 TRANSACTION SIZE ANALYSIS (Vault Transaction Message)");
    console.log("=".repeat(70));
    console.log(`Uncompressed size: ${uncompressedSize} bytes`);
    console.log(`Size limit:        1232 bytes`);
    if (uncompressedSize > 1232) {
      console.log(`❌ OVER LIMIT by ${uncompressedSize - 1232} bytes`);
    } else {
      console.log(`✅ UNDER LIMIT by ${1232 - uncompressedSize} bytes`);
    }

    // Break down by instruction
    console.log("\n📋 Instruction breakdown:");
    vaultInstructions.forEach((ix, idx) => {
      const singleIxTx = new Transaction().add(ix);
      singleIxTx.recentBlockhash = "11111111111111111111111111111111";
      singleIxTx.feePayer = v5VaultPda;
      const ixSize = singleIxTx.serializeMessage().length;
      console.log(`  [${idx}] ${ixSize} bytes - ${ix.keys.length} accounts`);
    });
    console.log("=".repeat(70));

    console.log("\n=== PHASE 3: Executing Migration via Squads ===");

    // Create lookup table to compress transaction
    const tempTx = new Transaction().add(...vaultInstructions);
    const migrationLut = await createLookupTableForTransaction(tempTx, this);
    console.log(
      "Migration LUT created with",
      migrationLut.state.addresses.length,
      "addresses",
    );

    // Debug: Check which accounts are in the LUT vs instruction
    const lutAddressSet = new Set(
      migrationLut.state.addresses.map((a) => a.toBase58()),
    );
    let missingFromLut = 0;
    for (const ix of vaultInstructions) {
      for (const key of ix.keys) {
        if (!lutAddressSet.has(key.pubkey.toBase58())) {
          console.log("  ⚠️ Account NOT in LUT:", key.pubkey.toBase58());
          missingFromLut++;
        }
      }
    }
    console.log(
      `  Total accounts in instructions: ${vaultInstructions.reduce((sum, ix) => sum + ix.keys.length, 0)}`,
    );
    console.log(`  Accounts missing from LUT: ${missingFromLut}`);

    // Create transaction message (don't compile to V0 - pass plain message + LUT separately to Squads)
    const transactionMessage = new TransactionMessage({
      payerKey: v5VaultPda,
      recentBlockhash: "",
      instructions: vaultInstructions,
    });

    // Get transaction index
    const v5MultisigAccount =
      await multisig.accounts.Multisig.fromAccountAddress(
        this.squadsConnection,
        v5MultisigPda,
      );
    const transactionIndex = BigInt(
      Number(v5MultisigAccount.transactionIndex) + 1,
    );

    // Create vault transaction with plain message + LUT accounts
    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
      multisigPda: v5MultisigPda,
      transactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: transactionMessage,
      addressLookupTableAccounts: [migrationLut],
    });

    console.log("\n📊 VaultTransactionCreate instruction:");
    console.log("  Accounts:", vaultTxCreateIx.keys.length);
    console.log("  Data size:", vaultTxCreateIx.data.length, "bytes");

    const vaultCreateTx = new Transaction().add(vaultTxCreateIx);
    vaultCreateTx.recentBlockhash = "11111111111111111111111111111111";
    vaultCreateTx.feePayer = this.payer.publicKey;
    const vaultCreateSize = vaultCreateTx.serializeMessage().length;
    console.log("  Total transaction size:", vaultCreateSize, "bytes");

    // Create proposal (no approve yet - that happens through autocrat)
    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: v5MultisigPda,
      transactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      isDraft: false,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda: v5MultisigPda,
      transactionIndex,
    });

    // Create Squads proposal
    const squadsTx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
    squadsTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    squadsTx.feePayer = this.payer.publicKey;

    const squadsTxSize = squadsTx.serializeMessage().length;
    console.log(
      "\n📊 Squads proposal transaction (create vault tx + proposal):",
    );
    console.log("  Size:", squadsTxSize, "bytes (limit: 1232)");
    if (squadsTxSize > 1232) {
      console.log("  ❌ OVER LIMIT by", squadsTxSize - 1232, "bytes");
    }

    squadsTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(squadsTx);

    console.log("Squads proposal created");

    // Create V5 autocrat and AMM clients
    const autocratV5Client = AutocratClient.createClient({
      provider: this.provider,
    });
    const ammV5Client = AmmClient.createClient({
      provider: this.provider,
    });

    // Initialize autocrat proposal
    // DAO requires min 100 tokens liquidity (100_000_000000 for base with 9 decimals, 100_000000 for quote with 6 decimals)
    console.log("\n📊 Creating autocrat proposal...");
    const proposal = await autocratV5Client.initializeProposal(
      v5DaoAddress,
      "Migration to V6",
      squadsProposalPda,
      new BN(100_000_000000), // baseAmount - 100 tokens
      new BN(100_000000), // quoteAmount - 100 USDC
    );
    console.log("Autocrat proposal created:", proposal.toBase58());

    // Get proposal PDAs
    const {
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      question,
      baseVault,
      quoteVault,
    } = autocratV5Client.getProposalPdas(
      proposal,
      baseMint,
      MAINNET_USDC,
      v5DaoAddress,
    );

    // Split tokens for the proposal markets (matching the liquidity requirements)
    await this.conditionalVault
      .splitTokensIx(question, baseVault, baseMint, new BN(100_000_000000), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, MAINNET_USDC, new BN(100_000000), 2)
      .rpc();

    console.log("Tokens split for conditional markets");

    // Trade in pass market to make proposal pass
    await ammV5Client
      .swapIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        { buy: {} },
        new BN(100_000000), // Buy 100 USDC worth
        new BN(0),
      )
      .rpc();

    console.log("Voted in favor of proposal");

    // Crank TWAP updates until proposal passes
    for (let i = 0; i < 100; i++) {
      await this.advanceBySlots(20_000n);

      await ammV5Client
        .crankThatTwapIx(passAmm)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
          await ammV5Client.crankThatTwapIx(failAmm).instruction(),
        ])
        .rpc();
    }

    console.log("Market resolved");

    // Finalize proposal (this approves the Squads proposal)
    await autocratV5Client.finalizeProposal(proposal);
    console.log("Autocrat proposal finalized - Squads proposal approved");

    // Execute vault transaction with high compute budget
    const executeIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda: v5MultisigPda,
      transactionIndex,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    console.log(
      "\n📊 Execute instruction has",
      executeIx.instruction.keys.length,
      "accounts",
    );

    // Build as V0 transaction with LUT to compress accounts
    const executeMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
        executeIx.instruction,
      ],
    }).compileToV0Message([migrationLut]);

    const executeV0Tx = new VersionedTransaction(executeMessage);
    const executeTxSize = executeV0Tx.message.serialize().length;
    console.log(
      "📊 Execute V0 transaction size (with LUT, before signing):",
      executeTxSize,
      "bytes",
    );
    console.log(
      "📊 After signing (~+128 bytes):",
      executeTxSize + 128,
      "bytes (limit: 1232)",
    );
    if (executeTxSize + 128 > 1232) {
      console.log(
        "❌ Execute transaction will be",
        executeTxSize + 128 - 1232,
        "bytes over limit after signing",
      );
    } else {
      console.log(
        "✅ Execute transaction under limit by",
        1232 - (executeTxSize + 128),
        "bytes after signing",
      );
    }

    executeV0Tx.sign([this.payer, PERMISSIONLESS_ACCOUNT]);
    await this.banksClient.processTransaction(executeV0Tx);

    console.log("Migration executed via Squads");

    console.log("\n=== PHASE 4: Verifying Migration Success ===");

    // Verify LP tokens burned
    const vaultLpBalanceAfter = await this.getTokenBalance(lpMint, v5VaultPda);
    assert.equal(vaultLpBalanceAfter, 0n, "LP tokens should be burned");
    console.log("✓ LP tokens burned");

    // Verify V5 vault empty
    const v5BaseBalanceAfter = await this.getTokenBalance(baseMint, v5VaultPda);
    const v5QuoteBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      v5VaultPda,
    );
    assert.equal(v5BaseBalanceAfter, 0n, "V5 vault should have no base tokens");
    assert.equal(
      v5QuoteBalanceAfter,
      0n,
      "V5 vault should have no quote tokens",
    );
    console.log("✓ V5 vault emptied");

    // Verify V6 vault has tokens
    const v6BaseBalanceAfter = await this.getTokenBalance(baseMint, v6VaultPda);
    const v6QuoteBalanceAfter = await this.getTokenBalance(
      MAINNET_USDC,
      v6VaultPda,
    );
    assert.ok(v6BaseBalanceAfter > 0n, "V6 vault should have base tokens");
    assert.ok(v6QuoteBalanceAfter > 0n, "V6 vault should have quote tokens");
    console.log("✓ V6 vault received tokens");
    console.log("  Base:", v6BaseBalanceAfter.toString());
    console.log("  Quote:", v6QuoteBalanceAfter.toString());

    // Verify mint authority transferred
    const mintInfo = await this.getMint(baseMint);
    assert.ok(
      mintInfo.mintAuthority && mintInfo.mintAuthority.equals(v6VaultPda),
      "Mint authority should be V6 vault",
    );
    console.log("✓ Mint authority transferred");

    // Verify Meteora pool was created with 10% of tokens
    const meteoraPdasVerify = getMeteoraPdas(baseMint, MAINNET_USDC);
    console.log("  Test derived pool:", meteoraPdasVerify.pool.toBase58());
    console.log(
      "  Test derived tokenAVault:",
      meteoraPdasVerify.tokenAVault.toBase58(),
    );
    console.log(
      "  Test derived tokenBVault:",
      meteoraPdasVerify.tokenBVault.toBase58(),
    );
    console.log("  baseMint:", baseMint.toBase58());
    console.log("  quoteMint (MAINNET_USDC):", MAINNET_USDC.toBase58());

    const meteoraPoolAccount = await this.banksClient.getAccount(
      meteoraPdasVerify.pool,
    );
    assert.ok(meteoraPoolAccount, "Meteora pool should exist");
    console.log(
      "✓ Meteora DAMM v2 pool created:",
      meteoraPdasVerify.pool.toBase58(),
    );

    // Check Meteora pool vaults have tokens (10% of withdrawn)
    // Note: Meteora vaults are PDAs (not ATAs), so we read them directly
    const meteoraBaseVaultAccount = await getAccount(
      this.banksClient,
      meteoraPdasVerify.tokenAVault,
    );
    const meteoraQuoteVaultAccount = await getAccount(
      this.banksClient,
      meteoraPdasVerify.tokenBVault,
    );
    const meteoraBaseVaultBalance = meteoraBaseVaultAccount.amount;
    const meteoraQuoteVaultBalance = meteoraQuoteVaultAccount.amount;
    console.log("  Meteora base vault:", meteoraBaseVaultBalance.toString());
    console.log("  Meteora quote vault:", meteoraQuoteVaultBalance.toString());

    // Calculate expected amounts (10% of what was withdrawn from Raydium)
    // Two-sided liquidity: both base and quote tokens should be in the pool
    assert.ok(
      meteoraBaseVaultBalance > 0n,
      "Meteora pool should have base tokens",
    );
    assert.ok(
      meteoraQuoteVaultBalance > 0n,
      "Meteora pool should have quote tokens",
    );
    console.log("✓ Meteora pool received 10% of both base and quote tokens");

    // Verify Futarchy AMM position was created with 90% of tokens
    const ammPositionAccount = await this.banksClient.getAccount(ammPosition);
    assert.ok(ammPositionAccount, "Futarchy AMM position should exist");
    console.log("✓ Futarchy AMM position created");

    // Check Futarchy AMM vaults have tokens (90% of withdrawn)
    // Note: AMM vaults are token accounts (not ATAs), so we read them directly
    const futarchyBaseVaultAccount = await getAccount(
      this.banksClient,
      ammBaseVault,
    );
    const futarchyQuoteVaultAccount = await getAccount(
      this.banksClient,
      ammQuoteVault,
    );
    const futarchyBaseVaultBalance = futarchyBaseVaultAccount.amount;
    const futarchyQuoteVaultBalance = futarchyQuoteVaultAccount.amount;
    console.log("  Futarchy base vault:", futarchyBaseVaultBalance.toString());
    console.log(
      "  Futarchy quote vault:",
      futarchyQuoteVaultBalance.toString(),
    );
    assert.ok(
      futarchyBaseVaultBalance > 0n,
      "Futarchy AMM should have base tokens",
    );
    assert.ok(
      futarchyQuoteVaultBalance > 0n,
      "Futarchy AMM should have quote tokens",
    );
    console.log("✓ Futarchy AMM received 90% of tokens");

    // Verify approximate 90/10 split (Meteora should have ~1/9th of Futarchy)
    // Allow some tolerance for rounding
    const meteoraTotal = meteoraBaseVaultBalance + meteoraQuoteVaultBalance;
    const futarchyTotal = futarchyBaseVaultBalance + futarchyQuoteVaultBalance;
    const ratio = Number(futarchyTotal) / Number(meteoraTotal);
    console.log(
      `  Split ratio (Futarchy/Meteora): ${ratio.toFixed(2)}x (expected ~9x)`,
    );
    assert.ok(
      ratio > 7 && ratio < 11,
      `Split ratio should be approximately 9:1, got ${ratio.toFixed(2)}`,
    );
    console.log("✓ 90/10 split verified");

    console.log(
      "\n✓✓✓ COMPLETE V5 TO V6 MIGRATION WITH RAYDIUM LP WITHDRAWAL + METEORA POOL CREATION SUCCESSFUL ✓✓✓",
    );
  });
}
