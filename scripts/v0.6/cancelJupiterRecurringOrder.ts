import * as anchor from "@coral-xyz/anchor";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";

// Configuration - Update these values
const ORDER = new PublicKey("5Z81d65f48gfwJTKkdcG8VQhSHQbvwGf3Qvjv8ax9wxE"); // The order to cancel
const RECURRING_TYPE = "time"; // Always "time" for time-based recurring orders
const USER = new PublicKey("ELT1uRmtFvYP6WSrc4mCZaW7VVbcdkcKAj39aHSVCmwH"); // The user who owns the order

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const cancelRecurringOrder = async () => {
  console.log("Canceling Jupiter recurring order...\n");

  // Verify that the payer is the user (they must match to cancel)
  if (!payer.publicKey.equals(USER)) {
    console.warn(
      `WARNING: Payer (${payer.publicKey.toBase58()}) does not match USER (${USER.toBase58()})`,
    );
    console.warn(
      "The transaction will likely fail unless the payer owns the order.\n",
    );
  }

  // Step 1: Call Jupiter cancel order API
  console.log("Step 1: Calling Jupiter cancelOrder API...");
  console.log(`  Order: ${ORDER.toBase58()}`);
  console.log(`  Recurring Type: ${RECURRING_TYPE}`);
  console.log(`  User: ${USER.toBase58()}\n`);

  const cancelOrderResponse = await fetch(
    "https://lite-api.jup.ag/recurring/v1/cancelOrder",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        order: ORDER.toBase58(),
        recurringType: RECURRING_TYPE,
        user: USER.toBase58(),
      }),
    },
  );

  if (!cancelOrderResponse.ok) {
    const errorText = await cancelOrderResponse.text();
    throw new Error(
      `Jupiter cancelOrder API request failed: ${cancelOrderResponse.status} ${cancelOrderResponse.statusText}\n${errorText}`,
    );
  }

  const cancelData = await cancelOrderResponse.json();
  console.log(`  ✓ Cancel order response received`);
  if (cancelData.requestId) {
    console.log(`  Request ID: ${cancelData.requestId}`);
  }
  console.log();

  // Step 2: Deserialize the transaction
  console.log("Step 2: Deserializing transaction...");
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(cancelData.transaction, "base64"),
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
        requestId: cancelData.requestId,
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
  console.log("SUCCESS: Jupiter recurring order canceled!");
  console.log("============================================");
  console.log(`Transaction: ${txHash}`);
  if (cancelData.requestId) {
    console.log(`Request ID: ${cancelData.requestId}`);
  }
  console.log(`Order: ${ORDER.toBase58()}`);
  console.log(`User: ${USER.toBase58()}`);
  console.log("============================================");
};

cancelRecurringOrder().catch((error) => {
  console.error("ERROR: Failed to cancel recurring order:");
  console.error(error);
  process.exit(1);
});
