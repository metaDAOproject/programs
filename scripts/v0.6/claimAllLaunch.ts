import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.6";
import dotenv from "dotenv";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchAddr = new PublicKey(
  "9kx7UDFzFt7e2V4pFtawnupKKvRR3EhV7P1Pxmc5XCQj",
);

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

async function main() {
  const launch = await launchpad.getLaunch(launchAddr);

  // Get all funding records
  const allFundingRecords =
    await launchpad.launchpad.account.fundingRecord.all();

  // Filter funding records for this specific launch
  const launchFundingRecords = allFundingRecords.filter(
    (record) => record.account.launch.toString() === launchAddr.toString(),
  );

  console.log(
    `Found ${launchFundingRecords.length} funding records for this launch`,
  );

  if (launchFundingRecords.length === 0) {
    console.log("No funding records found for this launch");
    return;
  }

  // Process in batches of 5 claims per transaction
  const batchSize = 5;
  for (let i = 0; i < launchFundingRecords.length; i += batchSize) {
    const batch = launchFundingRecords.slice(i, i + batchSize);

    console.log(batch);

    console.log(
      `Processing batch ${i / batchSize + 1} with ${batch.length} records`,
    );

    const tx = new Transaction();

    // Add compute budget instruction to handle multiple claims
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }));

    // Add claim instructions for each record in the batch
    for (const record of batch) {
      const claimIx = await launchpad
        .claimIx(launchAddr, launch.baseMint, record.account.funder)
        .transaction();

      tx.add(claimIx);
    }

    await sendAndConfirmTransaction(tx, `Claim batch ${i / batchSize + 1}`);

    for (const record of batch) {
      const refundIx = await launchpad
        .refundIx({
          launch: launchAddr,
          funder: record.account.funder,
          quoteMint: launch.baseMint,
        })
        .transaction();

      tx.add(refundIx);
    }

    await sendAndConfirmTransaction(tx, `Refund batch ${i / batchSize + 1}`);
  }

  console.log("All claims processed successfully!");

  // Uncomment if you want to see DAO details
  /*
    const dao = await autocrat.getDao(launch.dao);
    console.log(dao);
    console.log(dao.minBaseFutarchicLiquidity.toNumber() / 10 ** 6);
    console.log(dao.minQuoteFutarchicLiquidity.toNumber() / 10 ** 6);
    */
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function sendAndConfirmTransaction(
  tx: Transaction,
  label: string,
  signers: Keypair[] = [],
) {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.partialSign(payer, ...signers);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  console.log(`${label} transaction sent:`, txHash);

  await provider.connection.confirmTransaction(txHash, "confirmed");
  const txStatus = await provider.connection.getTransaction(txHash, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (txStatus?.meta?.err) {
    throw new Error(
      `Transaction failed: ${txHash}\nError: ${JSON.stringify(
        txStatus?.meta?.err,
      )}\n\n${txStatus?.meta?.logMessages?.join("\n")}`,
    );
  }
  console.log(`${label} transaction confirmed`);
  return txHash;
}
