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

async function sendAndConfirmTransaction(
  ixs: TransactionInstruction[],
  label: string,
  signers: Keypair[] = [],
) {
  const { blockhash } = await provider.connection.getLatestBlockhash();

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

async function main() {
  const futarchy = FutarchyClient.createClient({ provider });

  const daoDiscriminator = getDiscriminator("Dao");
  const daoBatchSize = 15;

  console.log(`DAO discriminator (hex): ${daoDiscriminator.toString("hex")}`);
  console.log(`DAO discriminator (base58): ${bs58.encode(daoDiscriminator)}`);
  console.log(`Program ID: ${futarchy.futarchy.programId.toBase58()}\n`);

  const daoAccounts = await provider.connection.getProgramAccounts(
    futarchy.futarchy.programId,
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
  for (let i = 0; i < daoAccounts.length; i += daoBatchSize) {
    const batch = daoAccounts.slice(
      i,
      Math.min(i + daoBatchSize, daoAccounts.length),
    );
    console.log(
      `Processing batch ${Math.floor(i / daoBatchSize) + 1} with ${batch.length} DAOs`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await futarchy.futarchy.methods
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
      `Resize DAOs batch ${Math.floor(i / daoBatchSize) + 1}`,
    );
  }

  console.log("Confirming DAOs can be loaded through SDK...");
  const daos = await futarchy.futarchy.account.dao.all();
  console.log(`Confirmed ${daos.length} DAOs`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
