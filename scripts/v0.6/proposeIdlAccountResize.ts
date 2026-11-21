import * as anchor from "@anchor-lang/core";
import * as multisig from "@sqds/multisig";
import { FUTARCHY_V0_6_PROGRAM_ID } from "@metadaoproject/programs";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { METADAO_MULTISIG } from "../utils/adminApproval.js";
import {
  decodeIdlAccount,
  getIdlAddress,
  idlCloseIx,
  idlCreateIx,
  idlResizeIx,
  idlSetBufferIx,
} from "../utils/idlInstructions.js";
import { compareVaultTransactionInstructions } from "../utils/squads.js";
import { sendWithRetries } from "../utils/transactions.js";
import type { ProbeResult } from "../utils/transactions.js";

// Proposes an ops multisig batch that makes a program's IDL account larger without changing the IDL it holds.
// Stage the buffer with stageIdlBuffer.ts first. The payer must be a multisig member allowed to propose.

const PROGRAM_ID = FUTARCHY_V0_6_PROGRAM_ID;
const MULTISIG = METADAO_MULTISIG;

// The buffer printed by stageIdlBuffer.ts.
const IDL_BUFFER_ADDRESS = "";

// Bytes to add to the IDL account.
const IDL_ACCOUNT_GROWTH = 10_000;

// One Squads execution can grow an account by at most 10,240 bytes, so each batch transaction adds at most this much.
const MAX_GROWTH_PER_TRANSACTION = 10_000;

// Anchor's IDL create and resize instructions each allocate at most this many bytes.
const ANCHOR_MAX_ALLOCATION = 10_000;

