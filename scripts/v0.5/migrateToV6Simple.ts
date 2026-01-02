import "dotenv/config";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as multisig from "@sqds/multisig";
import {
  createTransferInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  getMint,
} from "@solana/spl-token";
import {
  getMetadataAccountDataSerializer,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  publicKey as UmiPublicKey,
  createNoopSigner,
} from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { sha256 } from "@noble/hashes/sha256";

import {
  AutocratClient,
  AmmClient,
  ConditionalVaultClient,
  AUTOCRAT_PROGRAM_ID,
  PERMISSIONLESS_ACCOUNT,
  getProposalAddr,
  getMetadataAddr,
  InstructionUtils,
} from "@metadaoproject/futarchy/v0.5";

import { FutarchyClient as FutarchyClientV6 } from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";
import {
  sendBundle,
  getTipAccounts,
  getTipFloor,
  getBundleStatuses,
} from "../utils/bundles.js";

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
const V5_DAO_ADDRESS = new PublicKey(
  "9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo",
);

// V6 DAO to migrate TO (must already be initialized)
const V6_DAO_ADDRESS = new PublicKey(
  "6jQt41FAvrBhz9hErkHaDuQbKd9bKCLAn4sdED3MRg8y",
);

// Set to false to only create Squads proposal (for simulation), true for full futarchy proposal
const FULL_PROPOSAL = true;
// =========================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// V5 clients
const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

// V6 client
const futarchyV6 = FutarchyClientV6.createClient({ provider });

