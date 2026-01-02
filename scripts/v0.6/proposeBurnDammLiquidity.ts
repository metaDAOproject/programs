import "dotenv/config";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import * as multisig from "@sqds/multisig";
import {
  createBurnInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import { CpAmm, getCurrentPoint, ActivationType } from "@meteora-ag/cp-amm-sdk";

import {
  FutarchyClient,
  PERMISSIONLESS_ACCOUNT,
  DAMM_V2_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
  LAUNCHPAD_PROGRAM_ID,
  getProposalAddr,
  InstructionUtils,
} from "@metadaoproject/futarchy/v0.6";

import { getSquadsPdasFromDao } from "../utils/squads.js";
import {
  sendBundle,
  getTipAccounts,
  getTipFloor,
  getBundleStatuses,
} from "../utils/bundles.js";

const DAO_ADDRESS = new PublicKey(
  "DMB74TZgN7Rqfwtqqm3VQBgKBb2WYPdBqVtHbvB4LLeV",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchy = FutarchyClient.createClient({ provider });

// DAMM v2 seed prefixes (from damm_v2_cpi)
const POOL_PREFIX = Buffer.from("pool");
const POSITION_PREFIX = Buffer.from("position");
const POSITION_NFT_ACCOUNT_PREFIX = Buffer.from("position_nft_account");
const TOKEN_VAULT_PREFIX = Buffer.from("token_vault");

// Helper functions for pool PDA derivation
function maxKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBytes = left.toBuffer();
  const rightBytes = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBytes[i] > rightBytes[i]) return leftBytes;
    if (leftBytes[i] < rightBytes[i]) return rightBytes;
  }
  return leftBytes;
}

function minKey(left: PublicKey, right: PublicKey): Buffer {
  const leftBytes = left.toBuffer();
  const rightBytes = right.toBuffer();
  for (let i = 0; i < 32; i++) {
    if (leftBytes[i] < rightBytes[i]) return leftBytes;
    if (leftBytes[i] > rightBytes[i]) return rightBytes;
  }
  return leftBytes;
}

