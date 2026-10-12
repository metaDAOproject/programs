import {
  ComputeBudgetProgram,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { PriceBasedPerformancePackageClient } from "@metadaoproject/programs/price_based_performance_package";
import dotenv from "dotenv";
import bs58 from "bs58";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

function getDiscriminator(accountName: string): Buffer {
  return Buffer.from(
    anchor.BorshAccountsCoder.accountDiscriminator(accountName),
  );
}

async function main() {
  const priceBasedPerformancePackage =
    PriceBasedPerformancePackageClient.createClient({ provider });

  const performancePackageDiscriminator =
    getDiscriminator("PerformancePackage");

  const batchSize = 20;

  console.log(
    `PerformancePackage discriminator (hex): ${performancePackageDiscriminator.toString("hex")}`,
  );
  console.log(
    `Program ID: ${priceBasedPerformancePackage.programId.toBase58()}\n`,
  );

  const performancePackageAccounts =
    await provider.connection.getProgramAccounts(
      priceBasedPerformancePackage.programId,
      {
        filters: [
          {
            memcmp: {
              offset: 0,
              bytes: bs58.encode(performancePackageDiscriminator),
            },
          },
        ],
      },
    );

  console.log(
    `Found ${performancePackageAccounts.length} performance packages`,
  );
  for (let i = 0; i < performancePackageAccounts.length; i += batchSize) {
    const batch = performancePackageAccounts.slice(
      i,
      Math.min(i + batchSize, performancePackageAccounts.length),
    );
    console.log(
      `Processing batch ${i / batchSize + 1} with ${batch.length} performance packages`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await priceBasedPerformancePackage
          .resizePerformancePackageIx({
            performancePackage: pubkey,
            payer: payer.publicKey,
          })
          .instruction();
      }),
    );

    await sendAndConfirmTransaction(
      ixs,
      `Resize performance packages batch ${i / batchSize + 1}`,
    );
  }

  // Verify all accounts load through SDK and report withdrawal policy status
  console.log("\nConfirming performance packages can be loaded through SDK...");
  const performancePackages =
    await priceBasedPerformancePackage.program.account.performancePackage.all();
  console.log(`Confirmed ${performancePackages.length} performance packages\n`);

  for (const {
    publicKey,
    account: performancePackage,
  } of performancePackages) {
    console.log(`Performance package: ${publicKey.toBase58()}`);
    console.log(`  Recipient: ${performancePackage.recipient.toBase58()}`);
    console.log(`  Token mint: ${performancePackage.tokenMint.toBase58()}`);
    console.log(
      `  Withdrawal policy: ${performancePackage.withdrawalPolicy === null ? "none" : "set"}`,
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function sendAndConfirmTransaction(
  ixs: TransactionInstruction[],
  label: string,
  signers: Keypair[] = [],
) {
  const { blockhash } = await provider.connection.getLatestBlockhash();

  // Simulate without compute budget to get units consumed
  const messageV0 = new TransactionMessage({
    instructions: ixs,
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  const simulationTx = new VersionedTransaction(messageV0);
  simulationTx.sign([payer, ...signers]);

  const simulationResult =
    await provider.connection.simulateTransaction(simulationTx);

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: Math.ceil(simulationResult.value.unitsConsumed! * 1.15),
  });

  // Rebuild transaction with compute budget instruction prepended
  const finalMessageV0 = new TransactionMessage({
    instructions: [computeBudgetIx, ...ixs],
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
  }).compileToV0Message();
  const tx = new VersionedTransaction(finalMessageV0);
  tx.sign([payer, ...signers]);

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
