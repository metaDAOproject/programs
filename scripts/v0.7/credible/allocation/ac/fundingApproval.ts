/**
 * Funding record approval: batch sending of setFundingRecordApproval ixs.
 *
 * After a launch moves to "Closed" state (minimum raise met), the cranker
 * must approve each funder's allocation before calling completeLaunch.
 *
 * The approval amounts are calculated by fundingAccumulatorApproval.ts
 * (accumulator-weighted allocation). This module handles the on-chain
 * batch sending.
 *
 * Separated from chainLaunchWatcher because it's self-contained logic
 * with no DB or watcher dependencies.
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

/** Max retries per individual batch when a transaction expires. */
const BATCH_SEND_RETRIES = 3;

/**
 * Delay (ms) between consecutive batch sends.
 * Surfpool's validator can choke when processing hundreds of account
 * writes in rapid succession. A small pause between batches lets the
 * validator's transaction pipeline drain. 200ms × 73 batches = ~15s
 * of added overhead — negligible for a launch with 725 funders.
 */
const INTER_BATCH_DELAY_MS = 200;

/** A single funder's approved allocation. */
export interface FundingApproval {
  /** The funder's wallet public key. */
  funder: PublicKey;
  /** Amount approved in token atoms (USDC lamports). Always <= committedAmount. */
  approvedAmount: BN;
}

/**
 * Send setFundingRecordApproval instructions in batches.
 *
 * Each batch contains up to APPROVAL_BATCH_SIZE (10) approvals with a
 * compute budget set to `batchSize * 16_000` CUs. Batches are sent
 * sequentially with per-batch retry on transaction expiry errors.
 *
 * Re-approval is safe — the Rust program uses delta accounting on
 * `total_approved_amount`, so re-approving with the same amount is
 * effectively a no-op. This makes crash recovery simple: on retry,
 * the caller recalculates and re-sends all approvals.
 *
 * @param launchpad — SDK client for building instructions
 * @param connection — Solana RPC connection for sending transactions
 * @param payer — wallet that signs and pays for transactions
 * @param launchAddr — the on-chain launch account address
 * @param approvals — calculated approvals from calculateApprovedAmounts
 * @returns the maximum slot any batch confirmed at — pin the post-approval
 *   verification read to this with `minContextSlot` so it reflects every batch
 *   (see {@link fetchLaunchAtSlot}). 0 when there are no approvals to send.
 * @throws on any batch failure — caller is responsible for retry logic
 */
export async function approveFundingRecords(
  launchpad: LaunchpadClient,
  connection: Connection,
  payer: anchor.Wallet,
  launchAddr: PublicKey,
  approvals: FundingApproval[],
): Promise<{ maxConfirmedSlot: number }> {
  const addr = launchAddr.toBase58();

  // Tracked for read-your-writes verification and forensic logging: the highest
  // slot a batch confirmed at, and the running Σ of approved amounts sent.
  let maxConfirmedSlot = 0;
  let runningTotal = new BN(0);

  for (let i = 0; i < approvals.length; i += APPROVAL_BATCH_SIZE) {
    const batch = approvals.slice(i, i + APPROVAL_BATCH_SIZE);
    const batchNum = Math.floor(i / APPROVAL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(approvals.length / APPROVAL_BATCH_SIZE);

    const tx = new Transaction();

    // Compute budget: 16k CUs per approval instruction.
    // setFundingRecordApproval is lightweight — mostly account reads
    // and a single delta update on total_approved_amount.
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: batch.length * 16_000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: PRIORITY_FEE_MICRO_LAMPORTS,
      }),
    );

    // Build one setFundingRecordApprovalIx per funder in this batch.
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

    // Sign, send, and confirm with per-batch retry.
    // Under heavy load (e.g., 725 records = 73 batches), the RPC can drop
    // transactions or fail to confirm within the blockhash validity window.
    // Re-approval is safe (delta accounting), so retrying a batch is harmless.
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

    // Throttle between batches to prevent overwhelming the validator.
    if (i + APPROVAL_BATCH_SIZE < approvals.length) {
      await new Promise((r) => setTimeout(r, INTER_BATCH_DELAY_MS));
    }
  }

  return { maxConfirmedSlot };
}

