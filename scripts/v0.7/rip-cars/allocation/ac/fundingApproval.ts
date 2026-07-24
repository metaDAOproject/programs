/**
 * Funding record approval: batch sending of setFundingRecordApproval ixs.
 *
 * After a launch moves to "Closed" state (minimum raise met), the cranker
 * must approve each funder's allocation before calling completeLaunch.
 *
 * Copied from laso/allocation (accelerated-cranker). Re-approval is safe —
 * the Rust program uses delta accounting on total_approved_amount.
 */
import {
  type Launch,
  type LaunchpadClient,
} from "@metadaoproject/programs/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  type Connection,
  type PublicKey,
  Transaction,
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from "@solana/web3.js";
import type * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";

import { log } from "../logger";
import { APPROVAL_BATCH_SIZE, PRIORITY_FEE_MICRO_LAMPORTS } from "./constants";

const logger = log.child({ module: "fundingApproval" });

const BATCH_SEND_RETRIES = 3;
const INTER_BATCH_DELAY_MS = 200;

/** A single funder's approved allocation. */
export interface FundingApproval {
  funder: PublicKey;
  /** Amount approved in token atoms (USDC lamports). Always <= committedAmount. */
  approvedAmount: BN;
}

/**
 * Send setFundingRecordApproval instructions in batches.
 *
 * @returns the maximum slot any batch confirmed at — pin post-approval
 *   verification reads with `minContextSlot`. 0 when there are no approvals.
 */
export async function approveFundingRecords(
  launchpad: LaunchpadClient,
  connection: Connection,
  payer: anchor.Wallet,
  launchAddr: PublicKey,
  approvals: FundingApproval[],
): Promise<{ maxConfirmedSlot: number }> {
  const addr = launchAddr.toBase58();
  let maxConfirmedSlot = 0;
  let runningTotal = new BN(0);

  for (let i = 0; i < approvals.length; i += APPROVAL_BATCH_SIZE) {
    const batch = approvals.slice(i, i + APPROVAL_BATCH_SIZE);
    const batchNum = Math.floor(i / APPROVAL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(approvals.length / APPROVAL_BATCH_SIZE);

    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: batch.length * 16_000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
      }),
    );

    for (const approval of batch) {
      const ix = await launchpad
        .setFundingRecordApprovalIx({
          launch: launchAddr,
          funder: approval.funder,
          approvedAmount: approval.approvedAmount,
        })
        .instruction();
      tx.add(ix);
    }

    const { txHash, confirmedSlot } = await sendBatchWithRetry(
      connection,
      payer,
      tx,
      batchNum,
      totalBatches,
    );
    maxConfirmedSlot = Math.max(maxConfirmedSlot, confirmedSlot);
    for (const approval of batch)
      runningTotal = runningTotal.add(approval.approvedAmount);

    logger.info(
      {
        launchAddr: addr,
        batch: batchNum,
        totalBatches,
        approvals: batch.length,
        tx: txHash,
        confirmedSlot,
        runningTotal: runningTotal.toString(),
      },
      "Approved funding record batch",
    );

    if (i + APPROVAL_BATCH_SIZE < approvals.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  return { maxConfirmedSlot };
}

async function sendBatchWithRetry(
  connection: Connection,
  payer: anchor.Wallet,
  tx: Transaction,
  batchNum: number,
  totalBatches: number,
): Promise<{ txHash: string; confirmedSlot: number }> {
  for (let attempt = 1; attempt <= BATCH_SEND_RETRIES; attempt++) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.signatures = [];
    tx.sign(payer.payer);

    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
    });

    try {
      const confirmation = await connection.confirmTransaction(
        { signature: txHash, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (confirmation.value.err) {
        throw new Error(
          `Approval batch ${batchNum}/${totalBatches} failed on-chain: ${JSON.stringify(confirmation.value.err)} (tx: ${txHash})`,
        );
      }
      return { txHash, confirmedSlot: confirmation.context.slot };
    } catch (err) {
      const isExpiry =
        err instanceof TransactionExpiredBlockheightExceededError ||
        err instanceof TransactionExpiredTimeoutError;
      if (isExpiry && attempt < BATCH_SEND_RETRIES) {
        logger.warn(
          {
            batch: batchNum,
            totalBatches,
            attempt,
            maxAttempts: BATCH_SEND_RETRIES,
          },
          "Approval batch expired — retrying with fresh blockhash",
        );
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

const SLOT_PINNED_READ_ATTEMPTS = 5;

function isMinContextSlotError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === -32016) return true;
  const message = (err as { message?: unknown }).message;
  return (
    typeof message === "string" && message.includes("Minimum context slot")
  );
}

/**
 * Read the launch account pinned to a minimum slot — read-your-writes safe.
 */
export async function fetchLaunchAtSlot(
  connection: Connection,
  launchpad: LaunchpadClient,
  launchAddr: PublicKey,
  minContextSlot: number,
  opts?: { maxAttempts?: number; sleepMs?: (attempt: number) => number },
): Promise<Launch> {
  const maxAttempts = opts?.maxAttempts ?? SLOT_PINNED_READ_ATTEMPTS;
  const sleepMs = opts?.sleepMs ?? ((attempt: number) => 1000 * attempt);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await connection.getAccountInfo(launchAddr, {
        commitment: "confirmed",
        ...(minContextSlot > 0 ? { minContextSlot } : {}),
      });
      if (!info)
        throw new Error(`Launch account not found: ${launchAddr.toBase58()}`);
      return await launchpad.deserializeLaunch(info);
    } catch (err) {
      if (isMinContextSlotError(err) && attempt < maxAttempts) {
        logger.warn(
          {
            launchAddr: launchAddr.toBase58(),
            minContextSlot,
            attempt,
            maxAttempts,
          },
          "Replica behind minContextSlot — backing off before re-reading launch",
        );
        await new Promise((r) => setTimeout(r, sleepMs(attempt)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}
