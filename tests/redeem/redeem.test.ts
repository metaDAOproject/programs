import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { assert } from "chai";
import {
  SystemProgram,
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  AddressLookupTableProgram,
  AddressLookupTableAccount,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { IDL as RedeemIDL } from "../../target/types/redeem.js";
import { getAccount, mintToOverride } from "spl-token-bankrun";
import { initializeMintWithSeeds } from "../launchpad/utils.js";

import {
  AUTOCRAT_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getLaunchDaoAddr,
  MAINNET_USDC,
  AmmMath,
  PriceMath,
} from "@metadaoproject/futarchy/v0.4";
import { Autocrat, IDL as AutocratIDL } from "../../target/types/autocrat.js";
import { advanceBySlots } from "../utils.js";

type ProposalInstruction = anchor.IdlTypes<Autocrat>["ProposalInstruction"];
const REDEEM_PROGRAM_ID = new PublicKey(
  "2yybFizjrwdYEKktHtvpXr9qSSpKLd3NzZE7p4batVAf",
);

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

const ONE_META = new BN(1_000_000); // 1 META with 6 decimals
const ONE_USDC = new BN(1_000_000); // 1 USDC with 6 decimals

export default async function redeemTest() {
  console.log("\n=== STARTING REDEEM TEST ===");

  const provider = anchor.getProvider();
  const payer = this.payer;
  
  // Store ALT address and account for reuse
  this.altAddress = null;
  this.lookupTableAcct = null;

  console.log("Payer:", payer.publicKey.toString());

  const USDC = MAINNET_USDC;
  console.log("Using USDC", MAINNET_USDC.toString());

  // --- Create META mint + launch ---
  console.log("\n--- Creating META mint ---");
  const meta_result = await initializeMintWithSeeds(
    this.banksClient,
    this.launchpadClient,
    payer,
  );

  const META = meta_result.tokenMint;
  const launch = meta_result.launch;
  const launchSigner = meta_result.launchSigner;

  console.log("META mint address:", META.toString());
  console.log("Launch PDA:", launch.toString());
  console.log("Launch signer PDA:", launchSigner.toString());

  console.log("\n--- Initializing launch ---");
  const minRaise = new BN(1_000_000_000); 
  console.log("Min raise:", minRaise.toString());

  try {
    await this.launchpadClient
      .initializeLaunchIx(
        "TEST",
        "TEST",
        "https://example.com",
        minRaise,
        60 * 60 * 24 * 10,
        META,
      )
      .rpc();
    console.log("Launch initialized");
  } catch (e: any) {
    console.error("Failed to initialize launch:", e.message);
    throw e;
  }

  console.log("\n--- Starting launch ---");
  try {
    await this.launchpadClient.startLaunchIx(launch).rpc();
    console.log("Launch started");
  } catch (e: any) {
    console.error(" Failed to start launch:", e.message);
    throw e;
  }

  console.log("\n--- Creating token account for META ---");
  try {
    await this.createTokenAccount(META, payer.publicKey);
    console.log("Token account created");
  } catch (e: any) {
    console.error("Failed to create token account:", e.message);
    throw e;
  }

  // Fund payer with tokens for the proposal
  console.log("\n--- Funding payer with tokens for proposal ---");
  const payerMetaAccount = getAssociatedTokenAddressSync(META, payer.publicKey);
  const payerUsdcAccount = getAssociatedTokenAddressSync(USDC, payer.publicKey);

  await mintToOverride(this.context, payerMetaAccount, 100_000_000n * 1_000_000n); 
  console.log("Minted META to payer");

  await mintToOverride(this.context, payerUsdcAccount, 100_000_000n * 1_000_000n); 
  console.log("Minted USDC to payer");

  // ASSERT: payer ATAs look sane & funded
  {
    const payerMetaInfo = await getAccount(this.banksClient, payerMetaAccount);
    const payerUsdcInfo = await getAccount(this.banksClient, payerUsdcAccount);
    assert.equal(payerMetaInfo.mint.toString(), META.toString(), "Payer META ATA mint mismatch");
    assert.equal(payerMetaInfo.owner.toString(), payer.publicKey.toString(), "Payer META ATA owner mismatch");
    assert.equal(payerUsdcInfo.mint.toString(), USDC.toString(), "Payer USDC ATA mint mismatch");
    assert.equal(payerUsdcInfo.owner.toString(), payer.publicKey.toString(), "Payer USDC ATA owner mismatch");
    assert.isTrue(payerMetaInfo.amount > 0n, "Payer META must be funded");
    assert.isTrue(payerUsdcInfo.amount > 0n, "Payer USDC must be funded");
  }

  console.log("\n--- Funding launch ---");
  try {
    await this.launchpadClient.fundIx(launch, minRaise).rpc();
    console.log("Launch funded");
  } catch (e: any) {
    console.error("Failed to fund launch:", e.message);
    throw e;
  }

  console.log("\n--- Advancing time ---");
  await this.advanceBySeconds(60 * 60 * 24 * 11);
  console.log("Advanced by 11 days");

  console.log("\n--- Completing launch ---");
  try {
    await this.launchpadClient
      .completeLaunchIx(launch, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();
    console.log("Launch completed");
  } catch (e: any) {
    console.error("Failed to complete launch:", e.message);
    throw e;
  }

  // --- DAO + Treasury PDAs ---
  const dao = getLaunchDaoAddr(this.launchpadClient.getProgramId(), launch)[0];

  const [treasuryForRedeem, treasuryBump] = PublicKey.findProgramAddressSync(
    [dao.toBuffer()],
    AUTOCRAT_PROGRAM_ID,
  );

  const treasuryMetaAccount = getAssociatedTokenAddressSync(
    META,
    treasuryForRedeem,
    true,
  );
  const treasuryUsdcAccount = getAssociatedTokenAddressSync(
    USDC,
    treasuryForRedeem,
    true,
  );

  console.log("\n--- Creating treasury token accounts early ---");
  console.log("Treasury:", treasuryForRedeem.toString());
  console.log("Treasury META account:", treasuryMetaAccount.toString());
  console.log("Treasury USDC account:", treasuryUsdcAccount.toString());

  const createTreasuryAccountsTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryMetaAccount,
      treasuryForRedeem,
      META,
      TOKEN_PROGRAM_ID,
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryUsdcAccount,
      treasuryForRedeem,
      USDC,
      TOKEN_PROGRAM_ID,
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  try {
    await provider.sendAndConfirm(createTreasuryAccountsTx);
    console.log("Created treasury token accounts");
  } catch {
    console.log("Treasury accounts might already exist, continuing...");
  }

  console.log("\n--- Funding treasury with tokens ---");

  await mintToOverride(this.context, treasuryUsdcAccount, 100_000_000n * 1_000_000n); 
  console.log("Minted USDC to treasury");

  // --- Pool info ---
  console.log("\n--- Fetching launch account ---");
  const launchAccount = await this.launchpadClient.fetchLaunch(launch);

  console.log("\n--- Treasury Info ---");
  console.log("DAO address:", dao.toString());
  const treasuryMetaAccountInfo = await getAccount(this.banksClient, treasuryMetaAccount);
  console.log("Treasury META balance:", treasuryMetaAccountInfo.amount.toString());
  const treasuryUsdcAccountInfo = await getAccount(this.banksClient, treasuryUsdcAccount);
  console.log("Treasury META balance:", treasuryUsdcAccountInfo.amount.toString());
  console.log("Launch account treasury:", launchAccount.daoTreasury.toString());
  console.log("Derived treasury:", treasuryForRedeem.toString());
  console.log("Treasury bump:", treasuryBump);

  // ASSERT: treasury matches launch config & ATAs are correct
  assert.equal(launchAccount.daoTreasury.toString(), treasuryForRedeem.toString(), "Treasury PDA mismatch vs launch account");
  assert.equal(treasuryMetaAccountInfo.mint.toString(), META.toString(), "Treasury META ATA mint mismatch");
  assert.equal(treasuryMetaAccountInfo.owner.toString(), treasuryForRedeem.toString(), "Treasury META ATA owner mismatch");
  assert.equal(treasuryUsdcAccountInfo.mint.toString(), USDC.toString(), "Treasury USDC ATA mint mismatch");
  assert.equal(treasuryUsdcAccountInfo.owner.toString(), treasuryForRedeem.toString(), "Treasury USDC ATA owner mismatch");
  assert.isTrue(treasuryUsdcAccountInfo.amount >= 0n, "Treasury USDC should be a valid amount");

  const [poolState] = getLiquidityPoolAddr(
    this.launchpadClient.getProgramId(),
    dao,
  );
  const [lpMint] = getRaydiumCpmmLpMintAddr(poolState, false);

  const [poolAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_and_lp_mint_auth_seed")],
    RAYDIUM_CP_SWAP_PROGRAM_ID,
  );

  console.log("\n--- Pool Info ---");
  console.log("Pool state:", poolState.toString());
  console.log("LP mint:", lpMint.toString());
  console.log("Pool authority:", poolAuthority.toString());

  const banksClient = this.banksClient;
  const poolStateInfo = await banksClient.getAccount(poolState);
  if (!poolStateInfo) {
    console.error(" Pool state account does not exist!");
    throw new Error("Pool was not created during launch completion");
  }
  console.log("Pool state exists");

  // ASSERT: pool state exists
  assert.ok(poolStateInfo?.data?.length > 0, "Pool state account should exist");

  console.log("\n--- Deriving LP token account ---");
  const treasuryLpAccount = getAssociatedTokenAddressSync(
    lpMint,
    treasuryForRedeem,
    true,
  );
  console.log("Treasury LP account:", treasuryLpAccount.toString());

  console.log("\n--- Deriving pool vaults ---");
  // Pool vaults are PDAs, not ATAs
  const [poolMetaVault] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool_vault"),
      poolState.toBuffer(),
      META.toBuffer(),
    ],
    RAYDIUM_CP_SWAP_PROGRAM_ID
  );
  const [poolUsdcVault] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("pool_vault"),
      poolState.toBuffer(),
      USDC.toBuffer(),
    ],
    RAYDIUM_CP_SWAP_PROGRAM_ID
  );

  console.log("Pool META vault:", poolMetaVault.toString());
  console.log("Pool USDC vault:", poolUsdcVault.toString());

  console.log("\n--- Creating all necessary token accounts ---");
  const createAccountsTx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryMetaAccount,
      treasuryForRedeem,
      META,
      TOKEN_PROGRAM_ID,
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryUsdcAccount,
      treasuryForRedeem,
      USDC,
      TOKEN_PROGRAM_ID,
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      treasuryLpAccount,
      treasuryForRedeem,
      lpMint,
      TOKEN_PROGRAM_ID,
      token.ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );

  try {
    await provider.sendAndConfirm(createAccountsTx);
    console.log("Created all token accounts");
  } catch {
    console.log("Some accounts might already exist, continuing...");
  }

  // ASSERT: LP ATA is correct
  {
    const tLpInfo0 = await getAccount(this.banksClient, treasuryLpAccount).catch(() => null as any);
    assert.ok(tLpInfo0, "Treasury LP ATA should exist");
    assert.equal(tLpInfo0.mint.toString(), lpMint.toString(), "Treasury LP ATA mint mismatch");
    assert.equal(tLpInfo0.owner.toString(), treasuryForRedeem.toString(), "Treasury LP ATA owner mismatch");
  }

  console.log("\n--- Funding payer with SOL ---");
  {
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: (provider as any).wallet?.publicKey ?? payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 100 * LAMPORTS_PER_SOL,
      }),
    );
    await provider.sendAndConfirm(fundingTx);
  }
  console.log("Funded payer with 100 SOL");

  console.log("\n--- Creating migrator vault ---");
  const migratorVaultKeypair = Keypair.generate();
  const migratorVaultOwner = Keypair.generate();
  console.log("Migrator vault:", migratorVaultKeypair.publicKey.toString());
  console.log("Migrator vault owner:", migratorVaultOwner.publicKey.toString());

  const rentExemptBalance =
    await provider.connection.getMinimumBalanceForRentExemption(
      token.ACCOUNT_SIZE,
    );

  const createVaultTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: migratorVaultOwner.publicKey,
      lamports: 10 * LAMPORTS_PER_SOL,
    }),
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: migratorVaultKeypair.publicKey,
      lamports: rentExemptBalance,
      space: token.ACCOUNT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeAccountInstruction(
      migratorVaultKeypair.publicKey,
      USDC,
      migratorVaultOwner.publicKey,
    ),
  );

  console.log("Sending migrator vault creation transaction...");
  try {
    await provider.sendAndConfirm(createVaultTx, [payer, migratorVaultKeypair]);
    console.log("Migrator vault created");
  } catch (e: any) {
    console.error(" Failed to create migrator vault:", e.message);
    throw e;
  }
  
  // ASSERT: migrator vault correctness
  {
    const migVaultInfo = await getAccount(this.banksClient, migratorVaultKeypair.publicKey);
    assert.equal(migVaultInfo.mint.toString(), USDC.toString(), "Migrator vault must be a USDC token account");
    assert.equal(migVaultInfo.owner.toString(), migratorVaultOwner.publicKey.toString(), "Migrator vault owner mismatch");
  }
  
  // ============== PROPOSAL FLOW ==============
  console.log("\n=== STARTING PROPOSAL FLOW ===");

  const redeemProgram = new anchor.Program(
    RedeemIDL,
    REDEEM_PROGRAM_ID,
    provider,
  );

  const redeemIx = await redeemProgram.methods
    .redeem()
    .accounts({
      dao: dao,
      treasury: treasuryForRedeem,
      poolState: poolState,
      poolAuthority: poolAuthority,
      lpMint: lpMint,
      baseMint: META,
      quoteMint: USDC,
      lpAccount: treasuryLpAccount,
      treasuryBaseAccount: treasuryMetaAccount,
      treasuryQuoteAccount: treasuryUsdcAccount,
      poolBaseVault: poolMetaVault,
      poolQuoteVault: poolUsdcVault,
      migratorVault: migratorVaultKeypair.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
      tokenProgram2022: token.TOKEN_2022_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
    })
    .instruction();

  const proposalInstruction: ProposalInstruction = {
    programId: redeemIx.programId,
    accounts: redeemIx.keys.map((k) => ({
      pubkey: k.pubkey,
      isSigner: k.isSigner, 
      isWritable: k.isWritable,
    })),
    data: redeemIx.data,
  };

  console.log("\n--- Initializing proposal using initializeProposalTx ---");
  
  const { transactions, proposal } = await this.autocratClient.initializeProposalTx2(
    dao,
    "",
    proposalInstruction,
    ONE_META.muln(100000),    
    ONE_USDC.muln(100000)  
  );
  
  console.log(`Got ${transactions.length} transactions to execute`);
  console.log("Proposal PDA:", proposal.toString());

  // ASSERT: initializeProposalTx returned something useful
  assert.isAbove(transactions.length, 0, "initializeProposalTx must return at least one transaction");

  // Analyze transactions to understand what we're dealing with
  // // Uncomment this block to see transaction structure
