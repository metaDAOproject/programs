import * as anchor from "@coral-xyz/anchor";
import {
  FutarchyClient,
  PERMISSIONLESS_ACCOUNT,
  MAINNET_USDC,
  Dao,
} from "@metadaoproject/futarchy/v0.6";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as multisig from "@sqds/multisig";

const DAO = new PublicKey("AE7jPb9jYzbUE5GYJToKvXaRkJL2Q7Mm3Ek6KqyBGuxe");
const INPUT_MINT = MAINNET_USDC; // USDC
const OUTPUT_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
); // Output token

// Jupiter recurring order parameters
const IN_AMOUNT = 1_000_000_000; // Raw amount before decimals, (1_000_000 is $1)
const NUMBER_OF_ORDERS = 10;
const INTERVAL = 300; // Time between orders in seconds (86400 = 1 day)
const MIN_PRICE = null;
const MAX_PRICE = 300; // set this to the ACTAUL price you want to target, it's that easy so 0.25 for loyal
const START_AT = null; // null = start immediately

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const futarchy = FutarchyClient.createClient({ provider });

const createBuybackSquadsProposal = async () => {
  console.log("Creating Squads proposal for Jupiter buyback...\n");

  // Validate minimum order size
  const amountPerOrder = IN_AMOUNT / NUMBER_OF_ORDERS;
  const MIN_ORDER_AMOUNT = 50_000_000; // $50 in USDC (6 decimals)

  if (amountPerOrder < MIN_ORDER_AMOUNT) {
    throw new Error(
      `Each order must be at least $50. ` +
        `Current: $${(amountPerOrder / 1_000_000).toFixed(2)} per order. ` +
        `Either increase IN_AMOUNT or decrease NUMBER_OF_ORDERS.`,
    );
  }

  // Step 1: Get DAO and transaction index
  console.log("Step 1: Fetching DAO and transaction index...");
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

  const multisigPda = dao.squadsMultisig;

  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
    provider.connection,
    multisigPda,
  );
  const currentTransactionIndex = Number(multisigAccount.transactionIndex);
  const nextTransactionIndex = BigInt(currentTransactionIndex + 1);
  console.log(`  Current transaction index: ${currentTransactionIndex}`);
  console.log(`  Next transaction index: ${nextTransactionIndex}`);
  console.log(`  Output mint: ${OUTPUT_MINT.toBase58()}\n`);

  // Step 2: Get vault PDA
  console.log("Step 2: Getting vault PDA...");
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
  });
  console.log(`  Vault PDA: ${vaultPda.toBase58()}\n`);

  // Step 3: Check USDC balance in vault
  console.log("Step 3: Checking vault USDC balance...");
  const vaultUsdcAccount = getAssociatedTokenAddressSync(
    INPUT_MINT,
    vaultPda,
    true, // allowOwnerOffCurve
  );

  let vaultBalance: bigint;
  try {
    const accountInfo = await getAccount(provider.connection, vaultUsdcAccount);
    vaultBalance = accountInfo.amount;
  } catch (error) {
    throw new Error(
      `Failed to fetch vault USDC balance. ` +
        `Vault token account: ${vaultUsdcAccount.toBase58()}. ` +
        `Make sure the vault has a USDC token account. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const vaultBalanceNumber = Number(vaultBalance);
  const requiredAmount = IN_AMOUNT;

  console.log(
    `  Vault USDC balance: ${(vaultBalanceNumber / 1_000_000).toFixed(2)} USDC`,
  );
  console.log(
    `  Required amount: ${(requiredAmount / 1_000_000).toFixed(2)} USDC`,
  );

  if (vaultBalanceNumber < requiredAmount) {
    throw new Error(
      `Insufficient USDC in vault. ` +
        `Required: $${(requiredAmount / 1_000_000).toFixed(2)}, ` +
        `Available: $${(vaultBalanceNumber / 1_000_000).toFixed(2)}`,
    );
  }
  console.log(`  ✓ Vault has sufficient USDC\n`);

  // Step 4: Call Jupiter recurring order API
  console.log("Step 4: Calling Jupiter recurring order API...");
  const createOrderResponse = await fetch(
    "https://lite-api.jup.ag/recurring/v1/createOrder",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: vaultPda.toBase58(),
        inputMint: INPUT_MINT.toBase58(),
        outputMint: OUTPUT_MINT.toBase58(),
        params: {
          time: {
            inAmount: IN_AMOUNT,
            numberOfOrders: NUMBER_OF_ORDERS,
            interval: INTERVAL,
            minPrice: MIN_PRICE,
            maxPrice: MAX_PRICE,
            startAt: START_AT,
          },
        },
      }),
    },
  );

  const orderData = await createOrderResponse.json();
  console.log(`  Order request ID: ${orderData.requestId}\n`);

  // Step 5: Extract Jupiter instructions from response
  console.log("Step 5: Extracting Jupiter instructions...");
  const jupiterTx = VersionedTransaction.deserialize(
    Buffer.from(orderData.transaction, "base64"),
  );

  // Log all instructions to see what we're dealing with
  console.log(
    `  Total instructions in Jupiter tx: ${jupiterTx.message.compiledInstructions.length}`,
  );
  jupiterTx.message.compiledInstructions.forEach((ix, idx) => {
    const programId = jupiterTx.message.staticAccountKeys[ix.programIdIndex];
    console.log(
      `    [${idx}] Program: ${programId.toBase58()}, Accounts: ${ix.accountKeyIndexes.length}, Data: ${ix.data.length} bytes`,
    );
  });

  // Extract all non-compute-budget instructions
  const COMPUTE_BUDGET_PROGRAM = new PublicKey(
    "ComputeBudget111111111111111111111111111111",
  );
  const vaultInstructions: TransactionInstruction[] = [];

  for (const ix of jupiterTx.message.compiledInstructions) {
    const programId = jupiterTx.message.staticAccountKeys[ix.programIdIndex];
    if (!programId.equals(COMPUTE_BUDGET_PROGRAM)) {
      const instruction = new TransactionInstruction({
        programId,
        keys: ix.accountKeyIndexes.map((keyIndex) => {
          const accountKey = jupiterTx.message.staticAccountKeys[keyIndex];
          return {
            pubkey: accountKey,
            isSigner: jupiterTx.message.isAccountSigner(keyIndex),
            isWritable: jupiterTx.message.isAccountWritable(keyIndex),
          };
        }),
        data: Buffer.from(ix.data),
      });
      vaultInstructions.push(instruction);
    }
  }

  if (vaultInstructions.length === 0) {
    throw new Error("Could not find any Jupiter instructions in transaction");
  }

  console.log(
    `\n  Extracted ${vaultInstructions.length} instruction(s) for vault execution\n`,
  );

  // Step 6: Create Squads proposal transaction
  // NOTE: The SDK's squadsProposalCreateTx has a bug - it uses the payer as the payerKey
  // in the TransactionMessage, but it should use the vault PDA. So we do it manually.
  console.log("Step 6: Creating Squads proposal transaction...");

  // Create vault transaction message with vault as payer (not user payer!)
  const { blockhash: vaultBlockhash } =
    await provider.connection.getLatestBlockhash();
  const transactionMessage = new TransactionMessage({
    payerKey: vaultPda, // This MUST be the vault, not the user payer
    recentBlockhash: vaultBlockhash,
    instructions: vaultInstructions, // Include all Jupiter instructions (ATA + recurring order)
  });

  // Create vault transaction instruction
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: nextTransactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  // Create proposal instruction
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex: nextTransactionIndex,
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  // Get the squads proposal PDA
  const [squadsProposal] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: nextTransactionIndex,
  });

  // Create the transaction with both instructions
  const squadsProposalTx = new Transaction().add(
    vaultTxCreateIx,
    proposalCreateIx,
  );

  console.log(`  Squads proposal PDA: ${squadsProposal.toBase58()}\n`);

  // Step 7: Send transaction
  console.log("Step 7: Sending transaction...");
  const { blockhash } = await provider.connection.getLatestBlockhash();
  squadsProposalTx.recentBlockhash = blockhash;
  squadsProposalTx.feePayer = payer.publicKey;
  squadsProposalTx.sign(payer);
  squadsProposalTx.partialSign(PERMISSIONLESS_ACCOUNT);

  const txHash = await provider.connection.sendRawTransaction(
    squadsProposalTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");
  console.log(`  Transaction: ${txHash}\n`);

  // Step 8: Log results
  console.log("SUCCESS: Squads proposal created!");
  console.log("============================================");
  console.log(`Transaction: ${txHash}`);
  console.log(`Squads Proposal: ${squadsProposal.toBase58()}`);
  console.log(`DAO: ${DAO.toBase58()}`);
  console.log(`Input Mint: ${INPUT_MINT.toBase58()}`);
  console.log(`Output Mint: ${OUTPUT_MINT.toBase58()}`);
  console.log(`Amount: ${IN_AMOUNT}`);
  console.log(`Number of Orders: ${NUMBER_OF_ORDERS}`);
  console.log(`Interval: ${INTERVAL} seconds`);
  console.log("============================================");
  console.log(
    "\nNext step: Run the initialize script with this Squads proposal address",
  );
};

createBuybackSquadsProposal().catch((error) => {
  console.error("ERROR: Failed to create Squads proposal:");
  console.error(error);
  process.exit(1);
});
