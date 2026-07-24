/// Claims tokens for every funder of a completed launch, and refunds any
/// unapproved USDC (committed minus approved). Permissionless — local wallet
/// pays fees and ATA rent.
///
/// Multi-pass fire-and-verify (from rip-cars claimAll).

import {
  ComputeBudgetProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";

import { deriveLaunch, deriveTokenMint } from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import type { LaunchConfig } from "./types.js";

const BATCH_SIZE = 5;
const PRIORITY_FEE_MICRO_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000",
  10,
);
const MAX_PASSES = 3;
const LAND_WAIT_MS = 30_000;
const CLAIM_CU = 45_000;
const REFUND_CU = 40_000;
const ATA_CREATE_CU = 30_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function claimAll(config: LaunchConfig): Promise<void> {
  const { provider, payer, launchpad } = createLaunchContext();

  const tokenMint = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  const launch = deriveLaunch(tokenMint);
  console.log("Launch address:", launch.toBase58());

  const sendBatch = async (
    batchIxs: TransactionInstruction[],
    computeUnits: number,
    label: string,
  ) => {
    const { blockhash } = await provider.connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
      }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
      ...batchIxs,
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.partialSign(payer);

    const signature = await provider.connection.sendRawTransaction(
      tx.serialize(),
    );
    console.log(`${label}: ${signature}`);
  };

  const processPass = async (
    pass: number,
    countOnly = false,
  ): Promise<number> => {
    const launchAccount = await launchpad.fetchLaunch(launch);
    if (launchAccount === null) {
      throw new Error("Launch account not found");
    }

    const state = Object.keys(launchAccount.state)[0];
    if (state !== "complete") {
      throw new Error(
        `Launch state is "${state}", claims require Complete (run complete first)`,
      );
    }

    const allFundingRecords =
      await launchpad.launchpad.account.fundingRecord.all();
    const launchFundingRecords = allFundingRecords.filter((record) =>
      record.account.launch.equals(launch),
    );
    console.log(
      `Pass ${pass}: found ${launchFundingRecords.length} funding records`,
    );

    const totalRefundable = launchFundingRecords.reduce(
      (acc, record) =>
        record.account.isUsdcRefunded
          ? acc
          : acc.add(
              record.account.committedAmount.sub(record.account.approvedAmount),
            ),
      new BN(0),
    );
    const quoteVaultBalance = new BN(
      (
        await provider.connection.getTokenAccountBalance(
          launchAccount.launchQuoteVault,
        )
      ).value.amount,
    );
    const skipRefunds = totalRefundable.gt(quoteVaultBalance);
    if (skipRefunds) {
      console.log(
        `Skipping refunds: refundable ${totalRefundable.toString()} exceeds quote vault balance ${quoteVaultBalance.toString()} (fork drift)`,
      );
    }

    const needsRefund = (record: (typeof launchFundingRecords)[number]) =>
      !skipRefunds &&
      !record.account.isUsdcRefunded &&
      record.account.committedAmount.sub(record.account.approvedAmount).gtn(0);

    const claimRecords = launchFundingRecords.filter(
      (record) => !record.account.isTokensClaimed,
    );
    const refundRecords = launchFundingRecords.filter(needsRefund);

    const pendingRecords = launchFundingRecords.filter(
      (record) => !record.account.isTokensClaimed || needsRefund(record),
    ).length;
    if (pendingRecords === 0 || countOnly) {
      return pendingRecords;
    }

    let batches = 0;

    for (let i = 0; i < claimRecords.length; i += BATCH_SIZE) {
      const batch = claimRecords.slice(i, i + BATCH_SIZE);
      const batchIxs: TransactionInstruction[] = [];
      for (const record of batch) {
        batchIxs.push(
          ...(
            await launchpad
              .claimIx(launch, launchAccount.baseMint, record.account.funder)
              .transaction()
          ).instructions,
        );
      }
      sendBatch(
        batchIxs,
        batch.length * (ATA_CREATE_CU + CLAIM_CU),
        `Pass ${pass} claim batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(claimRecords.length / BATCH_SIZE)}`,
      );
      batches++;
    }

    for (let i = 0; i < refundRecords.length; i += BATCH_SIZE) {
      const batch = refundRecords.slice(i, i + BATCH_SIZE);
      const batchIxs: TransactionInstruction[] = [];
      for (const record of batch) {
        batchIxs.push(
          createAssociatedTokenAccountIdempotentInstruction(
            payer.publicKey,
            getAssociatedTokenAddressSync(
              launchAccount.quoteMint,
              record.account.funder,
              true,
            ),
            record.account.funder,
            launchAccount.quoteMint,
          ),
          ...(
            await launchpad
              .refundIx({
                launch,
                funder: record.account.funder,
                quoteMint: launchAccount.quoteMint,
              })
              .transaction()
          ).instructions,
        );
      }
      sendBatch(
        batchIxs,
        batch.length * (ATA_CREATE_CU + REFUND_CU),
        `Pass ${pass} refund batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(refundRecords.length / BATCH_SIZE)}`,
      );
      batches++;
    }

    console.log(
      `Pass ${pass}: fired ${batches} transactions (${claimRecords.length} claims, ${refundRecords.length} refunds)`,
    );
    return pendingRecords;
  };

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const pendingRecords = await processPass(pass);
    if (pendingRecords === 0) {
      console.log("All records claimed and refunded!");
      return;
    }
    await sleep(LAND_WAIT_MS);
  }

  const stillPending = await processPass(MAX_PASSES + 1, true);
  if (stillPending > 0) {
    throw new Error(
      `${stillPending} records still pending after ${MAX_PASSES} passes — rerun (safe: processed records are skipped)`,
    );
  }
  console.log("All records claimed and refunded!");
}
