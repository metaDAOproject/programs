import { BN } from "bn.js";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

export const toBN = (val: bigint): typeof BN.prototype =>
  new BN(val.toString());

/**
 * Send one lookup-table transaction and wait for confirmation, throwing on an
 * on-chain error. Confirmation matters here: extends fail if the create
 * hasn't landed, and there is no retry loop — a silent drop would otherwise
 * only surface as a generic timeout in the finalization check.
 */
async function sendAndConfirmLutTx(
  connection: Connection,
  instruction: TransactionInstruction,
  payer: Keypair,
  authority: Keypair,
  label: string,
): Promise<void> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const tx = new Transaction().add(instruction);
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer, authority);

  const signature = await connection.sendRawTransaction(tx.serialize());
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(
      `${label} failed on-chain: ${JSON.stringify(confirmation.value.err)} (tx ${signature})`,
    );
  }
  console.log(`${label} confirmed: ${signature}`);
}

/**
 * Creates a lookup table for all unique accounts in a transaction
 * @param transaction - The transaction to create a lookup table for
 * @param context - Test context containing banksClient, payer, and advanceBySlots
 * @param additionalAddresses - Optional additional addresses to include in the lookup table
 * @returns Promise<AddressLookupTableAccount> - The created lookup table account
 */
export async function createLookupTableForTransaction(
  transaction: Transaction,
  payer: Keypair,
  connection: Connection,
  additionalAddresses: PublicKey[] = [],
): Promise<AddressLookupTableAccount> {
  // use a different authority for the lookup table to avoid conflicts
  const lookupAuthority = Keypair.generate();
  // Should ^ be the payer so we can update it?
  const slot = await connection.getSlot();

  const [createTableIx, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: lookupAuthority.publicKey,
      payer: payer.publicKey,
      recentSlot: slot - 1,
    });

  // Extract all unique accounts from the transaction
  const accountsToAdd = transaction.instructions.map((instruction) =>
    instruction.keys.map((key) => key.pubkey),
  );
  const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];
  console.log("uniqueAccounts", uniqueAccounts.length);

  // Add any additional addresses
  const allAddresses = [...uniqueAccounts, ...additionalAddresses];
  const finalUniqueAddresses = [...new Set(allAddresses)] as PublicKey[];

  // Create the lookup table — must be confirmed before any extend can land
  await sendAndConfirmLutTx(
    connection,
    createTableIx,
    payer,
    lookupAuthority,
    "Create lookup table",
  );

  // Extend the lookup table with all unique accounts
  const addressesPerExtend = 20;
  const totalExtends = Math.ceil(
    finalUniqueAddresses.length / addressesPerExtend,
  );
  for (let i = 0; i < finalUniqueAddresses.length; i += addressesPerExtend) {
    const batch = finalUniqueAddresses.slice(i, i + addressesPerExtend);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: lookupAuthority.publicKey,
      payer: payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: batch,
    });

    await sendAndConfirmLutTx(
      connection,
      extendTableIx,
      payer,
      lookupAuthority,
      `Extend lookup table ${Math.floor(i / addressesPerExtend) + 1}/${totalExtends}`,
    );
  }

  // Wait until the FINALIZED view of the table contains every address. That
  // guarantees both halves of usability: no create/extend was dropped (the
  // table really holds everything we submitted), and any blockhash fetched
  // from here on belongs to a slot after the table's lastExtendedSlot, so a
  // v0 transaction referencing it is immediately valid.
  const expected = finalUniqueAddresses.map((address) => address.toBase58());
  const maxAttempts = 45;
  let missing: string[] = expected;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const lookupTableAccount = await connection.getAddressLookupTable(
      lookupTableAddress,
      { commitment: "finalized" },
    );
    const present = new Set(
      (lookupTableAccount.value?.state.addresses ?? []).map((address) =>
        address.toBase58(),
      ),
    );
    missing = expected.filter((address) => !present.has(address));
    if (lookupTableAccount.value && missing.length === 0) {
      console.log(
        `Lookup table ${lookupTableAddress.toBase58()} finalized with ${present.size} addresses`,
      );
      return lookupTableAccount.value;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Lookup table ${lookupTableAddress.toBase58()} did not finalize with all addresses after ${maxAttempts} attempts (${missing.length}/${expected.length} still missing)`,
  );
}
