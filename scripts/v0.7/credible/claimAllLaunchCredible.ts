/// Claims tokens for every funder of the completed credible launch, and
/// refunds any unapproved USDC (committed minus approved) along the way.
/// Claims and refunds are both permissionless; the local wallet just pays fees
/// and ATA rent.
///
/// Transactions are fired without per-batch confirmation (a compute-unit price
/// helps them land under congestion). Correctness comes from verification
/// passes over the funding records themselves: each pass re-fetches the
/// records and re-sends only what hasn't landed, which is safe because claims
/// and refunds are idempotent via the records' flags.

import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { LAUNCH_AUTHORITY, TOKEN_SEED } from "./constants.js";

// Batches are homogeneous — claims-only or refunds-only — so 5 records fit the
// 1232-byte transaction limit (a mixed claim+refund batch only fits 3), and a
// failing refund can never revert co-batched claims.
const BATCH_SIZE = 5;

// Matches the accelerated-cranker default; raise via env under congestion.
const PRIORITY_FEE_MICRO_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000",
  10,
);

// Fire passes until nothing is pending; each pass re-sends only what hasn't
// landed. Two passes suffice when everything lands first try.
const MAX_PASSES = 3;

// Grace for fired transactions to land before the next verification pass.
const LAND_WAIT_MS = 5_000;

// Static compute budgets per instruction, measured on a surfpool fork of the
// real launch (claim ~35k, refund ~31k, ATA create ~25k / ~5k when it already
// exists) and rounded up. Over-requesting only inflates the priority fee,
// which is priced per requested CU.
const CLAIM_CU = 45_000;
const REFUND_CU = 40_000;
const ATA_CREATE_CU = 30_000;

const provider = anchor.AnchorProvider.env();
const payer = (
  provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Sign and fire one batch without waiting for confirmation — the next pass
// verifies against the records. Preflight stays on so a deterministic failure
// (e.g. a bad account) rejects at send time with logs instead of surfacing
// only as a still-pending record after the passes.
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

/**
 * One pass: fetch the records, work out what still needs a claim or refund,
 * and fire the batches for it without waiting for confirmations. Returns the
 * number of records that still needed work (0 means everything has landed).
 * With countOnly, just reports that number without sending.
 */
const processPass = async (
  launch: PublicKey,
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
      `Launch state is "${state}", claims require Complete (run complete.ts first)`,
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

  // On a fork, records cloned after the launch/vault froze can carry committed
  // amounts the quote vault never received; skip refunds when the vault can't
  // cover them (on a real cluster the vault always can).
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

  // Phase 1: claims (claimIx prepends the funder's token ATA creation itself)
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

    await sendBatch(
      batchIxs,
      batch.length * (ATA_CREATE_CU + CLAIM_CU),
      `Pass ${pass} claim batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(claimRecords.length / BATCH_SIZE)}`,
    );
    batches++;
  }

  // Phase 2: refunds. The refund requires the funder's USDC ATA to exist;
  // unlike claimIx, the SDK's refundIx does not create it (funders may have
  // funded from a non-ATA account or closed their ATA since)
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

    await sendBatch(
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

const main = async () => {
  const tokenMint = await PublicKey.createWithSeed(
    LAUNCH_AUTHORITY,
    TOKEN_SEED,
    TOKEN_PROGRAM_ID,
  );
  const [launch] = getLaunchAddr(undefined, tokenMint);
  console.log("Launch address:", launch.toBase58());

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const pendingRecords = await processPass(launch, pass);
    if (pendingRecords === 0) {
      console.log("All records claimed and refunded!");
      return;
    }
    await sleep(LAND_WAIT_MS);
  }

  const stillPending = await processPass(launch, MAX_PASSES + 1, true);
  if (stillPending > 0) {
    throw new Error(
      `${stillPending} records still pending after ${MAX_PASSES} passes — rerun the script (safe: processed records are skipped)`,
    );
  }
  console.log("All records claimed and refunded!");
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
