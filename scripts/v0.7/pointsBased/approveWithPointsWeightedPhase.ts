/// This script first approves only funding records that belong to points owners, and allocates the funds pro rata based on the points ownership and total raise amount.
/// Then, if there is still some amount left to raise, it will approve the remaining amount to all participants, pro-rata, based on their remaining amount up to the total raise amount.

import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/launchpad/v0.7";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import BN from "bn.js";

type PointsAllocations = {
  [key: string]: {
    points: number;
  };
};

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// How many approvals to perform per transaction
const batchSize = 20;

// The launch address
const launchAddr = PublicKey.default;

// The final raise amount (USDC, in atoms)
const finalRaiseAmount = 2_000_000_000000;

async function main() {
  // Script expects a keyed JSON file like:
  // { "11111111111111111111111111111111": { "points": 100 }, "22222222222222222222222222222222": { "points": 100 } }
  const pointsAllocations = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "scripts/v0.7/pointsBased/points.json"),
      "utf8",
    ),
  ) as PointsAllocations;

  let invalidKeysCount = 0;

  console.log(`Checking ${Object.keys(pointsAllocations).length} keys...`);

  for (const key of Object.keys(pointsAllocations)) {
    try {
      const pubKey = new PublicKey(key);
    } catch (error) {
      console.error(`Invalid public key: ${key}`);
      invalidKeysCount++;
    }
  }

  if (invalidKeysCount > 0) {
    console.log(`Found ${invalidKeysCount} invalid keys. Exiting...`);
    return;
  } else {
    console.log("All keys are valid. Continuing...");
  }

  console.log(
    `Found ${Object.keys(pointsAllocations).length} points allocations`,
  );

  const totalPoints = Object.values(pointsAllocations).reduce(
    (acc, curr) => acc + curr.points,
    0,
  );
  console.log(`Total points: ${totalPoints}`);

  if (Object.keys(pointsAllocations).length === 0) {
    console.log("No points allocations found");
    return;
  }

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

  // Filter funding records to only include those with points owners
  const allFundingRecordsWithPointsOwners = launchFundingRecords.map(
    (record) => {
      const pointsOwner = pointsAllocations[record.account.funder.toString()];
      return {
        ...record,
        pointsOwner,
        amountToApprove: new BN(0),
      };
    },
  );

  const fundingRecordsWithExistingPointsOwners =
    allFundingRecordsWithPointsOwners.filter(
      (x) => x.pointsOwner !== undefined,
    );

  console.log(
    `Found ${fundingRecordsWithExistingPointsOwners.length} funding records with points owners`,
  );

  if (fundingRecordsWithExistingPointsOwners.length === 0) {
    console.log("No funding records with points owners found");

    // Remove this if you want to continue with the script despite no funding records with points owners found
    return;
  }

  // Join points allocations with funding records
  const [totalPointsWithinLaunch, totalCommittedWithPointsWithinLaunch] =
    fundingRecordsWithExistingPointsOwners.reduce(
      (acc, curr) => [
        acc[0].add(new BN(curr.pointsOwner.points)),
        acc[1].add(curr.account.committedAmount),
      ],
      [new BN(0), new BN(0)] as [BN, BN],
    );

  console.log(`Total points within launch:\n${totalPointsWithinLaunch}`);
  console.log(
    `Total committed within launch amongst points owners (with decimals):\n${totalCommittedWithPointsWithinLaunch}`,
  );

  // Assign amount to approve to each record
  if (totalPointsWithinLaunch.gt(new BN(0))) {
    for (const record of allFundingRecordsWithPointsOwners) {
      record.amountToApprove = BN.min(
        record.account.committedAmount,
        new BN(finalRaiseAmount)
          .mul(new BN(record.pointsOwner?.points ?? 0)) // In this phase, if there is no points owner, then they get no allocation, so we multiply by 0.
          .div(totalPointsWithinLaunch),
      );
    }
  }

  // Sum up total amount to approve
  const totalAmountToApprove = allFundingRecordsWithPointsOwners.reduce(
    (acc, curr) => acc.add(curr.amountToApprove),
    new BN(0),
  );

  const amountLeftToRaise = new BN(finalRaiseAmount).sub(totalAmountToApprove);

  // If there is still some amount left to approve, we need to approve the remaining amount to all participants, pro-rata.
  // We should exclude the already approved amounts from the pro-rata calculation.
  if (amountLeftToRaise.gt(new BN(0))) {
    console.log(
      `There is still ${amountLeftToRaise} left to raise, adding pro-rata approvals to all participants according to their remaining unapproved amount.`,
    );

    const unapprovedAmount = allFundingRecordsWithPointsOwners.reduce(
      (acc, curr) =>
        acc.add(curr.account.committedAmount).sub(curr.amountToApprove),
      new BN(0),
    );

    for (const record of allFundingRecordsWithPointsOwners) {
      const remainingUnapprovedAmount = record.account.committedAmount.sub(
        record.amountToApprove,
      );

      record.amountToApprove = record.amountToApprove.add(
        amountLeftToRaise.mul(remainingUnapprovedAmount).div(unapprovedAmount),
      );
    }
  }

  // // IMPORTANT - PLEASE READ
  // // Uncomment this if we want the final raise amount to be a bit over the total committed amount
  // // This might be important if we want to ensure that the launch is successful in cases where the final raise amount is exactly equal to the minimum raise amount.
  // // A small dust difference will occur due to rounding which could normally fail the launch, so we need to add 1 atom to all of the records that have an amount to approve that is not equal to the committed amount.
  // for (const record of allFundingRecordsWithPointsOwners) {
  //   if (record.amountToApprove.lt(record.account.committedAmount)) {
  //     record.amountToApprove = record.amountToApprove.add(new BN(1));
  //   }
  // }

  console.log("funder\tamountCommitted\tamountToApprove");

  for (const record of allFundingRecordsWithPointsOwners) {
    console.log(
      `${record.account.funder.toBase58()}\t${record.account.committedAmount.toString()}\t${record.amountToApprove.toString()}`,
    );
  }

  // Sum up total amount to approve and render it to the user
  const finalAmountToApprove = allFundingRecordsWithPointsOwners.reduce(
    (acc, curr) => acc.add(curr.amountToApprove),
    new BN(0),
  );

  console.log(
    `Final amount to approve across all records: ${finalAmountToApprove}`,
  );

  // Remove this to approve the funding records.
  return;

  // Now we approve all records, in batches of BATCH_SIZE per transaction.

  // First get all of the approve instructions
  const approveIxs = await Promise.all(
    allFundingRecordsWithPointsOwners.map((record) =>
      launchpad
        .setFundingRecordApprovalIx({
          launch: launchAddr,
          funder: record.account.funder,
          approvedAmount: record.amountToApprove,
        })
        .instruction(),
    ),
  );

  for (let i = 0; i < approveIxs.length; i += batchSize) {
    const batch = approveIxs.slice(i, i + batchSize);

    const tx = new Transaction();

    // Add compute budget instruction to handle multiple approvals
    // Each approval costs ~15,000 compute units, increase to 16,000 to be safe.
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: batchSize * 16_000 }),
    );

    // Add claim instructions for each record in the batch
    for (const approveIx of batch) {
      tx.add(approveIx);
    }

    await sendAndConfirmTransaction(tx, `Approve batch ${i / batchSize + 1}`);
  }

  console.log("All approvals processed successfully!");

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
