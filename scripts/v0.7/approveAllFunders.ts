import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import dotenv from "dotenv";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// ============= CONFIGURATION =============
// The base mint of the launch
const BASE_MINT = new PublicKey("7EJRXkBfoAYtzAXE7PRry4gqh6NciY3Yt5YF3GR8LC8V");

// Batch size for approvals per transaction
const BATCH_SIZE = 5;
// =========================================

async function main() {
  const [launchAddr] = getLaunchAddr(undefined, BASE_MINT);

  console.log(`Approving all funders for launch: ${launchAddr.toBase58()}`);

  // Get all funding records for this launch
  const allFundingRecords =
    await launchpad.launchpad.account.fundingRecord.all();

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

  // Calculate total amounts
  const totalCommitted = launchFundingRecords.reduce(
    (acc, record) => acc + record.account.committedAmount.toNumber(),
    0,
  );
  console.log(`Total committed: ${totalCommitted / 10 ** 6} USDC`);

  // Build all approval instructions (approve each funder for their full committed amount)
  const approveIxs = await Promise.all(
    launchFundingRecords.map((record) =>
      launchpad
        .setFundingRecordApprovalIx({
          launch: launchAddr,
          funder: record.account.funder,
          approvedAmount: record.account.committedAmount,
        })
        .instruction(),
    ),
  );

  // Process in batches
  for (let i = 0; i < approveIxs.length; i += BATCH_SIZE) {
    const batch = approveIxs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;

    console.log(`Processing batch ${batchNum} with ${batch.length} approvals`);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }));

    for (const ix of batch) {
      tx.add(ix);
    }

    await sendAndConfirmTransaction(tx, `Approve batch ${batchNum}`);
  }

  console.log("All funders approved for their full committed amounts!");
}

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
