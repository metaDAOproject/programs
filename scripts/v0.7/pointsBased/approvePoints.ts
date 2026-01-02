/// Points-based approval script for v7 launches
/// Approves funding records based on points ownership using pro-rata allocation.
///
/// Phase 1: Allocate to points owners based on their points weight
/// Phase 2: If under target, distribute remaining to all funders pro-rata

import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import BN from "bn.js";

type PointsAllocation = {
  user: PublicKey;
  points: number;
};

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// ============= CONFIGURATION =============
// The base mint of the launch
const BASE_MINT = new PublicKey("PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta");

// The final raise amount (USDC, in atoms - 6 decimals)
const FINAL_RAISE_AMOUNT = 1_000_000_000000; // 1M USDC

// Batch size for approvals per transaction
const BATCH_SIZE = 5;
// =========================================

async function main() {
  const [launchAddr] = getLaunchAddr(undefined, BASE_MINT);

  // Load points allocations from JSON file
  const pointsFilePath = path.join(__dirname, "pointsAllocations.json");
  if (!fs.existsSync(pointsFilePath)) {
    console.error(
      `Points allocations file not found: ${pointsFilePath}\n` +
        `Create a JSON file with format: [{ "user": "pubkey", "points": 100 }, ...]`,
    );
    return;
  }

  const pointsAllocations: PointsAllocation[] = JSON.parse(
    fs.readFileSync(pointsFilePath, "utf8"),
  ).map((x: { user: string; points: number }) => ({
    user: new PublicKey(x.user),
    points: x.points,
  }));

  console.log(`Loaded ${pointsAllocations.length} points allocations`);

  if (pointsAllocations.length === 0) {
    console.log("No points allocations found");
    return;
  }

  // Get all funding records for this launch
  const allFundingRecords =
    await launchpad.launchpad.account.fundingRecord.all();

  const launchFundingRecords = allFundingRecords.filter(
    (record) => record.account.launch.toString() === launchAddr.toString(),
  );

  console.log(
    `Found ${launchFundingRecords.length} funding records for launch: ${launchAddr.toBase58()}`,
  );

  if (launchFundingRecords.length === 0) {
    console.log("No funding records found for this launch");
    return;
  }

  // Match funding records with points owners
  const fundingRecordsWithPoints = launchFundingRecords.map((record) => {
    const pointsOwner = pointsAllocations.find(
      (allocation) =>
        allocation.user.toString() === record.account.funder.toString(),
    );
    return {
      ...record,
      pointsOwner,
      amountToApprove: new BN(0),
    };
  });

  const pointsHolders = fundingRecordsWithPoints.filter(
    (x) => x.pointsOwner !== undefined,
  );
  console.log(`Found ${pointsHolders.length} funders with points`);

  // Calculate total points among funders
  const totalPoints = pointsHolders.reduce(
    (acc, curr) => acc.add(new BN(curr.pointsOwner!.points)),
    new BN(0),
  );
  console.log(`Total points: ${totalPoints.toString()}`);

  // Phase 1: Allocate to points owners based on points weight
  for (const record of fundingRecordsWithPoints) {
    if (record.pointsOwner) {
      // Pro-rata based on points weight
      record.amountToApprove = record.account.committedAmount
        .mul(new BN(record.pointsOwner.points))
        .div(totalPoints);
    }
  }

  const totalApprovedPhase1 = fundingRecordsWithPoints.reduce(
    (acc, curr) => acc.add(curr.amountToApprove),
    new BN(0),
  );
  console.log(
    `Phase 1 approved: ${totalApprovedPhase1.toString()} (${totalApprovedPhase1.toNumber() / 10 ** 6} USDC)`,
  );

  // Phase 2: If under target, distribute remaining to all funders pro-rata
  const amountLeft = new BN(FINAL_RAISE_AMOUNT).sub(totalApprovedPhase1);

  if (amountLeft.gt(new BN(0))) {
    console.log(
      `Phase 2: Distributing remaining ${amountLeft.toNumber() / 10 ** 6} USDC to all funders`,
    );

    const totalUnapproved = fundingRecordsWithPoints.reduce(
      (acc, curr) =>
        acc.add(curr.account.committedAmount.sub(curr.amountToApprove)),
      new BN(0),
    );

    for (const record of fundingRecordsWithPoints) {
      const remainingUnapproved = record.account.committedAmount.sub(
        record.amountToApprove,
      );
      if (remainingUnapproved.gt(new BN(0))) {
        record.amountToApprove = record.amountToApprove.add(
          amountLeft.mul(remainingUnapproved).div(totalUnapproved),
        );
      }
    }
  }

  const finalTotalApproved = fundingRecordsWithPoints.reduce(
    (acc, curr) => acc.add(curr.amountToApprove),
    new BN(0),
  );
  console.log(
    `Final total approved: ${finalTotalApproved.toNumber() / 10 ** 6} USDC`,
  );

  // Build approval instructions
  const approveIxs = await Promise.all(
    fundingRecordsWithPoints.map((record) =>
      launchpad
        .setFundingRecordApprovalIx({
          launch: launchAddr,
          funder: record.account.funder,
          approvedAmount: record.amountToApprove,
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

  console.log("All points-based approvals processed!");
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
