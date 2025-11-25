import * as anchor from "@coral-xyz/anchor";
import { sha256 } from "@noble/hashes/sha256";
import {
  FutarchyClient,
  getProposalAddrV2,
  Dao,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const DAO = new PublicKey("AE7jPb9jYzbUE5GYJToKvXaRkJL2Q7Mm3Ek6KqyBGuxe");
const SQUADS_PROPOSAL = new PublicKey(
  "WYxwxUu3s8N7w5MPNLq9zAnUPhDUsVqDpibzdReRoFW",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchy = FutarchyClient.createClient({ provider });

const initializeBuybackProposal = async () => {
  console.log("Initializing Futarchy proposal for buyback...\n");

  // Step 1: Get DAO
  console.log("Step 1: Fetching DAO...");
  let dao: Dao;
  try {
    dao = await futarchy.getDao(DAO);
    if (!dao) {
      throw new Error("DAO not found");
    }
  } catch (error) {
    throw new Error(
      `Failed to fetch DAO at ${DAO.toBase58()}. ` +
        `Make sure the DAO address is correct and exists on-chain. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  console.log(`  DAO base mint: ${dao.baseMint.toBase58()}`);
  console.log(`  DAO quote mint: ${dao.quoteMint.toBase58()}\n`);

  // Step 2: Get proposal PDAs
  console.log("Step 2: Getting proposal PDAs...");
  const [proposal] = getProposalAddrV2({ squadsProposal: SQUADS_PROPOSAL });
  const { question, baseVault, quoteVault } = futarchy.getProposalPdas(
    proposal,
    dao.baseMint,
    dao.quoteMint,
    DAO,
  );
  console.log(`  Futarchy proposal: ${proposal.toBase58()}`);
  console.log(`  Question: ${question.toBase58()}\n`);

  // Step 3: Create Futarchy initialization transaction
  console.log("Step 3: Creating Futarchy initialization transaction...");
  const futarchyTx = new Transaction();
  const { blockhash } = await provider.connection.getLatestBlockhash();
  futarchyTx.recentBlockhash = blockhash;
  futarchyTx.feePayer = payer.publicKey;
  futarchyTx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));

  // Create associated token accounts for vaults
  const baseVaultTokenAccount = getAssociatedTokenAddressSync(
    dao.baseMint,
    baseVault,
    true,
  );
  const quoteVaultTokenAccount = getAssociatedTokenAddressSync(
    dao.quoteMint,
    quoteVault,
    true,
  );

  futarchyTx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      baseVaultTokenAccount,
      baseVault,
      dao.baseMint,
    ),
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      quoteVaultTokenAccount,
      quoteVault,
      dao.quoteMint,
    ),
  );

  // Add Futarchy initialization instructions
  const questionIx = await futarchy.vaultClient
    .initializeQuestionIx(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2,
    )
    .accounts({ payer: payer.publicKey })
    .instruction();

  const baseVaultIx = await futarchy.vaultClient
    .initializeVaultIx(question, dao.baseMint, 2, payer.publicKey)
    .accounts({ payer: payer.publicKey })
    .instruction();

  const quoteVaultIx = await futarchy.vaultClient
    .initializeVaultIx(question, dao.quoteMint, 2, payer.publicKey)
    .accounts({ payer: payer.publicKey })
    .instruction();

  const proposalIx = await futarchy
    .initializeProposalIx(
      SQUADS_PROPOSAL,
      DAO,
      dao.baseMint,
      dao.quoteMint,
      question,
      payer.publicKey,
    )
    .accounts({ payer: payer.publicKey })
    .instruction();

  futarchyTx.add(questionIx, baseVaultIx, quoteVaultIx, proposalIx);
  console.log(`  Futarchy initialization transaction prepared\n`);

  // Step 4: Send transaction
  console.log("Step 4: Sending transaction...");
  futarchyTx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(
    futarchyTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");
  console.log(`  Transaction: ${txHash}\n`);

  // Step 5: Log results
  console.log("SUCCESS: Futarchy proposal initialized!");
  console.log("============================================");
  console.log(`Transaction: ${txHash}`);
  console.log(`Squads Proposal: ${SQUADS_PROPOSAL.toBase58()}`);
  console.log(`Futarchy Proposal: ${proposal.toBase58()}`);
  console.log(`DAO: ${DAO.toBase58()}`);
  console.log(`Question: ${question.toBase58()}`);
  console.log("============================================");
};

initializeBuybackProposal().catch((error) => {
  console.error("ERROR: Failed to initialize Futarchy proposal:");
  console.error(error);
  process.exit(1);
});