async function main() {
  if (!process.env.JITO_AUTH_TOKEN) {
    console.log(
      "Warning: No Jito auth token provided, results may be unreliable",
    );
  }

  console.log("=".repeat(60));
  console.log("PROPOSE BURN DAMM V2 LIQUIDITY");
  console.log("=".repeat(60));
  console.log("DAO Address:", DAO_ADDRESS.toBase58());

  console.log("\n[1] Fetching DAO data...");
  const dao = await futarchy.getDao(DAO_ADDRESS);
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  console.log("  Base Mint:", dao.baseMint.toBase58());
  console.log("  Quote Mint:", dao.quoteMint.toBase58());
  console.log("  Squads Multisig:", multisigPda.toBase58());
  console.log("  Vault PDA:", vaultPda.toBase58());

  console.log("\n[2] Deriving DAMM v2 pool PDAs...");

  // Position NFT mint is derived by launchpad
  const [positionNftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from("position_nft_mint"), dao.baseMint.toBuffer()],
    LAUNCHPAD_PROGRAM_ID,
  );

  // Pool PDA
  const [poolAddress] = PublicKey.findProgramAddressSync(
    [
      POOL_PREFIX,
      MAINNET_METEORA_CONFIG.toBuffer(),
      maxKey(dao.baseMint, dao.quoteMint),
      minKey(dao.baseMint, dao.quoteMint),
    ],
    DAMM_V2_PROGRAM_ID,
  );

  // Position PDA
  const [positionAddress] = PublicKey.findProgramAddressSync(
    [POSITION_PREFIX, positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // Position NFT account (where the NFT is held)
  const [positionNftAccount] = PublicKey.findProgramAddressSync(
    [POSITION_NFT_ACCOUNT_PREFIX, positionNftMint.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  // Token vaults
  const [tokenAVault] = PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_PREFIX, dao.baseMint.toBuffer(), poolAddress.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );
  const [tokenBVault] = PublicKey.findProgramAddressSync(
    [TOKEN_VAULT_PREFIX, dao.quoteMint.toBuffer(), poolAddress.toBuffer()],
    DAMM_V2_PROGRAM_ID,
  );

  console.log("  Pool Address:", poolAddress.toBase58());
  console.log("  Position NFT Mint:", positionNftMint.toBase58());
  console.log("  Position Address:", positionAddress.toBase58());
  console.log("  Position NFT Account:", positionNftAccount.toBase58());

  console.log("\n[3] Fetching pool and position state...");

  const cpAmm = new CpAmm(provider.connection);
  const poolState = await cpAmm.fetchPoolState(poolAddress);
  const positionState = await cpAmm.fetchPositionState(positionAddress);

  // Get current point for rate limiter
  const currentPoint = await getCurrentPoint(
    provider.connection,
    ActivationType.Slot,
  );

  console.log("  Pool sqrt price:", poolState.sqrtPrice.toString());
  console.log(
    "  Position unlocked liquidity:",
    positionState.unlockedLiquidity.toString(),
  );

  // Calculate 90% of liquidity to remove
  // this is configurable, so adjust this to determine how much to withdraw
  const liquidityToRemove = positionState.unlockedLiquidity
    .mul(new BN(90))
    .div(new BN(100));
  console.log("  Liquidity to remove (90%):", liquidityToRemove.toString());

  // Get withdrawal quote
  const withdrawQuote = cpAmm.getWithdrawQuote({
    liquidityDelta: liquidityToRemove,
    sqrtPrice: poolState.sqrtPrice,
    minSqrtPrice: poolState.sqrtMinPrice,
    maxSqrtPrice: poolState.sqrtMaxPrice,
  });

  const baseToWithdraw = withdrawQuote.outAmountA.toNumber() / 1e6;
  const quoteToWithdraw = withdrawQuote.outAmountB.toNumber() / 1e6;
  console.log("  Expected token A (base):", baseToWithdraw.toLocaleString());
  console.log("  Expected token B (quote):", quoteToWithdraw.toLocaleString());
  console.log("  Note: Fees are NOT being claimed (separate instruction)");

  console.log("\n[4] Building vault transaction instructions...");

  // Vault's token accounts for received tokens
  const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
    dao.baseMint,
    vaultPda,
    true, // allowOwnerOffCurve for PDA
  );
  const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
    dao.quoteMint,
    vaultPda,
    true,
  );

  // Ensure vault quote token account exists (for any quote tokens received)
  const createVaultQuoteAtaIx =
    createAssociatedTokenAccountIdempotentInstruction(
      vaultPda, // payer
      vaultQuoteTokenAccount,
      vaultPda,
      dao.quoteMint,
    );

  console.log("  Vault base ATA:", vaultBaseTokenAccount.toBase58());
  console.log("  Vault quote ATA:", vaultQuoteTokenAccount.toBase58());
  if (quoteToWithdraw > 0) {
    console.log(
      "  Quote tokens received will stay in vault treasury:",
      quoteToWithdraw.toLocaleString(),
    );
  }

  // Instruction 1: Remove liquidity from DAMM v2
  const removeLiquidityTx = await cpAmm.removeLiquidity({
    owner: vaultPda,
    pool: poolAddress,
    position: positionAddress,
    positionNftAccount: positionNftAccount,
    liquidityDelta: liquidityToRemove,
    tokenAAmountThreshold: new BN(0), // Set slippage as needed
    tokenBAmountThreshold: new BN(0),
    tokenAMint: dao.baseMint,
    tokenBMint: dao.quoteMint,
    tokenAVault: tokenAVault,
    tokenBVault: tokenBVault,
    tokenAProgram: TOKEN_PROGRAM_ID,
    tokenBProgram: TOKEN_PROGRAM_ID,
    vestings: [], // No vestings to refresh
    currentPoint: currentPoint,
  });

  const removeLiquidityIxs = removeLiquidityTx.instructions;
  console.log("  Remove liquidity instructions:", removeLiquidityIxs.length);

  // Instruction 2: Burn 50% of the base tokens received
  // We only burn 50% because the actual outAmountA can drift between proposal
  // creation and execution - the remainder will stay in the DAO treasury
  const burnAmount = withdrawQuote.outAmountA.div(new BN(2));
  const burnIx = createBurnInstruction(
    vaultBaseTokenAccount,
    dao.baseMint,
    vaultPda,
    BigInt(burnAmount.toString()),
  );

  const burnAmountHuman = burnAmount.toNumber() / 1e6;
  console.log(
    "  Burn instruction created for:",
    burnAmountHuman.toLocaleString(),
    "tokens (50% of withdrawn)",
  );
  console.log(
    "  Remaining ~",
    (baseToWithdraw - burnAmountHuman).toLocaleString(),
    "tokens will stay in DAO treasury",
  );

  // Combine all instructions for the vault transaction
  // 1. Create quote ATA if needed (for any USDC received)
  // 2. Remove liquidity from pool
  // 3. Burn the base tokens
  const vaultInstructions = [
    createVaultQuoteAtaIx,
    ...removeLiquidityIxs,
    burnIx,
  ];

  console.log("\n[5] Creating Squads vault transaction and proposal...");

  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
  const transactionIndex = currentTransactionIndex + 1;
  console.log("  Current transaction index:", currentTransactionIndex);
  console.log("  New transaction index:", transactionIndex);

  // Use FutarchyClient helper to create squads proposal
  const { tx: squadsTx, squadsProposal: squadsProposalPda } =
    futarchy.squadsProposalCreateTx({
      dao: DAO_ADDRESS,
      instructions: vaultInstructions,
      transactionIndex: BigInt(transactionIndex),
      payer: payer.publicKey,
    });

  console.log("  Squads Proposal PDA:", squadsProposalPda.toBase58());

  console.log("\n[6] Initializing futarchy proposal markets...");

  // Derive futarchy proposal address
  const [metaDaoProposal] = getProposalAddr(
    futarchy.getProgramId(),
    squadsProposalPda,
  );
  console.log("  Futarchy Proposal PDA:", metaDaoProposal.toBase58());

  // Get proposal PDAs
  const { passBaseMint, passQuoteMint, failBaseMint, failQuoteMint, question } =
    futarchy.getProposalPdas(
      metaDaoProposal,
      dao.baseMint,
      dao.quoteMint,
      DAO_ADDRESS,
    );

  // Build futarchy proposal transactions
  const txns: Transaction[] = [];

  // Transaction 1: Squads vault tx + proposal creation
  txns.push(squadsTx);

  // Transaction 2: Initialize question
  const questionTx = await futarchy.vaultClient
    .initializeQuestionIx(
      sha256(`Will ${metaDaoProposal} pass?/FAIL/PASS`),
      metaDaoProposal,
      2,
    )
    .transaction();
  txns.push(questionTx);

  // Transaction 3: Initialize vaults
  const vaultsTx = await futarchy.vaultClient
    .initializeVaultIx(question, dao.baseMint, 2)
    .postInstructions(
      await InstructionUtils.getInstructions(
        futarchy.vaultClient.initializeVaultIx(question, dao.quoteMint, 2),
      ),
    )
    .transaction();
  txns.push(vaultsTx);

  // Transaction 4: Initialize proposal with preInstructions for token accounts
  const [futarchyAmm] = PublicKey.findProgramAddressSync(
    [Buffer.from("futarchy_amm")],
    futarchy.getProgramId(),
  );

  const proposalTx = await futarchy
    .initializeProposalIx(
      squadsProposalPda,
      DAO_ADDRESS,
      dao.baseMint,
      dao.quoteMint,
      question,
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
        futarchyAmm,
        passBaseMint,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
        futarchyAmm,
        passQuoteMint,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
        futarchyAmm,
        failBaseMint,
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
        futarchyAmm,
        failQuoteMint,
      ),
    ])
    .transaction();
  txns.push(proposalTx);

  console.log("  Total transactions to bundle:", txns.length);

  console.log("\n[7] Bundling and sending with Jito...");

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
  console.log("  Pool address:", poolAddress.toBase58());
  console.log("  Tokens to burn (50%):", burnAmountHuman.toLocaleString());
  console.log(
    "  Tokens remaining in DAO:",
    (baseToWithdraw - burnAmountHuman).toLocaleString(),
  );
  console.log("  Fees claimed: NO (can be claimed separately later)");
  console.log("  Squads Proposal PDA:", squadsProposalPda.toBase58());
  console.log("  Futarchy Proposal PDA:", metaDaoProposal.toBase58());
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
