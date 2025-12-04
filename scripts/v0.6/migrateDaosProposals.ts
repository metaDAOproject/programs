import {
  ComputeBudgetProgram,
  Keypair,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/futarchy/v0.6";
import dotenv from "dotenv";
import * as fs from "fs";
import bs58 from "bs58";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// Calculate discriminator for an account type using Anchor's method
function getDiscriminator(accountName: string): Buffer {
  return Buffer.from(
    anchor.BorshAccountsCoder.accountDiscriminator(accountName),
  );
}

async function main() {
  const futarchy = FutarchyClient.createClient({ provider });

  const daosDir = "daos";
  const proposalsDir = "proposals";
  if (!fs.existsSync(daosDir)) {
    fs.mkdirSync(daosDir);
  }
  if (!fs.existsSync(proposalsDir)) {
    fs.mkdirSync(proposalsDir);
  }

  // Debug: Print discriminators
  const daoDiscriminator = getDiscriminator("Dao");
  const proposalDiscriminator = getDiscriminator("Proposal");

  const daoBatchSize = 15;
  const proposalBatchSize = 15;

  console.log(`DAO discriminator (hex): ${daoDiscriminator.toString("hex")}`);
  console.log(`DAO discriminator (base58): ${bs58.encode(daoDiscriminator)}`);
  console.log(
    `Proposal discriminator (hex): ${proposalDiscriminator.toString("hex")}`,
  );
  console.log(
    `Proposal discriminator (base58): ${bs58.encode(proposalDiscriminator)}`,
  );
  console.log(`Program ID: ${futarchy.autocrat.programId.toBase58()}\n`);

  const daoAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
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
      `Processing batch ${i / daoBatchSize + 1} with ${batch.length} DAOs`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await futarchy.autocrat.methods
          .resizeDao()
          .accounts({
            dao: pubkey,
            payer: payer.publicKey,
          })
          .instruction();
      }),
    );
    // const tx = new Transaction().add(...ixs);
    await sendAndConfirmTransaction(
      ixs,
      `Resize DAOs batch ${i / daoBatchSize + 1}`,
    );
  }

  const proposalAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(getDiscriminator("Proposal")),
          },
        },
      ],
    },
  );

  console.log(`Found ${proposalAccounts.length} Proposals`);
  for (let i = 0; i < proposalAccounts.length; i += proposalBatchSize) {
    const batch = proposalAccounts.slice(
      i,
      Math.min(i + proposalBatchSize, proposalAccounts.length),
    );
    console.log(
      `Processing batch ${i / proposalBatchSize + 1} with ${batch.length} Proposals`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey }) => {
        return await futarchy.autocrat.methods
          .resizeProposal()
          .accounts({
            proposal: pubkey,
            payer: payer.publicKey,
          })
          .instruction();
      }),
    );

    // const tx = new Transaction().add(...ixs);

    await sendAndConfirmTransaction(
      ixs,
      `Resize Proposals batch ${i / proposalBatchSize + 1}`,
    );
  }

  // Confirm daos and proposals can be loaded through Anchor
  console.log("Confirming daos and proposals can be loaded through SDK...");
  const daos = await futarchy.autocrat.account.dao.all();
  console.log(`Confirmed ${daos.length} DAOs`);
  const proposals = await futarchy.autocrat.account.proposal.all();
  console.log(`Confirmed ${proposals.length} Proposals`);
}

// Make sure the promise rejection is handled
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

  // First simulate without compute budget to get units consumed
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
