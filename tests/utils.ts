import { assert } from "chai";
import { Clock, ProgramTestContext } from "solana-bankrun";
import { BN } from "bn.js";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { TestContext } from "./main.test.js";
import { getDaoAddr, PriceMath } from "@metadaoproject/programs";

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

export const toBN = (val: bigint): typeof BN.prototype =>
  new BN(val.toString());

// Monotonic DAO-nonce allocator. The DAO PDA is [SEED_DAO, daoCreator, nonce] and
// every test shares the same creator (the provider wallet), so the nonce space is
// global across the whole suite. A single shared counter guarantees uniqueness;
// random nonces collided (birthday bound) and intermittently failed init with the
// System program's "account already in use" (0x0). Mirrors `mintToTxNonce`.
let daoNonceCounter = 1;
export const nextDaoNonce = (): typeof BN.prototype =>
  new BN(daoNonceCounter++);

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export async function setupBasicDao({
  context,
  baseMint,
  quoteMint,
  teamSponsoredPassThresholdBps = 300,
  teamAddress,
}: {
  context: TestContext;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  teamSponsoredPassThresholdBps?: number;
  teamAddress?: PublicKey;
}) {
  const nonce = nextDaoNonce();

  await context.futarchy
    .initializeDaoIx({
      baseMint,
      quoteMint,
      params: {
        secondsPerProposal: 60 * 60 * 24 * 3,
        twapStartDelaySeconds: 60 * 60 * 24,
        twapInitialObservation: THOUSAND_BUCK_PRICE,
        twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
        minQuoteFutarchicLiquidity: new BN(10_000),
        minBaseFutarchicLiquidity: new BN(10_000),
        passThresholdBps: 300,
        nonce,
        initialSpendingLimit: null,
        baseToStake: new BN(0),
        teamSponsoredPassThresholdBps,
        teamAddress: teamAddress || context.payer.publicKey,
        baseToSupermajority: new BN(0),
      },
      provideLiquidity: true,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .rpc();

  const [dao] = getDaoAddr({
    nonce,
    daoCreator: context.payer.publicKey,
  });

  return dao;
}

export async function setOptimisticGovernanceEnabled(
  context: TestContext,
  dao: PublicKey,
  enabled: boolean,
): Promise<void> {
  const daoAccount = await context.futarchy.getDao(dao);
  daoAccount.isOptimisticGovernanceEnabled = enabled;
  const daoAccountBuffer =
    await context.futarchy.futarchy.account.dao.coder.accounts.encode(
      "dao",
      daoAccount,
    );

  const daoBanksAccount = await context.banksClient.getAccount(dao);
  daoBanksAccount.data.set(daoAccountBuffer, 0);
  context.context.setAccount(dao, daoBanksAccount);
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
  context: {
    banksClient: any;
    payer: Keypair;
    advanceBySlots: (slots: bigint) => Promise<void>;
  },
  additionalAddresses: PublicKey[] = [],
): Promise<AddressLookupTableAccount> {
  // use a different authority for the lookup table to avoid conflicts
  const lookupAuthority = Keypair.generate();
  const slot = await context.banksClient.getSlot();

  const [createTableIx, lookupTableAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: lookupAuthority.publicKey,
      payer: context.payer.publicKey,
      recentSlot: slot - 1n,
    });

  // Extract all unique accounts from the transaction (deduplicate by base58)
  const accountsToAdd = transaction.instructions.flatMap((instruction) =>
    instruction.keys.map((key) => key.pubkey),
  );
  const seen = new Set<string>();
  const uniqueAccounts: PublicKey[] = [];
  for (const key of accountsToAdd) {
    const b58 = key.toBase58();
    if (!seen.has(b58)) {
      seen.add(b58);
      uniqueAccounts.push(key);
    }
  }
  console.log("uniqueAccounts", uniqueAccounts.length);

  // Add any additional addresses
  for (const key of additionalAddresses) {
    const b58 = key.toBase58();
    if (!seen.has(b58)) {
      seen.add(b58);
      uniqueAccounts.push(key);
    }
  }
  const finalUniqueAddresses = uniqueAccounts;

  // Create the lookup table
  const createLutTx = new Transaction().add(createTableIx);
  createLutTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  createLutTx.feePayer = context.payer.publicKey;
  createLutTx.sign(context.payer, lookupAuthority);
  // createLutTx.partialSign(lookupAuthority);

  await context.banksClient.processTransaction(createLutTx);
  await context.advanceBySlots(1n);

  // Extend the lookup table with all unique accounts
  const addressesPerExtend = 20;
  for (let i = 0; i < finalUniqueAddresses.length; i += addressesPerExtend) {
    const batch = finalUniqueAddresses.slice(i, i + addressesPerExtend);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: lookupAuthority.publicKey,
      payer: context.payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: batch,
    });

    const extendLutTx = new Transaction().add(extendTableIx);
    extendLutTx.recentBlockhash = (
      await context.banksClient.getLatestBlockhash()
    )[0];
    extendLutTx.feePayer = context.payer.publicKey;
    extendLutTx.sign(context.payer, lookupAuthority);

    await context.banksClient.processTransaction(extendLutTx);
    await context.advanceBySlots(1n);
  }

  // Add a dummy account to ensure the lookup table has enough entries for all indexes
  const dummyAccount = Keypair.generate().publicKey;
  const extendTableIx = AddressLookupTableProgram.extendLookupTable({
    authority: lookupAuthority.publicKey,
    payer: context.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [dummyAccount],
  });

  const extendLutTx = new Transaction().add(extendTableIx);
  extendLutTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  extendLutTx.feePayer = context.payer.publicKey;
  extendLutTx.sign(context.payer, lookupAuthority);

  await context.banksClient.processTransaction(extendLutTx);
  await context.advanceBySlots(1n);

  // Fetch and return the lookup table account
  const rawStoredLookupTable =
    await context.banksClient.getAccount(lookupTableAddress);

  return new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(rawStoredLookupTable.data),
  });
}

export const expectError = (
  expectedError: string,
  message: string,
): [() => void, (e: any) => void] => {
  return [
    () => assert.fail(message),
    (e) => {
      assert(e.error != undefined, `problem retrieving program error: ${e}`);
      assert(
        e.error.errorCode != undefined,
        "problem retrieving program error code",
      );
      //for (let idlError of program.idl.errors) {
      //  if (idlError.code == e.code) {
      //    assert.equal(idlError.name, expectedError);
      //    return;
      //  }
      //}
      assert.equal(
        e.error.errorCode.code,
        expectedError,
        `the program threw for a reason that we didn't expect. error : ${e}`,
      );
      /* assert.fail("error doesn't match idl"); */
      /* console.log(program.idl.errors); */
      /* assert( */
      /*   e["error"] != undefined, */
      /*   `the program threw for a reason that we didn't expect. error: ${e}` */
      /* ); */
      /* assert.equal(e.error.errorCode.code, expectedErrorCode); */
    },
  ];
};

export const advanceBySlots = async (
  context: ProgramTestContext,
  slots: bigint,
) => {
  const currentClock = await context.banksClient.getClock();
  context.setClock(
    new Clock(
      currentClock.slot + slots,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      50n,
    ),
  );
};
