import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { FUTARCHY_V0_6_PROGRAM_ID } from "@metadaoproject/programs";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
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
import {
  createSquadsVaultTxAndProposal,
  probeSquadsVaultTransaction,
} from "../utils/squads.js";
import { sendWithRetries } from "../utils/transactions.js";

// Proposes one ops multisig transaction that swaps a program's IDL account for
// a larger one holding the same bytes: close the old account, create and grow
// the new one with the vault as its authority, copy the staged buffer in, and
// close the buffer. Stage the buffer with stageIdlBuffer.ts first. The payer
// must be a member of the multisig allowed to propose transactions.

const PROGRAM_ID = FUTARCHY_V0_6_PROGRAM_ID;
const MULTISIG = METADAO_MULTISIG;

// The buffer printed by stageIdlBuffer.ts.
const IDL_BUFFER_ADDRESS = "";

// Bytes added to the IDL account. The runtime lets one top-level instruction,
// here the Squads execute, grow an account by at most 10,240 bytes, so a bigger
// jump takes another swap later.
const IDL_ACCOUNT_GROWTH = 10_000;
const MAX_GROWTH_PER_EXECUTION = 10_240;

// The Create instruction caps the account at this size; each Resize adds up to
// this much more.
const IDL_ACCOUNT_GROWTH_STEP = 10_000;

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
  if (IDL_ACCOUNT_GROWTH > MAX_GROWTH_PER_EXECUTION) {
    throw new Error(
      "IDL_ACCOUNT_GROWTH exceeds what one Squads execution can reallocate",
    );
  }
  const newSize = idlAccount.data.length + IDL_ACCOUNT_GROWTH;
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("IDL account:", idlAddress.toBase58());
  console.log(
    `IDL payload: ${live.payload.length} bytes, sha256 ${sha256(live.payload)}`,
  );
  console.log(
    `Account size: ${idlAccount.data.length} bytes now, ${newSize} after`,
  );

  const newRent = await connection.getMinimumBalanceForRentExemption(newSize);
  const netCost = newRent - idlAccount.lamports - bufferAccount.lamports;
  const vaultBalance = await connection.getBalance(vault, "confirmed");
  console.log(
    `Vault pays ${(netCost / LAMPORTS_PER_SOL).toFixed(4)} SOL net, holds ${(vaultBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
  );

  const resizes = Math.ceil(
    Math.max(newSize - IDL_ACCOUNT_GROWTH_STEP, 0) / IDL_ACCOUNT_GROWTH_STEP,
  );
  const instructions = [
    idlCloseIx({
      programId: PROGRAM_ID,
      account: idlAddress,
      authority: vault,
      solDestination: vault,
    }),
    idlCreateIx({
      programId: PROGRAM_ID,
      from: vault,
      idlAddress,
      base,
      dataLen: newSize,
    }),
    ...Array.from({ length: resizes }, () =>
      idlResizeIx({
        programId: PROGRAM_ID,
        idl: idlAddress,
        authority: vault,
        dataLen: newSize,
      }),
    ),
    idlSetBufferIx({
      programId: PROGRAM_ID,
      buffer,
      idl: idlAddress,
      authority: vault,
    }),
    idlCloseIx({
      programId: PROGRAM_ID,
      account: buffer,
      authority: vault,
      solDestination: vault,
    }),
  ];

  const message = new TransactionMessage({
    payerKey: vault,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions,
  });

  // Run the vault's instructions as they would execute, before proposing them.
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

  const build = async () => {
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
      connection,
      MULTISIG,
    );
    const transactionIndex =
      BigInt(multisigAccount.transactionIndex.toString()) + 1n;

    const { vaultTxCreateIx, proposalCreateIx } =
      await createSquadsVaultTxAndProposal(
        MULTISIG,
        transactionIndex,
        message,
        payer.publicKey,
        payer.publicKey,
      );
    const [vaultTransactionPda] = multisig.getTransactionPda({
      multisigPda: MULTISIG,
      index: transactionIndex,
    });
    const [proposalPda] = multisig.getProposalPda({
      multisigPda: MULTISIG,
      transactionIndex,
    });

    return {
      transaction: new Transaction().add(vaultTxCreateIx, proposalCreateIx),
      transactionIndex,
      vaultTransactionPda,
      proposalPda,
    };
  };

  const { transactionIndex, vaultTransactionPda, proposalPda } =
    await sendWithRetries({
      provider,
      payer,
      name: "IDL account resize squads transaction",
      build,
      probe: ({ vaultTransactionPda }) =>
        probeSquadsVaultTransaction(
          connection,
          vaultTransactionPda,
          instructions,
        ),
    });

  console.log("Squads transaction index:", transactionIndex.toString());
  console.log("Squads transaction:", vaultTransactionPda.toBase58());
  console.log("Squads proposal:", proposalPda.toBase58());
  console.log(
    "Approve and execute it in Squads. `anchor idl fetch` returns the same IDL before and after.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
