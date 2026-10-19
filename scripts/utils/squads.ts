import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  PACKET_DATA_SIZE,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import type { ProbeResult } from "./transactions.js";

// Returns the multisig, spending limit and 0th vault pda for a given dao address
export const getSquadsPdasFromDao = async (
  daoAddress: string | PublicKey,
): Promise<{
  multisigPda: PublicKey;
  spendingLimitPda: PublicKey;
  vaultPda: PublicKey;
}> => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPda,
    createKey: dao,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda: multisigPda,
    index: 0,
  });

  return {
    multisigPda,
    spendingLimitPda,
    vaultPda,
  };
};

export const createSquadsVaultTxAndProposal = async (
  squadsMultisig: PublicKey,
  transactionIndex: bigint,
  transactionMessage: TransactionMessage,
  payer: PublicKey,
  creator: PublicKey = PERMISSIONLESS_ACCOUNT.publicKey,
  addressLookupTableAccounts?: AddressLookupTableAccount[],
) => {
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
    addressLookupTableAccounts,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    isDraft: false,
  });

  return {
    vaultTxCreateIx,
    proposalCreateIx,
  };
};

/**
 * Whether the transaction creating a squads vault transaction + proposal
 * holding `instructions` fits in a Solana transaction. The vault transaction
 * carries its whole message as instruction data, so instructions touching
 * many accounts only fit once the accounts are loaded from a lookup table
 * (see createLookupTable).
 */
export const squadsVaultTransactionFits = async ({
  squadsMultisig,
  vault,
  instructions,
  payer,
  creator,
  addressLookupTableAccounts,
}: {
  squadsMultisig: PublicKey;
  vault: PublicKey;
  instructions: TransactionInstruction[];
  payer: PublicKey;
  creator?: PublicKey;
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}) => {
  // Only the size matters here, so the index and blockhashes are placeholders
  const transactionMessage = new TransactionMessage({
    payerKey: vault,
    recentBlockhash: PublicKey.default.toBase58(),
    instructions,
  });
  const { vaultTxCreateIx, proposalCreateIx } =
    await createSquadsVaultTxAndProposal(
      squadsMultisig,
      0n,
      transactionMessage,
      payer,
      creator,
      addressLookupTableAccounts,
    );

  const transaction = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  transaction.recentBlockhash = PublicKey.default.toBase58();
  transaction.feePayer = payer;
  const message = transaction.compileMessage();

  const size =
    1 + 64 * message.header.numRequiredSignatures + message.serialize().length;
  return size <= PACKET_DATA_SIZE;
};

// Keeps the transaction creating and extending a lookup table within the
// transaction size limit
const LOOKUP_TABLE_ADDRESSES_PER_TRANSACTION = 20;

/**
 * Builds the transactions creating a lookup table of the accounts
 * `instructions` touch and freezing it, so that a squads vault transaction
 * loading its accounts from the table can never resolve to other accounts.
 * Signers and the invoked programs stay in the message, so they're left out.
 * Returns the table as the vault transaction should be compiled with, ahead
 * of the transactions being sent - in order, signed and paid for by `payer`.
 */
export const createLookupTable = async ({
  connection,
  payer,
  instructions,
}: {
  connection: Connection;
  payer: PublicKey;
  instructions: TransactionInstruction[];
}) => {
  const staysInMessage = (pubkey: PublicKey) =>
    instructions.some(
      (instruction) =>
        instruction.programId.equals(pubkey) ||
        instruction.keys.some(
          (key) => key.isSigner && key.pubkey.equals(pubkey),
        ),
    );
  const addresses = [
    ...new Map(
      instructions
        .flatMap((instruction) => instruction.keys.map((key) => key.pubkey))
        .map((pubkey) => [pubkey.toBase58(), pubkey] as const),
    ).values(),
  ].filter((pubkey) => !staysInMessage(pubkey));
  if (addresses.length === 0) {
    throw new Error(
      "The instructions have no accounts a lookup table could hold",
    );
  }

  // The table's address derives from a recent slot, which the program checks
  // against the slot hashes it keeps; a finalized slot is surely among them
  const recentSlot = await connection.getSlot("finalized");
  const [createIx, lookupTable] = AddressLookupTableProgram.createLookupTable({
    authority: payer,
    payer,
    recentSlot,
  });

  const transactions: Transaction[] = [];
  for (
    let i = 0;
    i < addresses.length;
    i += LOOKUP_TABLE_ADDRESSES_PER_TRANSACTION
  ) {
    const transaction = new Transaction();
    if (i === 0) {
      transaction.add(createIx);
    }
    transaction.add(
      AddressLookupTableProgram.extendLookupTable({
        lookupTable,
        authority: payer,
        payer,
        addresses: addresses.slice(
          i,
          i + LOOKUP_TABLE_ADDRESSES_PER_TRANSACTION,
        ),
      }),
    );
    if (i + LOOKUP_TABLE_ADDRESSES_PER_TRANSACTION >= addresses.length) {
      transaction.add(
        AddressLookupTableProgram.freezeLookupTable({
          lookupTable,
          authority: payer,
        }),
      );
    }
    transactions.push(transaction);
  }

  return {
    lookupTable: new AddressLookupTableAccount({
      key: lookupTable,
      state: {
        deactivationSlot: 2n ** 64n - 1n,
        lastExtendedSlot: 0,
        lastExtendedSlotStartIndex: 0,
        authority: undefined,
        addresses,
      },
    }),
    transactions,
  };
};

