// Executable documentation for building v0 transactions against the global
// frozen ALT (RELAUNCH_V0_1_GLOBAL_ALT, loaded in bankrun from
// tests/fixtures/relaunch-global-alt). Case selection and rationale:
// vibes/relaunch-alt-example-tests.html. The SDK conveniences still send
// legacy transactions; integrators composing the ix builders themselves are
// the audience for these patterns.
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { BanksClient } from "solana-bankrun";
import {
  getPumpFeeRecipients,
  RAYDIUM_AMM_AUTHORITY,
  RAYDIUM_AMM_PROGRAM_ID,
  RELAUNCH_V0_1_GLOBAL_ALT,
  RelaunchClient,
} from "@metadaoproject/programs";
import { buildV0Tx, setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool, PumpPool } from "../pumpAmm.js";
import { writeRaydiumPool, RaydiumPool } from "../raydiumAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const BASE_OUT = 10_000n * 10n ** 6n; // 10k old tokens
const MAX_QUOTE_IN = 2n * 10n ** 9n; // 2 SOL cap on the buy

async function tokenBalance(
  banksClient: BanksClient,
  address: PublicKey,
  tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
): Promise<bigint> {
  const raw = await banksClient.getAccount(address);
  if (!raw) return 0n;
  return token.unpackAccount(
    address,
    { ...raw, data: Buffer.from(raw.data) } as any,
    tokenProgram,
  ).amount;
}

async function lamports(
  banksClient: BanksClient,
  address: PublicKey,
): Promise<bigint> {
  return BigInt((await banksClient.getAccount(address))!.lamports);
}

// The constant-product input for an exact-output buy, before fees.
function grossQuoteIn(baseOut: bigint): bigint {
  return (WSOL_POOL_QUOTE_RESERVE * baseOut) / (POOL_BASE_RESERVE - baseOut);
}

