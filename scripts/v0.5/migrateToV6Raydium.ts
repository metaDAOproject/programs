import "dotenv/config";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
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
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getMetadataAccountDataSerializer,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey as UmiPublicKey } from "@metaplex-foundation/umi";
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
  LAUNCHPAD_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getRaydiumCpmmPoolVaultAddr,
} from "@metadaoproject/futarchy/v0.5";

import { FutarchyClient as FutarchyClientV6 } from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";
import {
  sendBundle,
  getTipAccounts,
  getTipFloor,
  getBundleStatuses,
} from "../utils/bundles.js";
import { IDL as RaydiumCpmmIDL } from "../../tests/fixtures/raydium_cpmm.js";

// Memo program ID for Raydium withdraw
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

// ===== CONFIGURATION =====
// V5 DAO to migrate FROM
// will be testing with FpVVMmZeJFZqi5piEJjb7GmSMX6euYhJbKwhuPAy8cpF
// has short slots per proposal window though so we have to be quick here, maybe not though as pass bps i 0
// which is test-dao v5 dao
const V5_DAO_ADDRESS = new PublicKey("YOUR_V5_DAO_ADDRESS_HERE");

// V6 DAO to migrate TO (must already be initialized)
const V6_DAO_ADDRESS = new PublicKey("YOUR_V6_DAO_ADDRESS_HERE");
// =========================

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// V5 clients
const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

// V6 client
const futarchyV6 = FutarchyClientV6.createClient({ provider });

// Raydium CPMM program (using IDL)
const raydiumCpmmProgram = new anchor.Program(
  RaydiumCpmmIDL,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  provider,
);

