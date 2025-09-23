import { BN } from "bn.js";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

export const toBN = (val: bigint): typeof BN.prototype =>
  new BN(val.toString());

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
  provider: any,
  additionalAddresses: PublicKey[] = [],
): Promise<AddressLookupTableAccount> {
  // use a different authority for the lookup table to avoid conflicts
  const lookupAuthority = Keypair.generate();
  // Should ^ be the payer so we can update it?
  const slot = await provider.connection.getSlot();

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

  // Create the lookup table
  let createLutTx = new Transaction().add(createTableIx);
  let blockhash = await provider.connection.getLatestBlockhash();

  createLutTx.recentBlockhash = blockhash.blockhash;
  createLutTx.feePayer = payer.publicKey;
  createLutTx.sign(payer, lookupAuthority);

  await provider.connection.sendRawTransaction(createLutTx.serialize());
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Extend the lookup table with all unique accounts
  const addressesPerExtend = 20;
  for (let i = 0; i < finalUniqueAddresses.length; i += addressesPerExtend) {
    const batch = finalUniqueAddresses.slice(i, i + addressesPerExtend);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: lookupAuthority.publicKey,
      payer: payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: batch,
    });

    let extendLutTx = new Transaction().add(extendTableIx);
    blockhash = await provider.connection.getLatestBlockhash();
    extendLutTx.recentBlockhash = blockhash.blockhash;
    extendLutTx.feePayer = payer.publicKey;
    extendLutTx.sign(payer, lookupAuthority);

    await provider.connection.sendRawTransaction(extendLutTx.serialize());
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Add a dummy account to ensure the lookup table has enough entries for all indexes
  const dummyAccount = Keypair.generate().publicKey;
  const extendTableIx = AddressLookupTableProgram.extendLookupTable({
    authority: lookupAuthority.publicKey,
    payer: payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [dummyAccount],
  });

  let extendLutTx = new Transaction().add(extendTableIx);
  blockhash = await provider.connection.getLatestBlockhash();
  extendLutTx.recentBlockhash = blockhash.blockhash;
  extendLutTx.feePayer = payer.publicKey;
  extendLutTx.sign(payer, lookupAuthority);

  await provider.connection.sendRawTransaction(extendLutTx.serialize());
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Fetch and return the lookup table account
  let lookupTableAccount =
    await provider.connection.getAddressLookupTable(lookupTableAddress);
  console.log("created lookupTableAccount", lookupTableAccount);

  return lookupTableAccount.value;
}