/**
 * Send a single approval batch transaction with retry on expiry errors.
 *
 * Under heavy load (many batches in rapid succession), the RPC can drop
 * transactions or fail to include them before the blockhash expires.
 * This function retries with a fresh blockhash + signature on expiry,
 * which is safe because re-approval uses delta accounting (no-op if
 * already applied).
 *
 * Non-expiry errors (e.g., instruction failure) are thrown immediately
 * since retrying won't help.
 */
async function sendBatchWithRetry(
  connection: Connection,
  payer: anchor.Wallet,
  tx: Transaction,
  batchNum: number,
  totalBatches: number,
): Promise<{ txHash: string; confirmedSlot: number }> {
  for (let attempt = 1; attempt <= BATCH_SEND_RETRIES; attempt++) {
    // Fresh blockhash for each attempt — the previous one may have expired.
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.signatures = []; // Clear stale signatures before re-signing.
    tx.sign(payer.payer);

    const txHash = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true, // Reduce RPC load — we built the tx ourselves.
    });

    try {
      const confirmation = await connection.confirmTransaction(
        { signature: txHash, blockhash, lastValidBlockHeight },
        "confirmed",
      );

      // confirmTransaction resolves even if the tx failed on-chain.
      // Check the err field — otherwise failed approvals are silently
      // treated as successes and totalApprovedAmount stays at 0.
      if (confirmation.value.err) {
        throw new Error(
          `Approval batch ${batchNum}/${totalBatches} failed on-chain: ${JSON.stringify(confirmation.value.err)} (tx: ${txHash})`,
        );
      }

      // context.slot is the node's slot when it observed the confirmation —
      // always >= the slot the tx landed in. Plumbed up so the verification
      // read can pin minContextSlot to the max across batches.
      return { txHash, confirmedSlot: confirmation.context.slot };
    } catch (err) {
      // Retry on transaction expiry (dropped or not included in time).
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

/** Max attempts for {@link fetchLaunchAtSlot} when the replica is lagging. */
const SLOT_PINNED_READ_ATTEMPTS = 5;

/**
 * Does this error mean the RPC node hasn't reached the requested minContextSlot?
 *
 * web3.js surfaces this as a SolanaJSONRPCError with code -32016
 * ("Minimum context slot has not been reached"). Duck-typed so we don't depend
 * on the concrete error class.
 */
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
 *
 * The post-approval verification in chainLaunchWatcher must see every approval
 * batch it just sent. A plain fetch can hit a load-balanced replica whose
 * `confirmed` view lags 1–2 slots behind the node that confirmed the writes,
 * returning a stale `totalApprovedAmount` and triggering a false "below minimum"
 * failure. Pinning `minContextSlot` to the max confirmed batch slot
 * makes a lagging replica error with -32016 instead of answering stale; we back
 * off briefly and retry, converting a silent stale read into a correct one.
 *
 * @param minContextSlot max slot the approvals confirmed at (from
 *   {@link approveFundingRecords}). 0 ⇒ no batches sent ⇒ unpinned read.
 */
export async function fetchLaunchAtSlot(
  connection: Connection,
  launchpad: LaunchpadClient,
  launchAddr: PublicKey,
  minContextSlot: number,
  opts?: { maxAttempts?: number; sleepMs?: (attempt: number) => number },
): Promise<Launch> {
  const maxAttempts = opts?.maxAttempts ?? SLOT_PINNED_READ_ATTEMPTS;
  const sleepMs = opts?.sleepMs ?? ((attempt: number) => 1000 * attempt); // 1s,2s,3s,4s
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const info = await connection.getAccountInfo(launchAddr, {
        commitment: "confirmed",
        // 0 ⇒ no batches sent (nothing to wait for); read without pinning.
        ...(minContextSlot > 0 ? { minContextSlot } : {}),
      });
      if (!info) {
        throw new Error(`Launch account not found: ${launchAddr.toBase58()}`);
      }
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