async function main() {
  if (!process.env.JITO_AUTH_TOKEN) {
    console.log(
      "Warning: No Jito auth token provided, results may be unreliable",
    );
  }

  console.log("=".repeat(60));
  console.log("MIGRATE V5 DAO TO V6 DAO (Simple)");
  console.log("=".repeat(60));
  console.log(
    `Mode: ${FULL_PROPOSAL ? "FULL PROPOSAL (Squads + Futarchy markets)" : "SQUADS ONLY (for simulation)"}`,
  );
  console.log("=".repeat(60));

  // Step 1: Fetch V5 DAO data
  console.log("\n[1] Fetching V5 DAO data...");
  const v5Dao = await autocratClient.getDao(V5_DAO_ADDRESS);
  const { multisigPda: v5MultisigPda, vaultPda: v5VaultPda } =
    await getSquadsPdasFromDao(V5_DAO_ADDRESS);

  console.log("  V5 DAO Address:", V5_DAO_ADDRESS.toBase58());
  console.log("  Base Mint:", v5Dao.baseMint.toBase58());
  console.log("  Quote Mint:", v5Dao.quoteMint.toBase58());
  console.log("  V5 Squads Multisig:", v5MultisigPda.toBase58());
  console.log("  V5 Vault PDA:", v5VaultPda.toBase58());

  // Step 2: Fetch and verify V6 DAO
  console.log("\n[2] Fetching V6 DAO data...");
  const v6Dao = await futarchyV6.fetchDao(V6_DAO_ADDRESS);
  if (!v6Dao) {
    throw new Error(
      `V6 DAO not found at ${V6_DAO_ADDRESS.toBase58()}. Make sure it's already initialized.`,
    );
  }

  // Verify mints match
  if (!v6Dao.baseMint.equals(v5Dao.baseMint)) {
    throw new Error(
      `Base mint mismatch! V5: ${v5Dao.baseMint.toBase58()}, V6: ${v6Dao.baseMint.toBase58()}`,
    );
  }
  if (!v6Dao.quoteMint.equals(v5Dao.quoteMint)) {
    throw new Error(
      `Quote mint mismatch! V5: ${v5Dao.quoteMint.toBase58()}, V6: ${v6Dao.quoteMint.toBase58()}`,
    );
  }

  const v6MultisigPda = multisig.getMultisigPda({
    createKey: V6_DAO_ADDRESS,
  })[0];
  const v6VaultPda = multisig.getVaultPda({
    multisigPda: v6MultisigPda,
    index: 0,
  })[0];

  console.log("  V6 DAO Address:", V6_DAO_ADDRESS.toBase58());
  console.log("  V6 Squads Multisig:", v6MultisigPda.toBase58());
  console.log("  V6 Vault PDA:", v6VaultPda.toBase58());
  console.log("  ✓ Base mint matches V5 DAO");
  console.log("  ✓ Quote mint matches V5 DAO");

  // Step 3: Fetch token decimals and liquidity requirements
  console.log("\n[3] Fetching token decimals and liquidity requirements...");

  // Get mint decimals
  const baseMintInfo = await getMint(provider.connection, v5Dao.baseMint);
  const quoteMintInfo = await getMint(provider.connection, v5Dao.quoteMint);
  const baseDecimals = baseMintInfo.decimals;
  const quoteDecimals = quoteMintInfo.decimals;

  console.log("  Base token decimals:", baseDecimals);
  console.log("  Quote token decimals:", quoteDecimals);

  // Get min liquidity requirements from DAO
  const minBaseLiquidity = v5Dao.minBaseFutarchicLiquidity;
  const minQuoteLiquidity = v5Dao.minQuoteFutarchicLiquidity;

  const baseMultiplier = Math.pow(10, baseDecimals);
  const quoteMultiplier = Math.pow(10, quoteDecimals);

  console.log(
    "  Min base liquidity required:",
    (minBaseLiquidity.toNumber() / baseMultiplier).toLocaleString(),
  );
  console.log(
    "  Min quote liquidity required:",
    (minQuoteLiquidity.toNumber() / quoteMultiplier).toLocaleString(),
  );

  // Check payer's wallet balances (only needed for full proposal)
  if (FULL_PROPOSAL) {
    const payerBaseAta = getAssociatedTokenAddressSync(
      v5Dao.baseMint,
      payer.publicKey,
      true,
    );
    const payerQuoteAta = getAssociatedTokenAddressSync(
      v5Dao.quoteMint,
      payer.publicKey,
      true,
    );

    let payerBaseBalance = BigInt(0);
    let payerQuoteBalance = BigInt(0);

    try {
      const baseInfo =
        await provider.connection.getTokenAccountBalance(payerBaseAta);
      payerBaseBalance = BigInt(baseInfo.value.amount);
    } catch {
      console.log("  ⚠ Base token account doesn't exist");
    }

    try {
      const quoteInfo =
        await provider.connection.getTokenAccountBalance(payerQuoteAta);
      payerQuoteBalance = BigInt(quoteInfo.value.amount);
    } catch {
      console.log("  ⚠ Quote token account doesn't exist");
    }

    console.log(
      "  Your base token balance:",
      (Number(payerBaseBalance) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "  Your quote token balance:",
      (Number(payerQuoteBalance) / quoteMultiplier).toLocaleString(),
    );

    // Check if payer has enough tokens
    if (payerBaseBalance < BigInt(minBaseLiquidity.toString())) {
      const needed = (
        minBaseLiquidity.toNumber() / baseMultiplier
      ).toLocaleString();
      const have = (Number(payerBaseBalance) / baseMultiplier).toLocaleString();
      throw new Error(`Insufficient base tokens! Need ${needed}, have ${have}`);
    }
    if (payerQuoteBalance < BigInt(minQuoteLiquidity.toString())) {
      const needed = (
        minQuoteLiquidity.toNumber() / quoteMultiplier
      ).toLocaleString();
      const have = (
        Number(payerQuoteBalance) / quoteMultiplier
      ).toLocaleString();
      throw new Error(
        `Insufficient quote tokens! Need ${needed}, have ${have}`,
      );
    }

    console.log("  ✓ Wallet has sufficient tokens for proposal liquidity");
  } else {
    console.log("  (Skipping wallet balance check - Squads only mode)");
  }

  // Step 4: Get vault token balances to transfer
  console.log("\n[4] Fetching V5 vault token balances...");
  const v5VaultBaseAta = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    v5VaultPda,
    true,
  );
  const v5VaultQuoteAta = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    v5VaultPda,
    true,
  );

  let baseBalance = BigInt(0);
  let quoteBalance = BigInt(0);

  try {
    const baseInfo =
      await provider.connection.getTokenAccountBalance(v5VaultBaseAta);
    baseBalance = BigInt(baseInfo.value.amount);
    console.log(
      "  Base token balance:",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Base token balance: 0 (no account)");
  }

  try {
    const quoteInfo =
      await provider.connection.getTokenAccountBalance(v5VaultQuoteAta);
    quoteBalance = BigInt(quoteInfo.value.amount);
    console.log(
      "  Quote token balance:",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
    );
  } catch {
    console.log("  Quote token balance: 0 (no account)");
  }

  // Step 5: Check mint authority
  console.log("\n[5] Checking base mint authority...");
  const currentMintAuthority = baseMintInfo.mintAuthority;

  if (currentMintAuthority) {
    console.log("  Current mint authority:", currentMintAuthority.toBase58());
    if (currentMintAuthority.equals(v5VaultPda)) {
      console.log("  ✓ Mint authority is the V5 vault (will be transferred)");
    } else {
      console.log(
        "  ⚠ Mint authority is NOT the V5 vault - cannot transfer via proposal",
      );
    }
  } else {
    console.log("  ⚠ No mint authority (token is immutable)");
  }

  let canTransferMetadataAuthority = false;

  // Step 6: Ensure V6 vault ATAs exist (create them now if needed)
  console.log("\n[6] Ensuring V6 vault token accounts exist...");

  const v6VaultBaseAta = getAssociatedTokenAddressSync(
    v5Dao.baseMint,
    v6VaultPda,
    true,
  );
  const v6VaultQuoteAta = getAssociatedTokenAddressSync(
    v5Dao.quoteMint,
    v6VaultPda,
    true,
  );

  // Check if ATAs exist and create them if not (payer pays for rent, not the vault)
  const setupIxs: anchor.web3.TransactionInstruction[] = [];

  const v6BaseAtaInfo =
    await provider.connection.getAccountInfo(v6VaultBaseAta);
  if (!v6BaseAtaInfo) {
    setupIxs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey, // payer pays for rent
        v6VaultBaseAta,
        v6VaultPda,
        v5Dao.baseMint,
      ),
    );
    console.log("  Will create: V6 vault base token account");
  } else {
    console.log("  ✓ V6 vault base token account exists");
  }

  const v6QuoteAtaInfo =
    await provider.connection.getAccountInfo(v6VaultQuoteAta);
  if (!v6QuoteAtaInfo) {
    setupIxs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey, // payer pays for rent
        v6VaultQuoteAta,
        v6VaultPda,
        v5Dao.quoteMint,
      ),
    );
    console.log("  Will create: V6 vault quote token account");
  } else {
    console.log("  ✓ V6 vault quote token account exists");
  }

  // Create ATAs now if needed (separate transaction before the proposal)
  if (setupIxs.length > 0) {
    console.log("  Creating V6 vault token accounts...");
    const setupTx = new Transaction().add(...setupIxs);
    setupTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    setupTx.feePayer = payer.publicKey;
    const signedSetupTx = await provider.wallet.signTransaction(setupTx);
    const setupSig = await provider.connection.sendRawTransaction(
      signedSetupTx.serialize(),
    );
    await provider.connection.confirmTransaction(setupSig);
    console.log("  ✓ V6 vault token accounts created:", setupSig);
  }

  // Step 7: Build vault transaction instructions
  console.log("\n[7] Building vault transaction instructions...");

  const vaultInstructions: anchor.web3.TransactionInstruction[] = [];

  // 7a. Transfer base tokens from V5 vault to V6 vault
  if (baseBalance > 0n) {
    vaultInstructions.push(
      createTransferInstruction(
        v5VaultBaseAta,
        v6VaultBaseAta,
        v5VaultPda,
        baseBalance,
      ),
    );
    console.log(
      "  Added: Transfer base tokens:",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
    );
  }

  // 7b. Transfer quote tokens from V5 vault to V6 vault
  if (quoteBalance > 0n) {
    vaultInstructions.push(
      createTransferInstruction(
        v5VaultQuoteAta,
        v6VaultQuoteAta,
        v5VaultPda,
        quoteBalance,
      ),
    );
    console.log(
      "  Added: Transfer quote tokens:",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
    );
  }

  // 7c. Transfer mint authority from V5 vault to V6 vault
  if (currentMintAuthority && currentMintAuthority.equals(v5VaultPda)) {
    vaultInstructions.push(
      createSetAuthorityInstruction(
        v5Dao.baseMint,
        v5VaultPda,
        AuthorityType.MintTokens,
        v6VaultPda,
      ),
    );
    console.log("  Added: Transfer mint authority to V6 vault");
  }

  // 7d. Transfer metadata update authority from V5 vault to V6 vault
  const [metadataAddr] = getMetadataAddr(v5Dao.baseMint);
  try {
    const metadataAccountInfo =
      await provider.connection.getAccountInfo(metadataAddr);
    if (metadataAccountInfo) {
      const metadataSerializer = getMetadataAccountDataSerializer();
      const [metadata] = metadataSerializer.deserialize(
        metadataAccountInfo.data,
      );
      const updateAuthority = new PublicKey(metadata.updateAuthority);
      if (updateAuthority.equals(v5VaultPda)) {
        // Use UMI to build the metadata update instruction
        const umi = createUmi(provider.connection.rpcEndpoint);
        // Create a noop signer for the vault - actual signing happens in Squads execution
        const vaultSigner = createNoopSigner(
          UmiPublicKey(v5VaultPda.toBase58()),
        );
        const umiUpdateIxs = updateMetadataAccountV2(umi, {
          metadata: UmiPublicKey(metadataAddr.toBase58()),
          updateAuthority: vaultSigner, // Current authority (will be signer in vault tx)
          newUpdateAuthority: UmiPublicKey(v6VaultPda.toBase58()),
        }).getInstructions();

        for (const umiIx of umiUpdateIxs) {
          vaultInstructions.push(toWeb3JsInstruction(umiIx));
        }
        canTransferMetadataAuthority = true;
        console.log("  Added: Transfer metadata update authority to V6 vault");
      }
    }
  } catch (e: any) {
    console.log(
      "  ⚠ Could not add metadata authority transfer:",
      e.message || e,
    );
  }

  console.log("  Total vault instructions:", vaultInstructions.length);

  // Step 8: Create Squads vault transaction + proposal
  console.log("\n[8] Creating Squads vault transaction and proposal...");

  const v5MultisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      v5MultisigPda,
    );

  const currentTransactionIndex = Number(
    v5MultisigAccountInfo.transactionIndex,
  );
  const transactionIndex = currentTransactionIndex + 1;
  console.log("  Current transaction index:", currentTransactionIndex);
  console.log("  New transaction index:", transactionIndex);

  const transactionMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: "", // Not used by squads
    instructions: vaultInstructions,
  });

  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: v5MultisigPda,
    transactionIndex: BigInt(transactionIndex),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: v5MultisigPda,
    transactionIndex: BigInt(transactionIndex),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  const [squadsProposalPda] = multisig.getProposalPda({
    multisigPda: v5MultisigPda,
    transactionIndex: BigInt(transactionIndex),
  });

  console.log("  Squads Proposal PDA:", squadsProposalPda.toBase58());

  // Step 9: Send Squads vault tx + proposal creation FIRST (separate from futarchy bundle)
  console.log("\n[9] Sending Squads vault transaction...");
  const squadsTx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  squadsTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  squadsTx.feePayer = payer.publicKey;
  squadsTx.partialSign(PERMISSIONLESS_ACCOUNT);
  const signedSquadsTx = await provider.wallet.signTransaction(squadsTx);
  const squadsSig = await provider.connection.sendRawTransaction(
    signedSquadsTx.serialize(),
  );
  console.log("  Squads tx signature:", squadsSig);
  console.log("  Waiting for confirmation...");
  await provider.connection.confirmTransaction(squadsSig);
  console.log("  ✓ Squads proposal created");

  // Wait a bit for the transaction to be fully confirmed
  await new Promise((resolve) => setTimeout(resolve, 3000));

  if (FULL_PROPOSAL) {
    // Step 10: Build V5 futarchy proposal market transactions (5 txs max for Jito bundle)
    console.log("\n[10] Building V5 futarchy proposal markets...");

    const [metaDaoProposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      squadsProposalPda,
    );
    console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());

    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      question,
    } = autocratClient.getProposalPdas(
      metaDaoProposal,
      v5Dao.baseMint,
      v5Dao.quoteMint,
      V5_DAO_ADDRESS,
    );

    // Build 5 transactions for Jito bundle
    const txns: Transaction[] = [];

    // Transaction 1: Initialize question
    const questionTx = await vaultClient
      .initializeQuestionIx(
        sha256(`Will ${metaDaoProposal} pass?/FAIL/PASS`),
        metaDaoProposal,
        2,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 30_000 }),
      ])
      .transaction();
    txns.push(questionTx);

    // Transaction 2: Initialize vaults and AMMs
    const vaultsTx = await vaultClient
      .initializeVaultIx(question, v5Dao.baseMint, 2)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 420_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          vaultClient.initializeVaultIx(question, v5Dao.quoteMint, 2),
          ammClient.initializeAmmIx(
            passBaseMint,
            passQuoteMint,
            v5Dao.twapStartDelaySlots,
            v5Dao.twapInitialObservation,
            v5Dao.twapMaxObservationChangePerUpdate,
          ),
          ammClient.initializeAmmIx(
            failBaseMint,
            failQuoteMint,
            v5Dao.twapStartDelaySlots,
            v5Dao.twapInitialObservation,
            v5Dao.twapMaxObservationChangePerUpdate,
          ),
        ),
      )
      .transaction();
    txns.push(vaultsTx);

    // Transaction 3: Split tokens
    const splitTokensTx = await vaultClient
      .splitTokensIx(question, baseVault, v5Dao.baseMint, minBaseLiquidity, 2)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 220_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          vaultClient.splitTokensIx(
            question,
            quoteVault,
            v5Dao.quoteMint,
            minQuoteLiquidity,
            2,
          ),
        ),
      )
      .transaction();
    txns.push(splitTokensTx);

    // Transaction 4: Add liquidity to AMMs
    const addLiquidityTx = await ammClient
      .addLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        minQuoteLiquidity,
        minBaseLiquidity,
        new BN(0),
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 170_000 }),
      ])
      .postInstructions(
        await InstructionUtils.getInstructions(
          ammClient.addLiquidityIx(
            failAmm,
            failBaseMint,
            failQuoteMint,
            minQuoteLiquidity,
            minBaseLiquidity,
            new BN(0),
          ),
        ),
      )
      .transaction();
    txns.push(addLiquidityTx);

    // Transaction 5: Initialize proposal
    const lpTokens = minQuoteLiquidity;
    const proposalTx = await autocratClient
      .initializeProposalIx(
        "Migrate DAO from v5 to v6",
        squadsProposalPda,
        V5_DAO_ADDRESS,
        v5Dao.baseMint,
        v5Dao.quoteMint,
        lpTokens,
        lpTokens,
        question,
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .transaction();
    txns.push(proposalTx);

    console.log("  Total transactions to bundle:", txns.length);

    // Step 11: Bundle and send futarchy txs with Jito
    console.log("\n[11] Bundling and sending futarchy txs with Jito...");

    const signedTxns = await prepareBundle(txns);
    const bundle = await sendBundle(signedTxns);

    console.log("\n" + "=".repeat(60));
    console.log("BUNDLE SUBMITTED");
    console.log("=".repeat(60));
    console.log("Bundle ID:", bundle.result);

    // Wait a moment and check status
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const bundleStatus = await getBundleStatuses(bundle.result);
    console.log("Bundle status:", JSON.stringify(bundleStatus, null, 2));
  } else {
    console.log("\n[10] Skipping futarchy markets (Squads only mode)");
  }

  console.log("\n" + "=".repeat(60));
  console.log("COMPLETE");
  console.log("=".repeat(60));

  console.log("\nSUMMARY:");
  console.log("  V5 DAO:", V5_DAO_ADDRESS.toBase58());
  console.log("  V6 DAO:", V6_DAO_ADDRESS.toBase58());
  console.log(
    "\n  *** SQUADS PROPOSAL PDA:",
    squadsProposalPda.toBase58(),
    "***",
  );
  console.log("  Squads Multisig:", v5MultisigPda.toBase58());
  console.log("  Transaction Index:", transactionIndex);
  if (FULL_PROPOSAL) {
    const [metaDaoProposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      squadsProposalPda,
    );
    console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());
  }
  console.log("\nMIGRATION ACTIONS (when proposal passes):");
  if (baseBalance > 0n) {
    console.log(
      "  - Transfer",
      (Number(baseBalance) / baseMultiplier).toLocaleString(),
      "base tokens to V6 vault",
    );
  }
  if (quoteBalance > 0n) {
    console.log(
      "  - Transfer",
      (Number(quoteBalance) / quoteMultiplier).toLocaleString(),
      "quote tokens to V6 vault",
    );
  }
  if (currentMintAuthority && currentMintAuthority.equals(v5VaultPda)) {
    console.log("  - Transfer mint authority to V6 vault");
  }
  if (canTransferMetadataAuthority) {
    console.log("  - Transfer metadata update authority to V6 vault");
  }
  console.log(
    "\nNOTE: The V6 DAO must already be initialized before running this script.",
  );
  console.log(
    "      The vault transaction only executes if the proposal passes.",
  );
  if (!FULL_PROPOSAL) {
    console.log(
      "\n  ⚠ SQUADS ONLY MODE: Go simulate the proposal in Squads before running with FULL_PROPOSAL=true",
    );
  }
}

async function prepareBundle(
  transactions: Transaction[],
): Promise<Transaction[]> {
  console.log("  Preparing bundle with", transactions.length, "transactions");

  const tipAccounts = await getTipAccounts();
  const tipFloor = await getTipFloor();
  const tipAccount =
    tipAccounts[Math.floor(Math.random() * tipAccounts.length)];

  console.log(
    "  Tip floor:",
    Math.round(tipFloor * LAMPORTS_PER_SOL),
    "lamports",
  );
  console.log("  Tip account:", tipAccount);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(tipAccount),
    lamports: Math.round(tipFloor * LAMPORTS_PER_SOL),
  });

  const { blockhash } = await provider.connection.getLatestBlockhash();

  for (const transaction of transactions) {
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
  }

  // Add tip to last transaction
  const lastTransaction = transactions[transactions.length - 1];
  lastTransaction.add(transferInstruction);

  // Sign all transactions with payer
  const signedTxns = await provider.wallet.signAllTransactions([
    ...transactions,
  ]);

  console.log("  Transactions signed");
  return signedTxns;
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
