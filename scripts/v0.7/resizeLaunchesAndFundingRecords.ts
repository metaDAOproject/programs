import {
  ComputeBudgetProgram,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
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
  const launchpad = LaunchpadClient.createClient({ provider });

  const launchDiscriminator = getDiscriminator("Launch");
  const fundingRecordDiscriminator = getDiscriminator("FundingRecord");

  const batchSize = 20;

  console.log(
    `Launch discriminator (hex): ${launchDiscriminator.toString("hex")}`,
  );
  console.log(
    `FundingRecord discriminator (hex): ${fundingRecordDiscriminator.toString("hex")}`,
  );
  console.log(`Program ID: ${launchpad.launchpad.programId.toBase58()}\n`);

  // Resize Launches
  const launchAccounts = await provider.connection.getProgramAccounts(
    launchpad.launchpad.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(launchDiscriminator),
          },
        },
      ],
    },
  );

  console.log(`Found ${launchAccounts.length} Launches`);
  for (let i = 0; i < launchAccounts.length; i += batchSize) {
    const batch = launchAccounts.slice(
      i,
      Math.min(i + batchSize, launchAccounts.length),
    );
    console.log(
      `Processing batch ${i / batchSize + 1} with ${batch.length} Launches`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await launchpad.launchpad.methods
          .resizeLaunch()
          .accounts({
            launch: pubkey,
            payer: payer.publicKey,
          })
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 9_000,
            }),
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 1,
            }),
          ])
          .instruction();
      }),
    );

    await sendAndConfirmTransaction(
      ixs,
      `Resize Launches batch ${i / batchSize + 1}`,
    );
  }

  // Resize FundingRecords
  const fundingRecordAccounts = await provider.connection.getProgramAccounts(
    launchpad.launchpad.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(fundingRecordDiscriminator),
          },
        },
      ],
    },
  );

  console.log(`Found ${fundingRecordAccounts.length} FundingRecords`);
  for (let i = 0; i < fundingRecordAccounts.length; i += batchSize) {
    const batch = fundingRecordAccounts.slice(
      i,
      Math.min(i + batchSize, fundingRecordAccounts.length),
    );
    console.log(
      `Processing batch ${i / batchSize + 1} with ${batch.length} FundingRecords`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await launchpad.launchpad.methods
          .resizeFundingRecord()
          .accounts({
            fundingRecord: pubkey,
            payer: payer.publicKey,
          })
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
              units: 6_000,
            }),
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 1,
            }),
          ])
          .instruction();
      }),
    );

    await sendAndConfirmTransaction(
      ixs,
      `Resize FundingRecords batch ${i / batchSize + 1}`,
    );
  }

  // Verify all accounts load through SDK
  console.log(
    "Confirming launches and funding records can be loaded through SDK...",
  );
  const launches = await launchpad.launchpad.account.launch.all();
  console.log(`Confirmed ${launches.length} Launches`);
  const fundingRecords = await launchpad.launchpad.account.fundingRecord.all();
  console.log(`Confirmed ${fundingRecords.length} FundingRecords`);
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