const provider = anchor.AnchorProvider.env();
const payer: Keypair = provider.wallet["payer"];
const connection = provider.connection;

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function main() {
  if (!IDL_BUFFER_ADDRESS) {
    throw new Error(
      "Set IDL_BUFFER_ADDRESS to the buffer printed by stageIdlBuffer.ts",
    );
  }
  const buffer = new PublicKey(IDL_BUFFER_ADDRESS);
  const [vault] = multisig.getVaultPda({ multisigPda: MULTISIG, index: 0 });
  const { base, idlAddress } = await getIdlAddress(PROGRAM_ID);
  const { idlAccount, bufferAccount, payload } = await loadAndCheckAccounts(
    idlAddress,
    buffer,
    vault,
  );

  const sizes = sizesAfterEachTransaction(idlAccount.data.length);
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("IDL account:", idlAddress.toBase58());
  console.log(
    `IDL payload: ${payload.length} bytes, sha256 ${sha256(payload)}`,
  );
  console.log(
    `Account size: ${idlAccount.data.length} bytes now; ${sizes.map((size, i) => `${size} after batch transaction ${i + 1}`).join(", ")}`,
  );

  const newRent = await connection.getMinimumBalanceForRentExemption(
    sizes[sizes.length - 1],
  );
  const netCost = newRent - idlAccount.lamports - bufferAccount.lamports;
  const vaultBalance = await connection.getBalance(vault, "confirmed");
  console.log(
    `Vault pays ${(netCost / LAMPORTS_PER_SOL).toFixed(4)} SOL net, holds ${(vaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
  );

  // Each batch transaction recreates the IDL account at its next size and copies the IDL back in.
  const batchTransactions = sizes.map((size, i) => [
    // Close the IDL account; its rent goes to the vault.
    idlCloseIx({
      programId: PROGRAM_ID,
      account: idlAddress,
      authority: vault,
      solDestination: vault,
    }),
    // Create it again with the vault as its authority.
    idlCreateIx({
      programId: PROGRAM_ID,
      from: vault,
      idlAddress,
      base,
      dataLen: size,
    }),
    // Grow it to this transaction's size.
    ...resizeInstructions(idlAddress, vault, size),
    // Copy the staged IDL back in.
    idlSetBufferIx({
      programId: PROGRAM_ID,
      buffer,
      idl: idlAddress,
      authority: vault,
    }),
    // The last transaction also closes the buffer; its rent goes to the vault.
    ...(i === sizes.length - 1
      ? [
          idlCloseIx({
            programId: PROGRAM_ID,
            account: buffer,
            authority: vault,
            solDestination: vault,
          }),
        ]
      : []),
  ]);

  await simulate(vault, batchTransactions.flat());
  await proposeBatch(vault, batchTransactions);
}

// Loads the IDL account and the staged buffer, and checks that the vault controls both and that they hold the same IDL.
async function loadAndCheckAccounts(
  idlAddress: PublicKey,
  buffer: PublicKey,
  vault: PublicKey,
) {
  const idlAccount = await connection.getAccountInfo(idlAddress, "confirmed");
  if (!idlAccount || !idlAccount.owner.equals(PROGRAM_ID)) {
    throw new Error(
      `No IDL account for ${PROGRAM_ID.toBase58()} at ${idlAddress.toBase58()}`,
    );
  }
  const bufferAccount = await connection.getAccountInfo(buffer, "confirmed");
  if (!bufferAccount || !bufferAccount.owner.equals(PROGRAM_ID)) {
    throw new Error(`No IDL buffer at ${buffer.toBase58()}`);
  }
  const live = decodeIdlAccount(idlAccount.data);
  const staged = decodeIdlAccount(bufferAccount.data);
  if (!live.authority.equals(vault)) {
    throw new Error(
      `IDL authority is ${live.authority.toBase58()}, not the vault ${vault.toBase58()}`,
    );
  }
  if (!staged.authority.equals(vault)) {
    throw new Error(
      `Buffer authority is ${staged.authority.toBase58()}, not the vault ${vault.toBase58()}`,
    );
  }
  if (!staged.payload.equals(live.payload)) {
    throw new Error("The buffer's bytes differ from the live IDL");
  }
  return { idlAccount, bufferAccount, payload: live.payload };
}

// The IDL account's size after each batch transaction.
function sizesAfterEachTransaction(currentSize: number) {
  if (IDL_ACCOUNT_GROWTH <= 0) {
    throw new Error("IDL_ACCOUNT_GROWTH must be positive");
  }
  const finalSize = currentSize + IDL_ACCOUNT_GROWTH;
  const sizes: number[] = [];
  let size = currentSize;
  while (size < finalSize) {
    size = Math.min(size + MAX_GROWTH_PER_TRANSACTION, finalSize);
    sizes.push(size);
  }
  return sizes;
}

// The resizes that take a freshly created IDL account to `size` bytes.
function resizeInstructions(
  idl: PublicKey,
  authority: PublicKey,
  size: number,
) {
  const resizes: TransactionInstruction[] = [];
  for (
    let allocated = ANCHOR_MAX_ALLOCATION;
    allocated < size;
    allocated += ANCHOR_MAX_ALLOCATION
  ) {
    resizes.push(
      idlResizeIx({ programId: PROGRAM_ID, idl, authority, dataLen: size }),
    );
  }
  return resizes;
}

// Runs every batch transaction's instructions, in order, in one simulated transaction paid by the vault.
async function simulate(
  vault: PublicKey,
  instructions: TransactionInstruction[],
) {
  const message = new TransactionMessage({
    payerKey: vault,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions,
  });
  const simulation = await connection.simulateTransaction(
    new VersionedTransaction(message.compileToV0Message()),
    { sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" },
  );
  if (simulation.value.err) {
    console.error(simulation.value.logs?.join("\n"));
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulation.value.err)}`,
    );
  }
  console.log(
    `Simulation passed: ${instructions.length} instructions, ${simulation.value.unitsConsumed} compute units`,
  );
}

