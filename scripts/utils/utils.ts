import { BN } from "bn.js";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
  TransactionInstruction,
} from "@solana/web3.js";

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

export const toBN = (val: bigint): typeof BN.prototype =>
  new BN(val.toString());

/** Priority fee for lookup-table transactions (matches the rest of the tooling). */
const LUT_PRIORITY_FEE_MICRO_LAMPORTS = parseInt(
  process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000",
  10,
);

/** Attempts per lookup-table transaction before giving up. */
const LUT_TX_RETRIES = 3;

/**
 * Send one lookup-table transaction and wait for confirmation, throwing on an
 * on-chain error. Confirmation matters here: extends fail if the create
 * hasn't landed, and a silent drop would otherwise only surface as a generic
 * timeout in the finalization check.
 *
 * Expired (dropped) transactions are retried with a fresh blockhash. That is
 * safe for extends — a false expiry only appends duplicate addresses, which
 * compileToV0Message handles fine and the finalization check ignores.
 */
async function sendAndConfirmLutTx(
  connection: Connection,
  instruction: TransactionInstruction,
  payer: Keypair,
  authority: Keypair,
  label: string,
): Promise<void> {
  for (let attempt = 1; attempt <= LUT_TX_RETRIES; attempt++) {
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: LUT_PRIORITY_FEE_MICRO_LAMPORTS,
      }),
      instruction,
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer, authority);

    const signature = await connection.sendRawTransaction(tx.serialize());
    try {
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
      return;
    } catch (err) {
      const isExpiry =
        err instanceof TransactionExpiredBlockheightExceededError ||
        err instanceof TransactionExpiredTimeoutError;
      if (isExpiry && attempt < LUT_TX_RETRIES) {
        console.log(
          `${label} expired — retrying with a fresh blockhash (attempt ${attempt}/${LUT_TX_RETRIES})`,
        );
        continue;
      }
      throw err;
    }
  }
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

  // Extract all unique accounts from the transaction
  const accountsToAdd = transaction.instructions.map((instruction) =>
    instruction.keys.map((key) => key.pubkey),
  );
  const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];
  console.log("uniqueAccounts", uniqueAccounts.length);

  // Add any additional addresses
  const allAddresses = [...uniqueAccounts, ...additionalAddresses];
  const finalUniqueAddresses = [...new Set(allAddresses)] as PublicKey[];

  // Create the lookup table — must be confirmed before any extend can land.
  // Retried with a re-derived address: createLookupTable requires a slot that
  // is still in the SlotHashes sysvar, so a create that failed (e.g. a stale
  // getSlot from a lagging RPC) needs a fresh slot, which changes the derived
  // table address. An abandoned attempt just strands dust rent.
  let lookupTableAddress: PublicKey | undefined;
  for (let attempt = 1; lookupTableAddress === undefined; attempt++) {
    const slot = await connection.getSlot();
    const [createTableIx, tableAddress] =
      AddressLookupTableProgram.createLookupTable({
        authority: lookupAuthority.publicKey,
        payer: payer.publicKey,
        recentSlot: slot - 1,
      });
    try {
      await sendAndConfirmLutTx(
        connection,
        createTableIx,
        payer,
        lookupAuthority,
        "Create lookup table",
      );
      lookupTableAddress = tableAddress;
    } catch (err) {
      if (attempt >= LUT_TX_RETRIES) throw err;
      console.log(
        `Create lookup table failed (${err instanceof Error ? err.message : String(err)}) — retrying with a fresh slot`,
      );
    }
  }

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