/**
 * The addresses a vault transaction's message loads from its lookup tables,
 * in the order its instructions index them after the static account keys:
 * every table's writable addresses, then every table's readonly ones. Null
 * when one of the tables doesn't exist.
 */
export const loadVaultTransactionAddresses = async (
  connection: Connection,
  message: multisig.generated.VaultTransactionMessage,
): Promise<PublicKey[] | null> => {
  const tables: {
    lookup: multisig.generated.MultisigMessageAddressTableLookup;
    addresses: PublicKey[];
  }[] = [];
  for (const lookup of message.addressTableLookups) {
    const { value } = await connection.getAddressLookupTable(
      lookup.accountKey,
      { commitment: "confirmed" },
    );
    if (!value) {
      return null;
    }
    tables.push({ lookup, addresses: value.state.addresses });
  }

  const loaded = (
    indexes: (
      lookup: multisig.generated.MultisigMessageAddressTableLookup,
    ) => Uint8Array,
  ) =>
    tables.flatMap(({ lookup, addresses }) =>
      Array.from(indexes(lookup)).map((index) => addresses[index]),
    );
  return [
    ...loaded((lookup) => lookup.writableIndexes),
    ...loaded((lookup) => lookup.readonlyIndexes),
  ];
};

/**
 * How a vault transaction's message compares to `instructions`: `exact` when
 * it holds the same programs, accounts (in order) and data; `data` when only
 * the data of some instructions (`differing`, by index) differs - the same
 * actions built against other state; `different` otherwise: other programs
 * or accounts, or another number of instructions. `loadedAddresses` are the
 * accounts the message loads from lookup tables, if any (see
 * loadVaultTransactionAddresses).
 */
export type InstructionsComparison =
  | { kind: "exact" }
  | { kind: "data"; differing: number[] }
  | { kind: "different" };

export const compareVaultTransactionInstructions = (
  message: multisig.generated.VaultTransactionMessage,
  instructions: TransactionInstruction[],
  loadedAddresses: PublicKey[] = [],
): InstructionsComparison => {
  if (message.instructions.length !== instructions.length) {
    return { kind: "different" };
  }
  const accountKeys = [...message.accountKeys, ...loadedAddresses];

  const differing: number[] = [];
  for (const [i, compiled] of message.instructions.entries()) {
    const instruction = instructions[i];
    const accounts = Array.from(compiled.accountIndexes).map(
      (index) => accountKeys[index],
    );
    const sameTarget =
      accountKeys[compiled.programIdIndex]?.equals(instruction.programId) &&
      accounts.length === instruction.keys.length &&
      accounts.every((account, j) =>
        account?.equals(instruction.keys[j].pubkey),
      );
    if (!sameTarget) {
      return { kind: "different" };
    }
    if (!Buffer.from(compiled.data).equals(instruction.data)) {
      differing.push(i);
    }
  }

  return differing.length > 0 ? { kind: "data", differing } : { kind: "exact" };
};

/**
 * Probes the vault transaction at `vaultTransactionPda`: absent, holding
 * exactly `instructions` (landed - either ours or an identical one, which
 * amounts to the same), or holding something else (taken - another proposal
 * got the transaction index).
 */
export const probeSquadsVaultTransaction = async (
  connection: Connection,
  vaultTransactionPda: PublicKey,
  instructions: TransactionInstruction[],
): Promise<ProbeResult> => {
  const accountInfo = await connection.getAccountInfo(
    vaultTransactionPda,
    "confirmed",
  );
  if (!accountInfo) {
    return "absent";
  }
  const [vaultTransaction] =
    multisig.accounts.VaultTransaction.fromAccountInfo(accountInfo);
  const loadedAddresses = await loadVaultTransactionAddresses(
    connection,
    vaultTransaction.message,
  );
  if (!loadedAddresses) {
    return "taken";
  }
  return compareVaultTransactionInstructions(
    vaultTransaction.message,
    instructions,
    loadedAddresses,
  ).kind === "exact"
    ? "landed"
    : "taken";
};