// Creates the batch with a draft proposal, adds the transactions in order, then opens the proposal for voting.
async function proposeBatch(
  vault: PublicKey,
  batchTransactions: TransactionInstruction[][],
) {
  const { batchIndex, batchPda, proposalPda } = await sendWithRetries({
    provider,
    payer,
    name: "IDL account resize squads batch",
    build: async () => {
      const multisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          connection,
          MULTISIG,
        );
      const batchIndex =
        BigInt(multisigAccount.transactionIndex.toString()) + 1n;
      const [batchPda] = multisig.getTransactionPda({
        multisigPda: MULTISIG,
        index: batchIndex,
      });
      const [proposalPda] = multisig.getProposalPda({
        multisigPda: MULTISIG,
        transactionIndex: batchIndex,
      });
      return {
        transaction: new Transaction().add(
          multisig.instructions.batchCreate({
            multisigPda: MULTISIG,
            creator: payer.publicKey,
            rentPayer: payer.publicKey,
            batchIndex,
            vaultIndex: 0,
          }),
          multisig.instructions.proposalCreate({
            multisigPda: MULTISIG,
            creator: payer.publicKey,
            rentPayer: payer.publicKey,
            transactionIndex: batchIndex,
            isDraft: true,
          }),
        ),
        batchIndex,
        batchPda,
        proposalPda,
      };
    },
    probe: ({ batchPda }) => probeBatch(batchPda),
  });

  const { blockhash } = await connection.getLatestBlockhash();
  for (const [i, instructions] of batchTransactions.entries()) {
    const transactionIndex = i + 1;
    const [batchTransactionPda] = multisig.getBatchTransactionPda({
      multisigPda: MULTISIG,
      batchIndex,
      transactionIndex,
    });
    await sendWithRetries({
      provider,
      payer,
      name: `IDL account resize batch transaction ${transactionIndex} of ${batchTransactions.length}`,
      build: async () => ({
        transaction: new Transaction().add(
          multisig.instructions.batchAddTransaction({
            vaultIndex: 0,
            multisigPda: MULTISIG,
            member: payer.publicKey,
            rentPayer: payer.publicKey,
            batchIndex,
            transactionIndex,
            ephemeralSigners: 0,
            transactionMessage: new TransactionMessage({
              payerKey: vault,
              recentBlockhash: blockhash,
              instructions,
            }),
          }),
        ),
      }),
      probe: () => probeBatchTransaction(batchTransactionPda, instructions),
    });
  }

  await sendWithRetries({
    provider,
    payer,
    name: "IDL account resize squads proposal activation",
    build: async () => ({
      transaction: new Transaction().add(
        multisig.instructions.proposalActivate({
          multisigPda: MULTISIG,
          transactionIndex: batchIndex,
          member: payer.publicKey,
        }),
      ),
    }),
    probe: () => probeProposalActivated(proposalPda),
  });

  console.log("Squads batch index:", batchIndex.toString());
  console.log("Squads batch:", batchPda.toBase58());
  console.log("Squads proposal:", proposalPda.toBase58());
  console.log(
    `Approve it in Squads, then execute its ${batchTransactions.length} transaction(s) in order. \`anchor idl fetch\` returns the same IDL before and after.`,
  );
}

// Whether the batch at `batchPda` is ours (landed), missing (absent), or another proposal's (taken).
async function probeBatch(batchPda: PublicKey): Promise<ProbeResult> {
  const accountInfo = await connection.getAccountInfo(batchPda, "confirmed");
  if (!accountInfo) {
    return "absent";
  }
  const isBatch = accountInfo.data
    .subarray(0, 8)
    .equals(Buffer.from(multisig.accounts.batchDiscriminator));
  return isBatch &&
    multisig.accounts.Batch.fromAccountInfo(accountInfo)[0].creator.equals(
      payer.publicKey,
    )
    ? "landed"
    : "taken";
}

// Whether the batch transaction at `batchTransactionPda` exists and holds exactly `instructions`.
async function probeBatchTransaction(
  batchTransactionPda: PublicKey,
  instructions: TransactionInstruction[],
): Promise<ProbeResult> {
  const accountInfo = await connection.getAccountInfo(
    batchTransactionPda,
    "confirmed",
  );
  if (!accountInfo) {
    return "absent";
  }
  const [batchTransaction] =
    multisig.accounts.VaultBatchTransaction.fromAccountInfo(accountInfo);
  return compareVaultTransactionInstructions(
    batchTransaction.message,
    instructions,
  ).kind === "exact"
    ? "landed"
    : "taken";
}

// Whether the proposal is out of draft and open for voting.
async function probeProposalActivated(
  proposalPda: PublicKey,
): Promise<ProbeResult> {
  const proposal = await multisig.accounts.Proposal.fromAccountAddress(
    connection,
    proposalPda,
    "confirmed",
  );
  return proposal.status.__kind === "Draft" ? "absent" : "landed";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
