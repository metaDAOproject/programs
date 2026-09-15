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
  TransactionInstruction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { TestContext } from "./main.test.js";
import {
  getDaoAddr,
  PERMISSIONLESS_ACCOUNT,
  PriceMath,
} from "@metadaoproject/programs";

export const TEN_SECONDS_IN_SLOTS = 25n;
export const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;
export const HOUR_IN_SLOTS = ONE_MINUTE_IN_SLOTS * 60n;
export const DAY_IN_SLOTS = HOUR_IN_SLOTS * 24n;

export const toBN = (val: bigint): typeof BN.prototype =>
  new BN(val.toString());

export const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

export async function setupBasicDao({
  context,
  baseMint,
  quoteMint,
  teamSponsoredPassThresholdBps = 300,
  teamAddress,
  initialSpendingLimit = null,
}: {
  context: TestContext;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  teamSponsoredPassThresholdBps?: number;
  teamAddress?: PublicKey;
  initialSpendingLimit?: {
    amountPerMonth: typeof BN.prototype;
    members: PublicKey[];
  } | null;
}) {
  const nonce = new BN(Math.floor(Math.random() * 1000000));

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
        initialSpendingLimit,
        baseToStake: new BN(0),
        teamSponsoredPassThresholdBps,
        teamAddress: teamAddress || context.payer.publicKey,
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

export type OldDaoLayoutOverrides = {
  optimisticProposal?: {
    squadsProposal: PublicKey;
    enqueuedTimestamp: typeof BN.prototype;
  } | null;
  isOptimisticGovernanceEnabled?: boolean;
  initialSpendingLimit?: {
    amountPerMonth: typeof BN.prototype;
    members: PublicKey[];
  } | null;
};

// Rewrites a real (new-layout) Dao account to the pre-migration on-chain layout.
export async function makeOldDaoLayout(
  ctx: TestContext,
  dao: PublicKey,
  overrides: OldDaoLayoutOverrides = {},
  opts: { lamports?: number; residue?: Buffer } = {},
): Promise<{ AFTER: number; BEFORE: number }> {
  const raw = await ctx.banksClient.getAccount(dao);
  const AFTER = raw.data.length;
  // 58 bytes: liquidator (Option<Pubkey>) + last_failed_takeover_at (i64)
  // + last_failed_liquidation_at (i64) + spending_limit_dirty (bool)
  // + last_buyback_finalized_at (i64)
  const BEFORE = AFTER - 58;

  const disc = Buffer.from(raw.data.slice(0, 8));
  const coder = ctx.futarchy.futarchy.account.dao.coder.accounts;
  const decoded = coder.decode("dao", Buffer.from(raw.data));

  if (overrides.optimisticProposal !== undefined)
    decoded.optimisticProposal = overrides.optimisticProposal;
  if (overrides.isOptimisticGovernanceEnabled !== undefined)
    decoded.isOptimisticGovernanceEnabled =
      overrides.isOptimisticGovernanceEnabled;
  if (overrides.initialSpendingLimit !== undefined)
    decoded.initialSpendingLimit = overrides.initialSpendingLimit;

  // Encode as oldDao and truncate to the pre-migration size.
  const body = await coder.encode("oldDao", decoded);
  const buf = Buffer.alloc(BEFORE);
  disc.copy(buf, 0);
  body.subarray(8).copy(buf, 8);
  if (opts.residue !== undefined) {
    assert.isAtMost(body.length + opts.residue.length, BEFORE);
    opts.residue.copy(buf, body.length);
  }

  ctx.context.setAccount(dao, {
    ...raw,
    data: buf,
    ...(opts.lamports !== undefined ? { lamports: opts.lamports } : {}),
  });

  return { AFTER, BEFORE };
}

// Pumps the pass market with a one-shot conditional-quote buy, then cranks
// the TWAPs `cranks` times, 20,000s apart. The defaults clear every kind's
// threshold (including HostileLiquidate's +25%) for the standard test market
// (~62,500 USDC / 62.5 META per conditional pool at price 1e15) and outlast
// every kind's duration. Deeper pools need a larger buyAmount; tighter
// clamps or longer durations need more cranks.
export async function pumpPassMarket(
  context: TestContext,
  {
    dao,
    proposal,
    baseMint,
    quoteMint,
    buyAmount = new BN(20_000 * 1_000_000),
    cranks = 100,
  }: {
    dao: PublicKey;
    proposal: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    buyAmount?: typeof BN.prototype;
    cranks?: number;
  },
) {
  const { question, baseVault, quoteVault } = context.futarchy.getProposalPdas(
    proposal,
    baseMint,
    quoteMint,
    dao,
  );

  // Splitting both sides also creates the trader's conditional token ATAs
  await context.conditionalVault
    .splitTokensIx(question, baseVault, baseMint, new BN(10 * 1_000_000), 2)
    .rpc();
  await context.conditionalVault
    .splitTokensIx(
      question,
      quoteVault,
      quoteMint,
      buyAmount.addn(cranks * 10 + 10_000),
      2,
    )
    .rpc();

  await context.futarchy
    .conditionalSwapIx({
      dao,
      baseMint,
      quoteMint,
      proposal,
      market: "pass",
      swapType: "buy",
      inputAmount: buyAmount,
      minOutputAmount: new BN(0),
    })
    .rpc();

  for (let i = 0; i < cranks; i++) {
    await context.advanceBySeconds(20_000);

    await context.futarchy
      .conditionalSwapIx({
        dao,
        baseMint,
        quoteMint,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10),
        minOutputAmount: new BN(0),
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
      ])
      .rpc();
  }
}

