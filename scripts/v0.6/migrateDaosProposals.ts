import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
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

// Reads the proposal's dao pubkey straight from account data, so it works on
// both the old and new layouts (they share the prefix). ProposalState is a
// borsh enum whose Draft variant (tag 0) carries a u64, so everything after
// it shifts by 8 bytes on draft proposals.
function getProposalDao(data: Buffer): PublicKey {
  const stateOffset = 8 + 4 + 32 + 8; // discriminator, number, proposer, timestamp_enqueued
  const stateSize = data[stateOffset] === 0 ? 9 : 1;
  const daoOffset = stateOffset + stateSize + 32 + 32; // base_vault, quote_vault
  return new PublicKey(data.subarray(daoOffset, daoOffset + 32));
}

async function main() {
  const futarchy = FutarchyClient.createClient({ provider });

  const daoDiscriminator = getDiscriminator("Dao");
  const proposalDiscriminator = getDiscriminator("Proposal");

  const daoBatchSize = 15;
  // Each resize_proposal also references the proposal's dao, so the worst
  // case is two unique account keys per instruction; 10 keeps the batch under
  // the transaction size limit.
  const proposalBatchSize = 10;

  console.log(`DAO discriminator (hex): ${daoDiscriminator.toString("hex")}`);
  console.log(`DAO discriminator (base58): ${bs58.encode(daoDiscriminator)}`);
  console.log(
    `Proposal discriminator (hex): ${proposalDiscriminator.toString("hex")}`,
  );
  console.log(
    `Proposal discriminator (base58): ${bs58.encode(proposalDiscriminator)}`,
  );
  console.log(`Program ID: ${futarchy.futarchy.programId.toBase58()}\n`);

  // DAOs must be fully cranked before proposals: resize_proposal deserializes
  // the proposal's dao in the new layout.
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

  const proposalAccounts = await provider.connection.getProgramAccounts(
    futarchy.futarchy.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(proposalDiscriminator),
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
      `Processing batch ${Math.floor(i / proposalBatchSize) + 1} with ${batch.length} Proposals`,
    );

    const ixs = await Promise.all(
      batch.map(async ({ pubkey, account }) => {
        return await futarchy.futarchy.methods
          .resizeProposal()
          .accounts({
            proposal: pubkey,
            dao: getProposalDao(account.data),
            payer: payer.publicKey,
          })
          .instruction();
      }),
    );

    await sendAndConfirmTransaction(
      ixs,
      `Resize Proposals batch ${Math.floor(i / proposalBatchSize) + 1}`,
    );
  }

  console.log("Confirming daos and proposals can be loaded through SDK...");
  const daos = await futarchy.futarchy.account.dao.all();
  console.log(`Confirmed ${daos.length} DAOs`);
  const proposals = await futarchy.futarchy.account.proposal.all();
  console.log(`Confirmed ${proposals.length} Proposals`);
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