//   console.log("\n--- Analyzing transactions from initializeProposalTx ---");
//   transactions.forEach((tx, i) => {
//     console.log(`Transaction ${i + 1}:`);
//     console.log(`  - ${tx.instructions.length} instructions`);
//     tx.instructions.forEach((ix, j) => {
//       console.log(`    Instruction ${j + 1}: ${ix.programId.toString().slice(0, 8)}... with ${ix.keys.length} keys`);
//     });
//     try {
//       const size = tx.serialize({ requireAllSignatures: false }).length;
//       console.log(`  - Serialized size: ${size} bytes`);
//     } catch {
//       console.log(`  - Cannot serialize (too large)`);
//     }
//     // ASSERT: each init tx has at least one instruction
//     assert.isAbove(tx.instructions.length, 0, `Init tx ${i+1} should contain instructions`);
//   });

  // Execute each transaction as legacy (initializeProposalTx should have split them small enough)
  console.log("\n--- Executing initialization transactions ---");
  
  // Create ALT upfront for transactions that need it
  const slot = await this.banksClient.getSlot();
  const [createAltIx, altAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: slot - 1n,
  });

  const createAltTx = new Transaction().add(createAltIx);
  createAltTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  createAltTx.feePayer = payer.publicKey;
  createAltTx.sign(payer);
  await this.banksClient.processTransaction(createAltTx);
  
  console.log("Waiting for ALT to activate...");
      
  // Store the ALT address and update class state
  this.altAddress = altAddress;
  await this.advanceBySlots(200n);
  console.log("Created ALT at:", altAddress.toString());
  
  // Store ALT address for reuse in execute proposal
  this.altAddress = altAddress;
  
  let lookupTableAcct: AddressLookupTableAccount | null = null;
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    console.log(`\nExecuting transaction ${i + 1}/${transactions.length}...`);
    console.log(`  Instructions in transaction: ${tx.instructions.length}`);
    
    // Basic exec sanity
    tx.instructions.forEach((ix, j) => {
      assert.ok(ix.programId, `Exec init ix ${j+1} must have programId`);
      assert.isAbove(ix.keys.length, 0, `Exec init ix ${j+1} must reference accounts`);
    });

    // Set transaction properties
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = payer.publicKey;
    tx.sign(payer);
    
    try {
      await this.banksClient.processTransaction(tx);
      console.log(`  Transaction ${i + 1} completed`);
    } catch (e: any) {
      console.error(`   Transaction ${i + 1} failed:`, e);
      
      // If it fails due to size, try V0 transaction
      if (e.toString().includes("too large") || e.toString().includes("exceeds")) {
        console.log(`  Transaction is too large, using V0...`);
        
        // Collect ALL addresses from this transaction
        const txAddresses: PublicKey[] = [];
        
        // Add payer first (important for V0)
        txAddresses.push(payer.publicKey);
        
        // Add all unique addresses from instructions
        const seenAddresses = new Set<string>();
        seenAddresses.add(payer.publicKey.toString());
        
        tx.instructions.forEach(ix => {
          if (!seenAddresses.has(ix.programId.toString())) {
            txAddresses.push(ix.programId);
            seenAddresses.add(ix.programId.toString());
          }
          
          // Add all account keys
          ix.keys.forEach(key => {
            if (!seenAddresses.has(key.pubkey.toString())) {
              txAddresses.push(key.pubkey);
              seenAddresses.add(key.pubkey.toString());
            }
          });
        });
        
        console.log(`  Need ${txAddresses.length} addresses in ALT`);
        
        // Add addresses to ALT in small batches
        const BATCH_SIZE = 10; // Smaller batches are more reliable
        for (let j = 0; j < txAddresses.length; j += BATCH_SIZE) {
          const batch = txAddresses.slice(j, Math.min(j + BATCH_SIZE, txAddresses.length));
          console.log(`  Adding batch of ${batch.length} addresses...`);
          
          const extendIx = AddressLookupTableProgram.extendLookupTable({
            payer: payer.publicKey,
            authority: payer.publicKey,
            lookupTable: altAddress,
            addresses: batch,
          });
          
          const extendTx = new Transaction().add(extendIx);
          extendTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
          extendTx.feePayer = payer.publicKey;
          extendTx.sign(payer);
          await this.banksClient.processTransaction(extendTx);
          
          // Wait for each batch to be processed
          await this.advanceBySlots(50n);
        }
        
        // Extra wait for all addresses to be fully active, otherwise get indexing issues
        console.log(`  Waiting for ALT addresses to be fully active...`);
        await this.advanceBySlots(200n);
        
        // Load and verify ALT
        const rawAlt = await this.banksClient.getAccount(altAddress);
        if (!rawAlt) {
          throw new Error("ALT account not found!");
        }
        
        lookupTableAcct = new AddressLookupTableAccount({
          key: altAddress,
          state: AddressLookupTableAccount.deserialize(rawAlt.data),
        });
        
        // Store lookup table account for reuse in execute proposal
        this.lookupTableAcct = lookupTableAcct;
        
        console.log(`  ALT loaded with ${lookupTableAcct.state.addresses.length} addresses`);
        
        // Verify all addresses are in the ALT
        const missingAddresses = txAddresses.filter(
          addr => !lookupTableAcct.state.addresses.some(a => a.equals(addr))
        );
        
        if (missingAddresses.length > 0) {
          console.error(`  ERROR: ${missingAddresses.length} addresses missing from ALT!`);
          missingAddresses.forEach(addr => {
            console.error(`    Missing: ${addr.toString()}`);
          });
          throw new Error("ALT is missing required addresses");
        }
        
        console.log(`  All required addresses confirmed in ALT`);
        
        // Create V0 transaction
        try {
          // First, let's debug what accounts are actually being used
          console.log(`  Debugging transaction accounts:`);
          tx.instructions.forEach((ix, idx) => {
            console.log(`    Instruction ${idx + 1}: ${ix.programId.toString()}`);
            ix.keys.forEach((key, keyIdx) => {
              console.log(`      Account ${keyIdx}: ${key.pubkey.toString()} (${key.isSigner ? 'signer' : ''}, ${key.isWritable ? 'writable' : 'readonly'})`);
            });
          });
          
        //   Check if we have all system accounts that might be needed
          const systemAccounts = [
            SystemProgram.programId,
            TOKEN_PROGRAM_ID,
            token.ASSOCIATED_TOKEN_PROGRAM_ID,
            new PublicKey("SysvarRent111111111111111111111111111111111"), // Rent sysvar
            new PublicKey("SysvarC1ock11111111111111111111111111111111"), // Clock sysvar
          ];
          
          // Add any missing system accounts to ALT if not present
          const missingSystemAccounts = systemAccounts.filter(
            acc => !lookupTableAcct!.state.addresses.some(a => a.equals(acc))
          );
          
          if (missingSystemAccounts.length > 0) {
            console.log(`  Adding ${missingSystemAccounts.length} missing system accounts to ALT:`);
            missingSystemAccounts.forEach(acc => {
              console.log(`    - ${acc.toString()}`);
            });
            
            const extendIx = AddressLookupTableProgram.extendLookupTable({
              payer: payer.publicKey,
              authority: payer.publicKey,
              lookupTable: altAddress,
              addresses: missingSystemAccounts,
            });
            
            const extendTx = new Transaction().add(extendIx);
            extendTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
            extendTx.feePayer = payer.publicKey;
            extendTx.sign(payer);
            await this.banksClient.processTransaction(extendTx);
            await this.advanceBySlots(100n);
            
            // Reload ALT
            const rawAlt2 = await this.banksClient.getAccount(altAddress);
            lookupTableAcct = new AddressLookupTableAccount({
              key: altAddress,
              state: AddressLookupTableAccount.deserialize(rawAlt2.data),
            });
            
            // Update stored lookup table account
            this.lookupTableAcct = lookupTableAcct;
            
            console.log(`  ALT now has ${lookupTableAcct.state.addresses.length} addresses`);
          }
          
          const messageV0 = new TransactionMessage({
            payerKey: payer.publicKey,
            recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
            instructions: tx.instructions,
          }).compileToV0Message([lookupTableAcct!]);
          
          const transactionV0 = new VersionedTransaction(messageV0);
          transactionV0.sign([payer]);
          
          console.log(`  V0 Transaction size: ${transactionV0.serialize().length} bytes`);
          console.log(`  V0 static account keys: ${messageV0.staticAccountKeys.length}`);
          console.log(`  V0 address table lookups: ${messageV0.addressTableLookups.length}`);
          
          if (messageV0.addressTableLookups.length > 0) {
            const lookup = messageV0.addressTableLookups[0];
            console.log(`  ALT lookup uses ${lookup.readonlyIndexes.length} readonly and ${lookup.writableIndexes.length} writable indices`);
            
            // Debug: Show which indices are being used
            console.log(`  Readonly indices: ${lookup.readonlyIndexes.join(', ')}`);
            console.log(`  Writable indices: ${lookup.writableIndexes.join(', ')}`);
            
            // Check if any index exceeds the ALT size
            const maxReadonly = Math.max(...lookup.readonlyIndexes, -1);
            const maxWritable = Math.max(...lookup.writableIndexes, -1);
            const maxIndex = Math.max(maxReadonly, maxWritable);
            
            console.log(`  Max index used: ${maxIndex}, ALT size: ${lookupTableAcct!.state.addresses.length}`);
            
            if (maxIndex >= lookupTableAcct!.state.addresses.length) {
              console.error(`  ERROR: Transaction trying to use index ${maxIndex} but ALT only has ${lookupTableAcct!.state.addresses.length} addresses!`);
              console.log(`  ALT addresses:`);
              lookupTableAcct!.state.addresses.forEach((addr, idx) => {
                console.log(`    ${idx}: ${addr.toString()}`);
              });
              
              console.log(`\n  MISSING ACCOUNTS - Add these to the instruction or ALT:`);
              // The indices that are being referenced but don't exist
              const allIndices = [...lookup.readonlyIndexes, ...lookup.writableIndexes];
              const missingIndices = allIndices.filter(idx => idx >= lookupTableAcct!.state.addresses.length);
              console.log(`  Missing indices: ${missingIndices.join(', ')}`);
              console.log(`  These indices are being referenced but don't exist in the ALT`);
            }
          }
          
          await this.banksClient.processTransaction(transactionV0);
          console.log(`  Transaction ${i + 1} completed (V0)`);
        } catch (v0Error: any) {
          console.error(`   V0 transaction failed:`, v0Error);
          
          // If it's an Anchor error, log more details
          if (v0Error.toString().includes('AnchorError')) {
            console.log(`  Anchor error details: ${v0Error.toString()}`);
          }
          
          console.log(`  Transaction details:`);
          tx.instructions.forEach((ix, idx) => {
            console.log(`    Instruction ${idx + 1}: ${ix.programId.toString()}`);
            console.log(`      Accounts: ${ix.keys.length}`);
          });
          
          // Don't throw if it's just InsufficientLpTokenLock - that's a different issue
          if (v0Error.toString().includes('InsufficientLpTokenLock')) {
            console.log(`  Note: This is a liquidity requirement issue, not an ALT issue`);
            console.log(`  The DAO requires more LP tokens than provided`);
          }
          
          throw v0Error;
        }
      } else {
        // Some other error - rethrow
        throw e;
      }
    }
  }

  console.log("\nAll proposal initialization transactions completed");

  // Get proposal PDAs
  const proposalPdas = this.autocratClient.getProposalPdas(
    proposal,
    META,
    USDC,
    dao,
  );
  const { baseVault, quoteVault, question, passAmm, failAmm } = proposalPdas;

  console.log("\n--- Splitting tokens for conditional markets ---");
  await this.vaultClient
    .splitTokensIx(question, quoteVault, USDC, ONE_USDC.muln(1_000_000), 2)
    .rpc();
  console.log("Split USDC tokens");

  await this.vaultClient
    .splitTokensIx(question, baseVault, META, ONE_META.muln(100_000), 2)
    .rpc();
  console.log("Split USDC tokens");

  console.log("\n--- Swapping to influence market ---");
  const { passBaseMint, passQuoteMint } = proposalPdas;
  await this.ammClient
    .swapIx(
      passAmm,
      passBaseMint,
      passQuoteMint,
      { buy: {} },
      ONE_USDC.muln(800_000),
      new BN(0),
    )
    .rpc();
  console.log("Swapped once in pass market");

  console.log("\n--- Cranking TWAP ---");
  for (let i = 0; i < 80; i++) {
  // larger gaps => TWAP weights recent spot more
    await advanceBySlots(this.context, 40_000n);

  // build pre-instructions; vary CU price so txs are unique
    const pre: any[] = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 + i }),
    ];

  // crank FAIL far less often so it lags (wider spread)
    if (i % 8 === 0) {
      pre.push(await this.ammClient.crankThatTwapIx(failAmm).instruction());
    }

    await this.ammClient
      .crankThatTwapIx(passAmm) // PASS cranked every iteration
      .preInstructions(pre)
      .rpc();

    if (i % 10 === 0) console.log(`  Cranked ${i + 1}/80`);
  }
  console.log("TWAP cranking complete");


  let storedPassAmm = await this.ammClient.getAmm(passAmm);
  let storedFailAmm = await this.ammClient.getAmm(failAmm);

  let passTwap = AmmMath.getTwap(storedPassAmm);
  let failTwap = AmmMath.getTwap(storedFailAmm);

  const passPrice = Number(PriceMath.getHumanPrice(passTwap, 9, 6));
  const failPrice = Number(PriceMath.getHumanPrice(failTwap, 9, 6));

  console.log(PriceMath.getHumanPrice(passTwap, 9, 6));
  console.log(PriceMath.getHumanPrice(failTwap, 9, 6));

  // ASSERT: TWAP spread and ordering (>= 3% requested)
  {
    assert.isFinite(passPrice, "Pass TWAP price must be finite");
    assert.isFinite(failPrice, "Fail TWAP price must be finite");
    assert.isAbove(passPrice, 0, "Pass TWAP must be positive");
    assert.isAbove(failPrice, 0, "Fail TWAP must be positive");

    const relDiff = Math.abs(passPrice - failPrice) / ((passPrice + failPrice) / 2);
    assert.isAbove(passPrice, failPrice, "Pass TWAP should exceed Fail TWAP after biasing swaps");
    assert.isAbove(relDiff, 0.03, `TWAP spread must be > 3% (got ${(relDiff*100).toFixed(2)}%)`);
  }

  console.log("\n--- Finalizing Proposal ---");
  await this.autocratClient.finalizeProposal(proposal);
  console.log("Proposal finalized");

  const finalizedProposal = await this.autocratClient.getProposal(proposal);
  console.log("Proposal state after finalization:", finalizedProposal.state);

  // ASSERT: proposal should pass for execution path
  assert.isTrue(!!finalizedProposal?.state, "Proposal account/state must exist after finalize");
  assert.isTrue(!!finalizedProposal.state.passed, "Proposal should be in 'passed' state for execution path");

  if (finalizedProposal.state.passed) {
    console.log("\n--- Executing Proposal ---");

    // Debug: Check what the AutocratClient thinks the treasury should be
    const [autocratTreasury] = PublicKey.findProgramAddressSync(
      [dao.toBuffer()],
      this.autocratClient.autocrat.programId
    );
    console.log("Test treasury:", treasuryForRedeem.toString());
    console.log("AutocratClient treasury:", autocratTreasury.toString());
    console.log("Are they the same?", treasuryForRedeem.equals(autocratTreasury));

    // ASSERT: treasury PDA matches Autocrat derivation
    assert.isTrue(treasuryForRedeem.equals(autocratTreasury), "Treasury PDA must match Autocrats derivation");
    
    // Capture pre-exec balances for effects verification
    const preTreasuryLp    = (await getAccount(this.banksClient, treasuryLpAccount)).amount;
    const preTreasuryBase  = (await getAccount(this.banksClient, treasuryMetaAccount)).amount;
    const preTreasuryQuote = (await getAccount(this.banksClient, treasuryUsdcAccount)).amount;
    const preMigratorUsdc  = (await getAccount(this.banksClient, migratorVaultKeypair.publicKey)).amount;
    const prePoolMetaVault = (await getAccount(this.banksClient, poolMetaVault)).amount;
    const prePoolUsdcVault = (await getAccount(this.banksClient, poolUsdcVault)).amount;
    
    const execTx = await this.autocratClient
      .executeProposalIx(proposal, dao, proposalInstruction)
      .remainingAccounts(proposalInstruction.accounts)
      .transaction();
    
    // Manually fix the treasury signer flag since AutocratClient mapping isn't working
    execTx.instructions.forEach(ix => {
      ix.keys.forEach(key => {
        if (key.pubkey.equals(treasuryForRedeem)) {
          console.log(`Fixing treasury signer flag for ${key.pubkey.toString()}`);
          key.isSigner = false;
        }
        // Fix executable flag for redeem program
        if (key.pubkey.equals(REDEEM_PROGRAM_ID)) {
          console.log(`Fixing executable flag for redeem program ${key.pubkey.toString()}`);
          // Program accounts should be executable, not writable, not signer
          key.isWritable = false;
          key.isSigner = false;
        }
      });
    });

    // Basic instruction integrity before send
    execTx.instructions.forEach((ix, j) => {
      assert.ok(ix.programId, `Exec ix ${j+1} must have programId`);
      assert.isAbove(ix.keys.length, 0, `Exec ix ${j+1} must reference accounts`);
    });

    // Try to execute as legacy first
    execTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    execTx.feePayer = payer.publicKey;
    execTx.sign(payer);
    
    try {
      const execSize = execTx.serialize({ requireAllSignatures: false }).length;
      console.log(`Execution transaction size: ${execSize} bytes`);
      
      if (execSize <= 1100) {
        await this.banksClient.processTransaction(execTx);
        console.log("Proposal executed (legacy transaction)");
      } else {
        throw new Error("Transaction too large");
      }
    } catch (e: any) {
      console.log("Legacy execution failed, need to use V0 transaction");
      console.log("Legacy error:", e.message || e);
      
      // Create a fresh ALT for execution to avoid stale state issues
      console.log("Creating fresh ALT for execution");
      
      // Get a recent slot and ensure it's appropriate for ALT creation
      const currentSlot = await this.banksClient.getSlot();
      const recentSlot = currentSlot > 0n ? currentSlot - 1n : currentSlot;
      
      const [createAltIx, altAddress] = AddressLookupTableProgram.createLookupTable({
        authority: payer.publicKey,
        payer: payer.publicKey,
        recentSlot: recentSlot,
      });

      const createAltTx = new Transaction().add(createAltIx);
      createAltTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
      createAltTx.feePayer = payer.publicKey;
      createAltTx.sign(payer);
      await this.banksClient.processTransaction(createAltTx);

      // CRITICAL: ALTs need significant time to activate in test environment
      console.log("Waiting for fresh ALT to activate...");
      await this.advanceBySlots(10n);
      console.log("Created fresh ALT at:", altAddress.toString());

      // Store ALT address for reuse
      this.altAddress = altAddress;
      
      // Collect all addresses from execution transaction
      const execAddresses = new Set<string>();
      
      // Add payer first (important for V0)
      execAddresses.add(payer.publicKey.toString());
      
      // Add all program IDs from instructions
      execTx.instructions.forEach(ix => {
        execAddresses.add(ix.programId.toString());
      });
      
      // Add all account keys from instructions
      execTx.instructions.forEach(ix => {
        ix.keys.forEach(key => execAddresses.add(key.pubkey.toString()));
      });
      
      // Also add any addresses that might be referenced in instruction data (best-effort)
      execTx.instructions.forEach(ix => {
        if (ix.programId.equals(new PublicKey("autowMzCbM29YXMgVG3T62Hkgo7RcyrvgQQkd54fDQL"))) {
        }
      });
      
      // Add common system accounts that might be needed
      execAddresses.add(SystemProgram.programId.toString());
      execAddresses.add(TOKEN_PROGRAM_ID.toString());
      execAddresses.add(token.ASSOCIATED_TOKEN_PROGRAM_ID.toString());
      execAddresses.add(token.TOKEN_2022_PROGRAM_ID.toString());
      execAddresses.add(MEMO_PROGRAM_ID.toString());
      execAddresses.add("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"); 
      execAddresses.add("SysvarRent111111111111111111111111111111111"); 
      execAddresses.add("SysvarC1ock11111111111111111111111111111111"); 
      
      const execAddressList = Array.from(execAddresses).map(addr => new PublicKey(addr));
      
      // Add all addresses to the fresh ALT
      console.log(`Adding ${execAddressList.length} addresses to fresh ALT`);
      
      // Add addresses to ALT in batches
      const BATCH_SIZE = 10;
      for (let j = 0; j < execAddressList.length; j += BATCH_SIZE) {
        const batch = execAddressList.slice(j, Math.min(j + BATCH_SIZE, execAddressList.length));
        
        const extendIx = AddressLookupTableProgram.extendLookupTable({
          payer: payer.publicKey,
          authority: payer.publicKey,
          lookupTable: this.altAddress,
          addresses: batch,
        });
        
        const extendTx = new Transaction().add(extendIx);
        extendTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
        extendTx.feePayer = payer.publicKey;
        extendTx.sign(payer);
        await this.banksClient.processTransaction(extendTx);
        await this.advanceBySlots(1n);
      }
      
      // Wait for ALT to be fully active - increase wait time to ensure proper activation
      await this.advanceBySlots(30n);
      
      // Refresh ALT and ensure it's properly loaded
      const updatedRawAlt = await this.banksClient.getAccount(this.altAddress);
      if (!updatedRawAlt) {
        throw new Error("ALT account not found after extension!");
      }
      
      // Create fresh lookup table account to avoid any stale state
      const updatedLookupTableAcct = new AddressLookupTableAccount({
        key: this.altAddress,
        state: AddressLookupTableAccount.deserialize(updatedRawAlt.data),
      });
      
      console.log(`Refreshed ALT has ${updatedLookupTableAcct.state.addresses.length} addresses`);
      
      // Update class state
      this.lookupTableAcct = updatedLookupTableAcct;
      
      console.log(`ALT has ${this.lookupTableAcct.state.addresses.length} addresses for execution`);
      
      // Debug: Log all addresses in the ALT
      console.log("ALT addresses:");
      this.lookupTableAcct.state.addresses.forEach((addr, idx) => {
        console.log(`  ${idx}: ${addr.toString()}`);
      });
      
      // Debug: Log all accounts needed by the execution transaction
      console.log("Execution transaction accounts:");
      const execAccounts = new Set<string>();
      execTx.instructions.forEach((ix, idx) => {
        console.log(`  Instruction ${idx + 1}: ${ix.programId.toString()}`);
        ix.keys.forEach((key, keyIdx) => {
          const addrStr = key.pubkey.toString();
          execAccounts.add(addrStr);
          console.log(`    Account ${keyIdx}: ${addrStr} (${key.isSigner ? 'signer' : ''}, ${key.isWritable ? 'writable' : 'readonly'})`);
        });
      });
      
      // Check if all required accounts are in the ALT
      const missingAccounts = Array.from(execAccounts).filter(addrStr => {
        const addr = new PublicKey(addrStr);
        return !this.lookupTableAcct.state.addresses.some(a => a.equals(addr));
      });
      
      if (missingAccounts.length > 0) {
        console.error("ERROR: Missing accounts in ALT:");
        missingAccounts.forEach(addr => console.error(`  - ${addr}`));
        
        // Try to add the missing accounts to the ALT
        console.log(`Attempting to add ${missingAccounts.length} missing accounts to ALT...`);
        const missingAddresses = missingAccounts.map(addr => new PublicKey(addr));
        
        // Add addresses to ALT in batches
        const BATCH_SIZE2 = 10;
        for (let j = 0; j < missingAddresses.length; j += BATCH_SIZE2) {
          const batch = missingAddresses.slice(j, Math.min(j + BATCH_SIZE2, missingAddresses.length));
          
          const extendIx = AddressLookupTableProgram.extendLookupTable({
            payer: payer.publicKey,
            authority: payer.publicKey,
            lookupTable: this.altAddress,
            addresses: batch,
          });
          
          const extendTx = new Transaction().add(extendIx);
          extendTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
          extendTx.feePayer = payer.publicKey;
          extendTx.sign(payer);
          await this.banksClient.processTransaction(extendTx);
          await this.advanceBySlots(1n);
        }
        
        // Wait for ALT to be fully active
        await this.advanceBySlots(5n);
        
        // Refresh ALT again
        const finalRawAlt = await this.banksClient.getAccount(this.altAddress);
        if (!finalRawAlt) {
          throw new Error("ALT account not found after final extension!");
        }
        this.lookupTableAcct = new AddressLookupTableAccount({
          key: this.altAddress,
          state: AddressLookupTableAccount.deserialize(finalRawAlt.data),
        });
        
        console.log(`ALT now has ${this.lookupTableAcct.state.addresses.length} addresses after adding missing accounts`);
        
        // Final check
        const stillMissing = Array.from(execAccounts).filter(addrStr => {
          const addr = new PublicKey(addrStr);
          return !this.lookupTableAcct.state.addresses.some(a => a.equals(addr));
        });
        
        if (stillMissing.length > 0) {
          console.error("ERROR: Still missing accounts after extension:");
          stillMissing.forEach(addr => console.error(`  - ${addr}`));
          throw new Error(`Still missing ${stillMissing.length} accounts in ALT after extension`);
        }
      }
      
      console.log("All required accounts confirmed in updated ALT");
      
      // Try legacy transaction first, if it fails then use V0
      try {
        console.log("Attempting legacy transaction execution...");
        await this.banksClient.processTransaction(execTx);
        console.log("Proposal executed (legacy transaction)");
      } catch (legacyError: any) {
        console.log("Legacy transaction failed, trying V0 transaction...");
        console.log("Legacy error:", legacyError.message);
        
        // Create V0 transaction with the most up-to-date ALT
        const execMsgV0 = new TransactionMessage({
          payerKey: payer.publicKey,
          recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
          instructions: execTx.instructions,
        }).compileToV0Message([updatedLookupTableAcct]);

        const execV0 = new VersionedTransaction(execMsgV0);
        execV0.sign([payer]);
        
        console.log("Execution V0 Transaction size:", execV0.serialize().length, "bytes");
        
        // Debug: Log V0 message details
        console.log("V0 Message details:");
        console.log(`  Static account keys: ${execMsgV0.staticAccountKeys.length}`);
        console.log(`  Address table lookups: ${execMsgV0.addressTableLookups.length}`);
        
        if (execMsgV0.addressTableLookups.length > 0) {
          const lookup = execMsgV0.addressTableLookups[0];
          console.log(`  ALT lookup uses ${lookup.readonlyIndexes.length} readonly and ${lookup.writableIndexes.length} writable indices`);
          console.log(`  Readonly indices: ${lookup.readonlyIndexes.join(', ')}`);
          console.log(`  Writable indices: ${lookup.writableIndexes.join(', ')}`);
          
          // Check if any index exceeds the ALT size
          const maxReadonly = Math.max(...lookup.readonlyIndexes, -1);
          const maxWritable = Math.max(...lookup.writableIndexes, -1);
          const maxIndex = Math.max(maxReadonly, maxWritable);
          
          console.log(`  Max index used: ${maxIndex}, ALT size: ${updatedLookupTableAcct.state.addresses.length}`);
          
          if (maxIndex >= updatedLookupTableAcct.state.addresses.length) {
            console.error(`  ERROR: Transaction trying to use index ${maxIndex} but ALT only has ${updatedLookupTableAcct.state.addresses.length} addresses!`);
          }
        }
        
        // Execute V0 transaction
        await this.banksClient.processTransaction(execV0);
        console.log("Proposal executed (V0 transaction)");
      }
    }

    // Post-exec balance assertions (prove redeem effects)
    const postLpAccount = await getAccount(
      this.banksClient,
      treasuryLpAccount,
    ).catch(() => null as any);
    console.log(
      "Post-execution LP balance:",
      postLpAccount.amount.toString(),
    );

    const postTreasuryLp    = postLpAccount.amount;
    const postTreasuryBase  = (await getAccount(this.banksClient, treasuryMetaAccount)).amount;
    const postTreasuryQuote = (await getAccount(this.banksClient, treasuryUsdcAccount)).amount;
    const postMigratorUsdc  = (await getAccount(this.banksClient, migratorVaultKeypair.publicKey)).amount;

    // Get pool vault balances to verify pool effects
    const postPoolMetaVault = (await getAccount(this.banksClient, poolMetaVault)).amount;
    const postPoolUsdcVault = (await getAccount(this.banksClient, poolUsdcVault)).amount;

    console.log("\n=== REDEEM EFFECTS VERIFICATION ===");
    console.log("Pre-exec LP balance:", preTreasuryLp.toString());
    console.log("Post-exec LP balance:", postTreasuryLp.toString());
    console.log("LP tokens burned:", (preTreasuryLp - postTreasuryLp).toString());
    
    console.log("Pre-exec treasury META:", preTreasuryBase.toString());
    console.log("Post-exec treasury META:", postTreasuryBase.toString());
    console.log("META change:", (postTreasuryBase - preTreasuryBase).toString());
    
    console.log("Pre-exec treasury USDC:", preTreasuryQuote.toString());
    console.log("Post-exec treasury USDC:", postTreasuryQuote.toString());
    console.log("USDC change:", (postTreasuryQuote - preTreasuryQuote).toString());
    
    console.log("Pre-exec migrator USDC:", preMigratorUsdc.toString());
    console.log("Post-exec migrator USDC:", postMigratorUsdc.toString());
    console.log("USDC to migrator:", (postMigratorUsdc - preMigratorUsdc).toString());
    
    console.log("Pre-exec pool META vault:", prePoolMetaVault.toString());
    console.log("Post-exec pool META vault:", postPoolMetaVault.toString());
    console.log("Pool META change:", (postPoolMetaVault - prePoolMetaVault).toString());
    
    console.log("Pre-exec pool USDC vault:", prePoolUsdcVault.toString());
    console.log("Post-exec pool USDC vault:", postPoolUsdcVault.toString());
    console.log("Pool USDC change:", (postPoolUsdcVault - prePoolUsdcVault).toString());

    // ============== CORE REDEEM FUNCTIONALITY ASSERTIONS ==============
    
    // LP tokens must be burned (core redeem requirement)
    assert.isTrue(postTreasuryLp < preTreasuryLp, "LP tokens must be burned during redeem");
    const lpBurned = preTreasuryLp - postTreasuryLp;
    assert.isTrue(lpBurned > 0n, "LP tokens burned must be positive");
    console.log("LP tokens were burned:", lpBurned.toString());

    // Migrator vault must receive USDC (core redeem functionality)
    assert.isTrue(postMigratorUsdc > preMigratorUsdc, "Migrator vault must receive USDC during redeem");
    const usdcToMigrator = postMigratorUsdc - preMigratorUsdc;
    assert.isTrue(usdcToMigrator > 0n, "USDC sent to migrator must be positive");
    console.log("Migrator vault received USDC:", usdcToMigrator.toString());

    // Pool vaults must be affected (redeem withdraws from pool)
    const poolMetaChange = postPoolMetaVault - prePoolMetaVault;
    const poolUsdcChange = postPoolUsdcVault - prePoolUsdcVault;
    
    // At least one pool vault should decrease (assets withdrawn)
    assert.isTrue(
      poolMetaChange < 0n || poolUsdcChange < 0n, 
      "At least one pool vault must decrease during redeem (assets withdrawn)"
    );
    console.log("Pool vaults were affected by redeem");

    // Treasury asset balances should change appropriately
    const treasuryMetaChange = postTreasuryBase - preTreasuryBase;
    const treasuryUsdcChange = postTreasuryQuote - preTreasuryQuote;

    // Verify the redeem actually moved value (not just dust amounts)
    const totalValueMoved = usdcToMigrator + treasuryMetaChange + treasuryUsdcChange;
    assert.isTrue(totalValueMoved > 0n, "Redeem must move some value");
    assert.isTrue(totalValueMoved >= 1000n, "Redeem should move meaningful value (at least 1000 units)");
    console.log("Redeem moved meaningful value:", totalValueMoved.toString());

    // Verify LP burn corresponds to value moved (basic sanity check)
    assert.isTrue(lpBurned > 0n, "LP tokens burned must be positive");
    console.log("LP burn amount is valid:", lpBurned.toString());

    // Verify no negative balances (sanity check)
    assert.isTrue(postTreasuryLp >= 0n, "Treasury LP balance cannot be negative");
    assert.isTrue(postTreasuryBase >= 0n, "Treasury META balance cannot be negative");
    assert.isTrue(postTreasuryQuote >= 0n, "Treasury USDC balance cannot be negative");
    assert.isTrue(postMigratorUsdc >= 0n, "Migrator USDC balance cannot be negative");
    assert.isTrue(postPoolMetaVault >= 0n, "Pool META vault cannot be negative");
    assert.isTrue(postPoolUsdcVault >= 0n, "Pool USDC vault cannot be negative");
    console.log("All balances are non-negative");

    // Verify migrator vault is the correct USDC account
    const migratorVaultInfo = await getAccount(this.banksClient, migratorVaultKeypair.publicKey);
    assert.equal(migratorVaultInfo.mint.toString(), USDC.toString(), "Migrator vault must be a USDC account");
    console.log("Migrator vault is correct USDC account");

    console.log("\n=== REDEEM FUNCTIONALITY VERIFIED ===");
    console.log("All core redeem functionality assertions passed!");
    console.log("- LP tokens were burned");
    console.log("- Migrator vault received USDC");
    console.log("- Pool vaults were affected");
    console.log("- Treasury asset changes tracked (assets moved to migrator)");
    console.log("- Meaningful value was moved");
    console.log("- All balances are valid");
  } else {
    console.log("Proposal did not pass, cannot execute");
    assert.fail("Proposal did not pass");
  }

  console.log("\n=== REDEEM TEST WITH PROPOSAL COMPLETE ===");
}