// pumpPassMarket, then finalize to Passed.
export async function passProposal(
  context: TestContext,
  args: {
    dao: PublicKey;
    proposal: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    buyAmount?: typeof BN.prototype;
    cranks?: number;
  },
) {
  await pumpPassMarket(context, args);

  await context.futarchy.finalizeProposal(args.proposal);

  const storedProposal = await context.futarchy.getProposal(args.proposal);
  assert.exists(storedProposal.state.passed);
}

// Squads' vault_transaction_execute gates only on the proposal's status, so
// flipping the borsh enum tag from Active (1) to Approved (3) — same payload
// shape, same size — makes the payload executable without running a market.
export async function forceApproveSquadsProposal(
  context: TestContext,
  squadsProposal: PublicKey,
) {
  const account = await context.banksClient.getAccount(squadsProposal);
  // 8 discriminator + 32 multisig + 8 transaction_index, then the status tag
  assert.equal(account.data[48], 1);
  account.data[48] = 3;
  context.context.setAccount(squadsProposal, account);
}

export async function executeVaultTransaction(
  context: TestContext,
  dao: PublicKey,
  squadsTransaction: PublicKey,
  preInstructions: TransactionInstruction[] = [],
  // For payloads whose inner message names signers beyond the vault PDA
  // (e.g. a gated_invoke caller) — Squads requires them on the execute
  extraSigners: Keypair[] = [],
) {
  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      context.squadsConnection,
      squadsTransaction,
    );

  const { instruction } = await multisig.instructions.vaultTransactionExecute({
    connection: context.squadsConnection,
    multisigPda: multisig.getMultisigPda({ createKey: dao })[0],
    transactionIndex: BigInt(vaultTransaction.index.toString()),
    member: PERMISSIONLESS_ACCOUNT.publicKey,
  });

  const tx = new Transaction().add(...preInstructions, instruction);
  [tx.recentBlockhash] = await context.banksClient.getLatestBlockhash();
  tx.feePayer = context.payer.publicKey;
  tx.sign(context.payer, PERMISSIONLESS_ACCOUNT, ...extraSigners);
  await context.banksClient.processTransaction(tx);
}

// The payload a typed create baked into its Squads vault transaction must be
// byte-identical to the expected instructions, in order, with the DAO's vault
// as the inner transaction's only signer — nothing re-validates the payload at
// execution, so exactness at create is the security model.
export async function assertVaultTransactionPayload(
  context: TestContext,
  dao: PublicKey,
  squadsTransaction: PublicKey,
  expectedIxs: TransactionInstruction[],
) {
  const { squadsMultisigVault } = await context.futarchy.getDao(dao);

  const vaultTransaction =
    await multisig.accounts.VaultTransaction.fromAccountAddress(
      context.squadsConnection,
      squadsTransaction,
    );
  const message = vaultTransaction.message;

  assert.equal(message.instructions.length, expectedIxs.length);
  assert.equal(message.numSigners, 1);
  assert.ok(message.accountKeys[0].equals(squadsMultisigVault));

  expectedIxs.forEach((expectedIx, i) => {
    const innerIx = message.instructions[i];
    assert.ok(
      message.accountKeys[innerIx.programIdIndex].equals(expectedIx.programId),
    );
    assert.deepEqual(
      [...innerIx.accountIndexes].map((index) =>
        message.accountKeys[index].toBase58(),
      ),
      expectedIx.keys.map((key) => key.pubkey.toBase58()),
    );
    assert.equal(
      Buffer.from(innerIx.data).toString("hex"),
      expectedIx.data.toString("hex"),
    );
  });
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
