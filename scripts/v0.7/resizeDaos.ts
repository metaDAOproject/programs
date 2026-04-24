import {
  ComputeBudgetProgram,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/futarchy/futarchy/v0.6";
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
  const futarchyClient = FutarchyClient.createClient({ provider });
  const autocrat = futarchyClient["autocrat"];

  const daoDiscriminator = getDiscriminator("Dao");

  const batchSize = 20;

  console.log(`Dao discriminator (hex): ${daoDiscriminator.toString("hex")}`);
  console.log(`Program ID: ${futarchyClient.getProgramId().toBase58()}\n`);

  const daoAccounts = await provider.connection.getProgramAccounts(
    futarchyClient.getProgramId(),
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(daoDiscriminator),
          },
        },
      ],
    },
  );

  console.log(`Found ${daoAccounts.length} DAOs`);
  for (let i = 0; i < daoAccounts.length; i += batchSize) {
    const batch = daoAccounts.slice(
      i,
      Math.min(i + batchSize, daoAccounts.length),
    );
    console.log(
      `Processing batch ${i / batchSize + 1} with ${batch.length} DAOs`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await autocrat.methods
          .resizeDao()
          .accounts({
            dao: pubkey,
            payer: payer.publicKey,
          })
          .instruction();
      }),
    );

    await sendAndConfirmTransaction(
      ixs,
      `Resize DAOs batch ${i / batchSize + 1}`,
    );
  }

  // Verify all accounts load through SDK and report optimistic governance status
  console.log("\nConfirming DAOs can be loaded through SDK...");
  const daos = await autocrat.account.dao.all();
  console.log(`Confirmed ${daos.length} DAOs\n`);

  for (const { publicKey, account: dao } of daos) {
    console.log(`DAO: ${publicKey.toBase58()}`);
    console.log(`  Team address: ${dao.teamAddress.toBase58()}`);
    console.log(
      `  Optimistic governance enabled: ${dao.isOptimisticGovernanceEnabled}`,
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
