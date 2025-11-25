import * as anchor from "@coral-xyz/anchor";
import { MAINNET_USDC } from "@metadaoproject/futarchy/v0.6";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

// Configuration - Update these values
const INPUT_MINT = MAINNET_USDC; // USDC
const OUTPUT_MINT = new PublicKey(
  "LYLikzBQtpa9ZgVrJsqYGQpR3cC1WMJrBHaXGrQmeta",
); // Output token

// Jupiter recurring order parameters
const IN_AMOUNT = 100_000_000; // Raw amount before decimals (1_000_000 is $1)
const NUMBER_OF_ORDERS = 2;
const INTERVAL = 60; // Time between orders in seconds
const MIN_PRICE = null;
const MAX_PRICE = 0.19; // not sure how this work 0.25 was the last tested value
const START_AT = null; // null = start immediately

// rawMinOutAmount == (IN_AMOUNT / NUMBER_OF_ORDERS) / MAX_PRICE
// implies a price of $0.10
// $0.00000438

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const executeRecurringOrder = async () => {
  console.log("Creating and executing Jupiter recurring order...\n");

  // Step 1: Create order via Jupiter API
  console.log("Step 1: Creating order via Jupiter API...");
  console.log(`  User (signer): ${payer.publicKey.toBase58()}`);
  console.log(`  Input mint: ${INPUT_MINT.toBase58()}`);
  console.log(`  Output mint: ${OUTPUT_MINT.toBase58()}`);
  console.log(`  Amount: $${(IN_AMOUNT / 1_000_000).toFixed(2)}`);
  console.log(`  Number of orders: ${NUMBER_OF_ORDERS}`);
  console.log(`  Interval: ${INTERVAL} seconds\n`);

  const createOrderResponse = await fetch(
    "https://lite-api.jup.ag/recurring/v1/createOrder",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: payer.publicKey.toBase58(),
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

  if (!createOrderResponse.ok) {
    const errorText = await createOrderResponse.text();
    throw new Error(
      `Jupiter API request failed: ${createOrderResponse.status} ${createOrderResponse.statusText}\n${errorText}`,
    );
  }

  const orderData = await createOrderResponse.json();
  console.log(`  ✓ Order created`);
  console.log(`  Request ID: ${orderData.requestId}\n`);

  // Step 2: Deserialize the transaction
  console.log("Step 2: Deserializing transaction...");
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(orderData.transaction, "base64"),
  );
  console.log(`  ✓ Transaction deserialized\n`);

  // Step 3: Sign the transaction
  console.log("Step 3: Signing transaction...");
  transaction.sign([payer]);
  console.log(`  ✓ Transaction signed\n`);

  // Step 4: Serialize the signed transaction to base64
  console.log("Step 4: Serializing signed transaction...");
  const signedTransaction = Buffer.from(transaction.serialize()).toString(
    "base64",
  );
  console.log(`  ✓ Transaction serialized\n`);

  // Step 5: Send to Jupiter's execute endpoint
  console.log("Step 5: Sending to Jupiter execute endpoint...");
  const executeResponse = await fetch(
    "https://lite-api.jup.ag/recurring/v1/execute",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestId: orderData.requestId,
        signedTransaction: signedTransaction,
      }),
    },
  );

  if (!executeResponse.ok) {
    const errorText = await executeResponse.text();
    throw new Error(
      `Jupiter execute request failed: ${executeResponse.status} ${executeResponse.statusText}\n${errorText}`,
    );
  }

  const executeData = await executeResponse.json();
  const txHash = executeData.txid || executeData.signature;
  console.log(`  ✓ Transaction executed via Jupiter`);
  console.log(`  Transaction: ${txHash}\n`);

  // Step 6: Log results
  console.log("SUCCESS: Jupiter recurring order executed!");
  console.log("============================================");
  console.log(`Transaction: ${txHash}`);
  console.log(`Request ID: ${orderData.requestId}`);
  console.log(`User: ${payer.publicKey.toBase58()}`);
  console.log(`Input Mint: ${INPUT_MINT.toBase58()}`);
  console.log(`Output Mint: ${OUTPUT_MINT.toBase58()}`);
  console.log(`Amount: $${(IN_AMOUNT / 1_000_000).toFixed(2)}`);
  console.log(`Number of Orders: ${NUMBER_OF_ORDERS}`);
  console.log(`Interval: ${INTERVAL} seconds`);
  console.log("============================================");
};

executeRecurringOrder().catch((error) => {
  console.error("ERROR: Failed to execute recurring order:");
  console.error(error);
  process.exit(1);
});