export default function suite() {
  let client: RelaunchClient;
  let globalAlt: AddressLookupTableAccount;
  let protocolFeeRecipient: PublicKey;
  let buybackFeeRecipient: PublicKey;

  before(async function () {
    client = this.relaunch;
    ({ protocolFeeRecipient, buybackFeeRecipient } = await getPumpFeeRecipients(
      this.connection,
    ));
    // Fetched the way a script would fetch it: the harness connection runs
    // web3.js's real getAddressLookupTable against bankrun state.
    globalAlt = (
      await this.connection.getAddressLookupTable(RELAUNCH_V0_1_GLOBAL_ALT)
    ).value!;
  });

  const setupLiveRelaunch = async function (this: Mocha.Context): Promise<{
    relaunch: PublicKey;
    pool: PumpPool;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
  }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    const { relaunch } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    });
    await client.startDepositsIx({ relaunch }).rpc();

    return { ...setup, pool, relaunch };
  };

  const fundSol = async function (
    this: Mocha.Context,
    to: PublicKey,
    amount: bigint,
  ) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: to,
        lamports: Number(amount),
      }),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);
  };

  // The full single-transaction buy flow for a depositor holding native SOL:
  // wrap instructions, the buy, and an unwrap of the refund.
  const wrapBuyUnwrapIxs = async ({
    relaunch,
    pool,
    depositor,
    payer,
  }: {
    relaunch: PublicKey;
    pool: PumpPool;
    depositor: PublicKey;
    payer: PublicKey;
  }) => {
    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      depositor,
    );
    return [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 350_000 }),
      token.createAssociatedTokenAccountIdempotentInstruction(
        depositor,
        wsolAta,
        depositor,
        token.NATIVE_MINT,
      ),
      SystemProgram.transfer({
        fromPubkey: depositor,
        toPubkey: wsolAta,
        lamports: Number(MAX_QUOTE_IN),
      }),
      token.createSyncNativeInstruction(wsolAta),
      await client
        .depositViaBuyIx({
          relaunch,
          oldMint: pool.baseMint,
          oldTokenProgram: token.TOKEN_PROGRAM_ID,
          sourceQuoteMint: pool.quoteMint,
          sourcePool: pool.pool,
          poolBaseTokenAccount: pool.poolBaseTokenAccount,
          poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
          coinCreator: pool.coinCreator,
          protocolFeeRecipient,
          buybackFeeRecipient,
          baseOut: new BN(BASE_OUT.toString()),
          maxQuoteIn: new BN(MAX_QUOTE_IN.toString()),
          depositor,
          payer,
        })
        .instruction(),
      token.createCloseAccountInstruction(wsolAta, depositor, depositor),
    ];
  };

  it("deposit_via_buy: wrap, buy, and unwrap the refund in one atomic transaction", async function () {
    const { relaunch, pool } = await setupLiveRelaunch.call(this);
    const depositor = Keypair.generate();
    await fundSol.call(this, depositor.publicKey, 5n * 10n ** 9n);

    const ixs = await wrapBuyUnwrapIxs({
      relaunch,
      pool,
      depositor: depositor.publicKey,
      payer: depositor.publicKey,
    });

    // As a legacy transaction this instruction list does not fit — which is
    // why, without the ALT, the wrap rides a separate (non-atomic)
    // preparatory transaction.
    const legacyTx = new Transaction().add(...ixs);
    legacyTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    legacyTx.feePayer = depositor.publicKey;
    legacyTx.sign(depositor);
    assert.throws(() => legacyTx.serialize(), /too large/i);

    const solBefore = await lamports(this.banksClient, depositor.publicKey);
    const tx = await buildV0Tx({
      banksClient: this.banksClient,
      payerKey: depositor.publicKey,
      instructions: ixs,
      signers: [depositor],
      tables: [globalAlt],
    });
    assert.isAtMost(tx.serialize().length, 1232);
    await this.banksClient.processTransaction(tx);

    const record = await client.getDepositRecord({
      relaunch,
      depositor: depositor.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    const { oldTokenVault } = await client.fetchRelaunch(relaunch);
    const vaultBalance = await tokenBalance(this.banksClient, oldTokenVault);
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The refund came back as native SOL: the WSOL ATA is gone, and the
    // depositor's lamport outflow is the buy's cost (plus fee and the
    // deposit-record/volume-accumulator rents), well under the 2 SOL cap.
    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      depositor.publicKey,
    );
    assert.isNull(await this.banksClient.getAccount(wsolAta));
    const outflow =
      solBefore - (await lamports(this.banksClient, depositor.publicKey));
    assert.isTrue(outflow >= grossQuoteIn(BASE_OUT) && outflow < MAX_QUOTE_IN);
  });

  it("deposit_via_buy: sponsor pays fees and rent, depositor only spends the quote", async function () {
    const { relaunch, pool } = await setupLiveRelaunch.call(this);
    const sponsor = Keypair.generate();
    const depositor = Keypair.generate();
    await fundSol.call(this, sponsor.publicKey, 10n ** 9n);
    await fundSol.call(this, depositor.publicKey, 3n * 10n ** 9n);

    const ixs = await wrapBuyUnwrapIxs({
      relaunch,
      pool,
      depositor: depositor.publicKey,
      payer: sponsor.publicKey,
    });

    // Two distinct signers push the legacy encoding even further past the
    // limit: this flow does not exist without the ALT.
    const legacyTx = new Transaction().add(...ixs);
    legacyTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    legacyTx.feePayer = sponsor.publicKey;
    legacyTx.sign(sponsor, depositor);
    assert.throws(() => legacyTx.serialize(), /too large/i);

    const sponsorBefore = await lamports(this.banksClient, sponsor.publicKey);
    const depositorBefore = await lamports(
      this.banksClient,
      depositor.publicKey,
    );
    const tx = await buildV0Tx({
      banksClient: this.banksClient,
      payerKey: sponsor.publicKey,
      instructions: ixs,
      signers: [sponsor, depositor],
      tables: [globalAlt],
    });
    assert.isAtMost(tx.serialize().length, 1232);
    await this.banksClient.processTransaction(tx);

    const record = await client.getDepositRecord({
      relaunch,
      depositor: depositor.publicKey,
    });
    assert.isTrue(record.depositor.equals(depositor.publicKey));
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    // The depositor paid exactly the buy's cost: no transaction fee, no
    // record rent, and the wrap ATA's rent round-tripped back on close. The
    // sponsor covered the rest.
    const spent =
      depositorBefore - (await lamports(this.banksClient, depositor.publicKey));
    const gross = grossQuoteIn(BASE_OUT);
    assert.isTrue(spent >= gross && spent < (gross * 103n) / 100n);
    assert.isTrue(
      (await lamports(this.banksClient, sponsor.publicKey)) < sponsorBefore,
    );
  });

  const setupLiveRaydiumRelaunch = async function (
    this: Mocha.Context,
  ): Promise<{
    relaunch: PublicKey;
    pool: RaydiumPool;
    oldMint: PublicKey;
  }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = writeRaydiumPool({
      context: this.context,
      oldMint: setup.oldMint,
      tokenReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
    });

    const { relaunch } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: token.NATIVE_MINT,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    });
    await client.startDepositsIx({ relaunch }).rpc();

    return { oldMint: setup.oldMint, pool, relaunch };
  };

  // The Raydium counterpart of wrapBuyUnwrapIxs: same wrap choreography, no
  // pump fee-recipient or volume-accumulator accounts.
  const wrapBuyUnwrapRaydiumIxs = async ({
    relaunch,
    pool,
    oldMint,
    depositor,
    payer,
  }: {
    relaunch: PublicKey;
    pool: RaydiumPool;
    oldMint: PublicKey;
    depositor: PublicKey;
    payer: PublicKey;
  }) => {
    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      depositor,
    );
    return [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
      token.createAssociatedTokenAccountIdempotentInstruction(
        depositor,
        wsolAta,
        depositor,
        token.NATIVE_MINT,
      ),
      SystemProgram.transfer({
        fromPubkey: depositor,
        toPubkey: wsolAta,
        lamports: Number(MAX_QUOTE_IN),
      }),
      token.createSyncNativeInstruction(wsolAta),
      await client
        .depositViaBuyRaydiumIx({
          relaunch,
          oldMint,
          sourceQuoteMint: token.NATIVE_MINT,
          sourcePool: pool.pool,
          ammCoinVault: pool.coinVault,
          ammPcVault: pool.pcVault,
          baseOut: new BN(BASE_OUT.toString()),
          maxQuoteIn: new BN(MAX_QUOTE_IN.toString()),
          depositor,
          payer,
        })
        .instruction(),
      token.createCloseAccountInstruction(wsolAta, depositor, depositor),
    ];
  };

  it("deposit_via_buy_raydium: the wrap-buy-unwrap flow fits a single legacy transaction", async function () {
    const { relaunch, pool, oldMint } =
      await setupLiveRaydiumRelaunch.call(this);
    const depositor = Keypair.generate();
    await fundSol.call(this, depositor.publicKey, 5n * 10n ** 9n);

    const ixs = await wrapBuyUnwrapRaydiumIxs({
      relaunch,
      pool,
      oldMint,
      depositor: depositor.publicKey,
      payer: depositor.publicKey,
    });

    // No fee-recipient tail and no volume accumulator: unlike the pump
    // variant above, the Raydium buy fits the 1232-byte legacy limit without
    // the lookup table.
    const legacyTx = new Transaction().add(...ixs);
    legacyTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    legacyTx.feePayer = depositor.publicKey;
    legacyTx.sign(depositor);
    assert.isAtMost(legacyTx.serialize().length, 1232);
    await this.banksClient.processTransaction(legacyTx);

    const record = await client.getDepositRecord({
      relaunch,
      depositor: depositor.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    const { oldTokenVault } = await client.fetchRelaunch(relaunch);
    const vaultBalance = await tokenBalance(this.banksClient, oldTokenVault);
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());

    // The refund unwrapped: the WSOL ATA closed at the end of the flow.
    const wsolAta = token.getAssociatedTokenAddressSync(
      token.NATIVE_MINT,
      depositor.publicKey,
    );
    assert.isNull(await this.banksClient.getAccount(wsolAta));
  });

  it("deposit_via_buy_raydium: built as a v0 transaction against the extended table", async function () {
    const { relaunch, pool, oldMint } =
      await setupLiveRaydiumRelaunch.call(this);
    const depositor = Keypair.generate();
    await fundSol.call(this, depositor.publicKey, 5n * 10n ** 9n);

    // The extension that landed with the Raydium venue: both AMM v4 statics
    // are entries of the frozen table.
    const tableKeys = globalAlt.state.addresses.map((k) => k.toBase58());
    assert.include(tableKeys, RAYDIUM_AMM_PROGRAM_ID.toBase58());
    assert.include(tableKeys, RAYDIUM_AMM_AUTHORITY.toBase58());

    const ixs = await wrapBuyUnwrapRaydiumIxs({
      relaunch,
      pool,
      oldMint,
      depositor: depositor.publicKey,
      payer: depositor.publicKey,
    });
    const tx = await buildV0Tx({
      banksClient: this.banksClient,
      payerKey: depositor.publicKey,
      instructions: ixs,
      signers: [depositor],
      tables: [globalAlt],
    });
    assert.isAtMost(tx.serialize().length, 1232);

    // Both statics resolved through the table instead of riding as static
    // message keys.
    const staticKeys = tx.message.staticAccountKeys.map((k) => k.toBase58());
    assert.notInclude(staticKeys, RAYDIUM_AMM_PROGRAM_ID.toBase58());
    assert.notInclude(staticKeys, RAYDIUM_AMM_AUTHORITY.toBase58());

    await this.banksClient.processTransaction(tx);

    const record = await client.getDepositRecord({
      relaunch,
      depositor: depositor.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), BASE_OUT.toString());

    const { oldTokenVault } = await client.fetchRelaunch(relaunch);
    const vaultBalance = await tokenBalance(this.banksClient, oldTokenVault);
    assert.equal(vaultBalance.toString(), BASE_OUT.toString());
  });

  it("execute_sell: built as a v0 transaction with the ALT", async function () {
    const { relaunch, pool, oldMint } = await setupLiveRelaunch.call(this);
    // 100M tokens meets the 10% threshold, so closing lands in SellPending.
    const depositAmount = DEFAULT_OLD_SUPPLY / 10n;
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram: token.TOKEN_PROGRAM_ID,
        amount: new BN(depositAmount.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();

    // 90% of the constant-product output as the sell's slippage floor.
    const minQuoteOut =
      (((WSOL_POOL_QUOTE_RESERVE * depositAmount) /
        (POOL_BASE_RESERVE + depositAmount)) *
        90n) /
      100n;

    const ixs = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
      await client
        .executeSellIx({
          relaunch,
          oldMint,
          oldTokenProgram: token.TOKEN_PROGRAM_ID,
          sourceQuoteMint: pool.quoteMint,
          sourcePool: pool.pool,
          poolBaseTokenAccount: pool.poolBaseTokenAccount,
          poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
          coinCreator: pool.coinCreator,
          protocolFeeRecipient,
          buybackFeeRecipient,
          minQuoteOut: new BN(minQuoteOut.toString()),
        })
        .instruction(),
    ];

    // Unlike the deposit flows this leg is not size-blocked; the example
    // documents the assembly pattern, which applies unchanged to the other
    // one-shot legs (execute_usdc_swap, complete_relaunch).
    const tx = await buildV0Tx({
      banksClient: this.banksClient,
      payerKey: this.payer.publicKey,
      instructions: ixs,
      signers: [this.payer],
      tables: [globalAlt],
    });
    await this.banksClient.processTransaction(tx);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
    assert.isTrue(
      storedRelaunch.quoteRecovered.gte(new BN(minQuoteOut.toString())),
    );
  });
}