async function main() {
  if (!process.env.JITO_AUTH_TOKEN) {
    console.log(
      "Warning: No Jito auth token provided, results may be unreliable",
    );
  }

  console.log("=".repeat(60));
  console.log("MIGRATE V5 DAO TO V6 DAO");
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

  // Check payer's wallet balances
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
    const have = (Number(payerQuoteBalance) / quoteMultiplier).toLocaleString();
    throw new Error(`Insufficient quote tokens! Need ${needed}, have ${have}`);
  }

  console.log("  ✓ Wallet has sufficient tokens for proposal liquidity");

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

  // Step 4.5: Fetch Raydium CPMM pool info and LP balance
  console.log("\n[4.5] Fetching Raydium CPMM pool info...");

  const [raydiumPoolState] = getLiquidityPoolAddr(
    LAUNCHPAD_PROGRAM_ID,
    V5_DAO_ADDRESS,
  );
  const [raydiumLpMint] = getRaydiumCpmmLpMintAddr(raydiumPoolState, false);
  const v5VaultLpAta = getAssociatedTokenAddressSync(
    raydiumLpMint,
    v5VaultPda,
    true,
  );

  console.log("  Raydium Pool State:", raydiumPoolState.toBase58());
  console.log("  Raydium LP Mint:", raydiumLpMint.toBase58());

  let lpBalance = BigInt(0);
  try {
    const lpInfo =
      await provider.connection.getTokenAccountBalance(v5VaultLpAta);
    lpBalance = BigInt(lpInfo.value.amount);
    console.log("  Vault LP token balance:", lpInfo.value.uiAmountString);
  } catch {
    console.log(
      "  ⚠ Vault LP token balance: 0 (no account or pool doesn't exist)",
    );
  }

  // Token ordering for Raydium: smaller pubkey is token0
  const isBaseToken0 =
    v5Dao.baseMint.toBuffer().compare(v5Dao.quoteMint.toBuffer()) < 0;
  const token0Mint = isBaseToken0 ? v5Dao.baseMint : v5Dao.quoteMint;
  const token1Mint = isBaseToken0 ? v5Dao.quoteMint : v5Dao.baseMint;

  const [poolToken0Vault] = getRaydiumCpmmPoolVaultAddr(
    raydiumPoolState,
    token0Mint,
    false,
  );
  const [poolToken1Vault] = getRaydiumCpmmPoolVaultAddr(
    raydiumPoolState,
    token1Mint,
    false,
  );

  console.log(
    "  Token ordering:",
    isBaseToken0 ? "base=token0, quote=token1" : "quote=token0, base=token1",
  );

  // Calculate expected withdrawal amounts from LP
  let expectedBaseFromLp = BigInt(0);
  let expectedQuoteFromLp = BigInt(0);

  if (lpBalance > 0n) {
    try {
      // Fetch pool vault balances and LP supply to calculate proportional withdrawal
      const [token0VaultBalance, token1VaultBalance, lpMintInfo] =
        await Promise.all([
          provider.connection.getTokenAccountBalance(poolToken0Vault),
          provider.connection.getTokenAccountBalance(poolToken1Vault),
          getMint(provider.connection, raydiumLpMint),
        ]);

      const poolToken0Amount = BigInt(token0VaultBalance.value.amount);
      const poolToken1Amount = BigInt(token1VaultBalance.value.amount);
      const lpSupply = lpMintInfo.supply;

      // Calculate proportional share: (lpBalance / lpSupply) * poolAmount
      const token0Share = (lpBalance * poolToken0Amount) / lpSupply;
      const token1Share = (lpBalance * poolToken1Amount) / lpSupply;

      // Assign based on token ordering
      if (isBaseToken0) {
        expectedBaseFromLp = token0Share;
        expectedQuoteFromLp = token1Share;
      } else {
        expectedBaseFromLp = token1Share;
        expectedQuoteFromLp = token0Share;
      }

      console.log(
        "  Expected base from LP withdrawal:",
        (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
      );
      console.log(
        "  Expected quote from LP withdrawal:",
        (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
      );
    } catch (e) {
      console.log("  ⚠ Could not calculate LP withdrawal amounts:", e);
    }
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

  // Step 6: Build vault transaction instructions
  console.log("\n[6] Building vault transaction instructions...");

  const vaultInstructions: anchor.web3.TransactionInstruction[] = [];

  // 5a. Create ATAs on V6 vault for receiving tokens
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

  vaultInstructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      v5VaultPda, // payer (from vault)
      v6VaultBaseAta,
      v6VaultPda,
      v5Dao.baseMint,
    ),
  );
  vaultInstructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      v5VaultPda, // payer (from vault)
      v6VaultQuoteAta,
      v6VaultPda,
      v5Dao.quoteMint,
    ),
  );
  console.log("  Added: Create V6 vault token accounts");

  // 6b. Withdraw LP tokens from Raydium CPMM (if any)
  if (lpBalance > 0n) {
    // Accounts ordered based on token0/token1 (smaller pubkey first)
    const token0Account = isBaseToken0 ? v5VaultBaseAta : v5VaultQuoteAta;
    const token1Account = isBaseToken0 ? v5VaultQuoteAta : v5VaultBaseAta;

    const raydiumWithdrawIx = await raydiumCpmmProgram.methods
      .withdraw(
        new BN(lpBalance.toString()),
        new BN(0), // minimum_token_0_amount (no slippage protection for proposal)
        new BN(0), // minimum_token_1_amount
      )
      .accounts({
        owner: v5VaultPda,
        authority: RAYDIUM_AUTHORITY,
        poolState: raydiumPoolState,
        ownerLpToken: v5VaultLpAta,
        token0Account: token0Account,
        token1Account: token1Account,
        token0Vault: poolToken0Vault,
        token1Vault: poolToken1Vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        vault0Mint: token0Mint,
        vault1Mint: token1Mint,
        lpMint: raydiumLpMint,
        memoProgram: MEMO_PROGRAM_ID,
      })
      .instruction();

    vaultInstructions.push(raydiumWithdrawIx);
    console.log(
      "  Added: Withdraw LP from Raydium (",
      lpBalance.toString(),
      "LP tokens)",
    );
    console.log(
      "    Expected base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    Expected quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );
  }

  // Calculate total amounts to transfer (existing + LP withdrawal)
  const totalBaseToTransfer = baseBalance + expectedBaseFromLp;
  const totalQuoteToTransfer = quoteBalance + expectedQuoteFromLp;

  // 6c. Transfer base tokens from V5 vault to V6 vault
  if (totalBaseToTransfer > 0n) {
    vaultInstructions.push(
      createTransferInstruction(
        v5VaultBaseAta,
        v6VaultBaseAta,
        v5VaultPda,
        totalBaseToTransfer,
      ),
    );
    console.log(
      "  Added: Transfer base tokens:",
      (Number(totalBaseToTransfer) / baseMultiplier).toLocaleString(),
    );
  }

  // 6d. Transfer quote tokens from V5 vault to V6 vault
  if (totalQuoteToTransfer > 0n) {
    vaultInstructions.push(
      createTransferInstruction(
        v5VaultQuoteAta,
        v6VaultQuoteAta,
        v5VaultPda,
        totalQuoteToTransfer,
      ),
    );
    console.log(
      "  Added: Transfer quote tokens:",
      (Number(totalQuoteToTransfer) / quoteMultiplier).toLocaleString(),
    );
  }

  // 6d. Transfer mint authority from V5 vault to V6 vault
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

  // 6e. Transfer metadata update authority from V5 vault to V6 vault
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
        const umiUpdateIxs = updateMetadataAccountV2(umi, {
          metadata: UmiPublicKey(metadataAddr.toBase58()),
          newUpdateAuthority: UmiPublicKey(v6VaultPda.toBase58()),
        }).getInstructions();

        for (const umiIx of umiUpdateIxs) {
          vaultInstructions.push(toWeb3JsInstruction(umiIx));
        }
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

  // Step 7: Create Squads vault transaction + proposal
  console.log("\n[7] Creating Squads vault transaction and proposal...");

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

  // Step 8: Build V5 futarchy proposal market transactions
  console.log("\n[8] Building V5 futarchy proposal markets...");

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

  const txns: Transaction[] = [];

  // Transaction 1: Squads vault tx + proposal creation
  const squadsTx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  txns.push(squadsTx);

  // Transaction 2: Initialize question
  const questionTx = await vaultClient
    .initializeQuestionIx(
      sha256(`Will ${metaDaoProposal} pass?/FAIL/PASS`),
      metaDaoProposal,
      2,
    )
    .transaction();
  txns.push(questionTx);

  // Transaction 3: Initialize vaults and AMMs
  const vaultsTx = await vaultClient
    .initializeVaultIx(question, v5Dao.baseMint, 2)
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

  // Transaction 4: Split tokens
  const splitTokensTx = await vaultClient
    .splitTokensIx(question, baseVault, v5Dao.baseMint, minBaseLiquidity, 2)
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

  // Transaction 5: Add liquidity to AMMs
  const addLiquidityTx = await ammClient
    .addLiquidityIx(
      passAmm,
      passBaseMint,
      passQuoteMint,
      minQuoteLiquidity,
      minBaseLiquidity,
      new BN(0),
    )
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

  // Transaction 6: Initialize proposal
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
    .transaction();
  txns.push(proposalTx);

  console.log("  Total transactions to bundle:", txns.length);

  // Step 9: Bundle and send with Jito
  console.log("\n[9] Bundling and sending with Jito...");

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

  console.log("\nSUMMARY:");
  console.log("  V5 DAO:", V5_DAO_ADDRESS.toBase58());
  console.log("  V6 DAO:", V6_DAO_ADDRESS.toBase58());
  console.log("  Squads Proposal PDA:", squadsProposalPda.toBase58());
  console.log("  MetaDAO Proposal PDA:", metaDaoProposal.toBase58());
  console.log("\nMIGRATION ACTIONS (when proposal passes):");
  if (lpBalance > 0n) {
    console.log("  - Withdraw Raydium LP tokens:", lpBalance.toString());
    console.log(
      "    → Expected base:",
      (Number(expectedBaseFromLp) / baseMultiplier).toLocaleString(),
    );
    console.log(
      "    → Expected quote:",
      (Number(expectedQuoteFromLp) / quoteMultiplier).toLocaleString(),
    );
  }
  if (totalBaseToTransfer > 0n) {
    console.log(
      "  - Transfer",
      (Number(totalBaseToTransfer) / baseMultiplier).toLocaleString(),
      "base tokens to V6 vault",
    );
  }
  if (totalQuoteToTransfer > 0n) {
    console.log(
      "  - Transfer",
      (Number(totalQuoteToTransfer) / quoteMultiplier).toLocaleString(),
      "quote tokens to V6 vault",
    );
  }
  if (currentMintAuthority && currentMintAuthority.equals(v5VaultPda)) {
    console.log("  - Transfer mint authority to V6 vault");
  }
  console.log(
    "\nNOTE: The V6 DAO must already be initialized before running this script.",
  );
  console.log(
    "      The vault transaction (fund transfer + mint authority) only executes if the proposal passes.",
  );
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

  // Also sign with PERMISSIONLESS_ACCOUNT for squads (first transaction)
  signedTxns[0].partialSign(PERMISSIONLESS_ACCOUNT);

  console.log("  Transactions signed");
  return signedTxns;
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
