import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { MAINNET_USDC, RelaunchClient } from "@metadaoproject/programs";
import { getAccount } from "spl-token-bankrun";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const TOKENS_TO_DEPOSITORS = 10_000_000n * 10n ** 6n;

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

// 10% of the 1B-token default supply = 100M tokens.
const DEFAULT_THRESHOLD_BPS = 1000;
const DEFAULT_THRESHOLD_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

export default function suite() {
  let client: RelaunchClient;
  let oldMint: PublicKey;
  let oldTokenProgram: PublicKey;
  let payerOldTokenAccount: PublicKey;
  let relaunch: PublicKey;
  let newMint: PublicKey;

  before(function () {
    client = this.relaunch;
  });

  // Initializes a Live relaunch on a USDC-quoted source pool, so the sell
  // leg lands directly in Swapped and completion needs no whirlpool swap.
  const setupLiveRelaunch = async function (
    this: Mocha.Context,
    thresholdBps: number = DEFAULT_THRESHOLD_BPS,
  ) {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint: MAINNET_USDC,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: USDC_POOL_QUOTE_RESERVE,
      baseTokenProgram: setup.oldTokenProgram,
    });

    ({ oldMint, oldTokenProgram, payerOldTokenAccount } = setup);
    ({ relaunch, newMint } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: MAINNET_USDC,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps,
      teamAddress: this.payer.publicKey,
    }));

    await client.startDepositsIx({ relaunch }).rpc();
  };

  // Creates the depositor's ATA and funds it with old tokens from the payer.
  const fundDepositor = async function (
    this: Mocha.Context,
    depositor: PublicKey,
    amount: bigint,
  ): Promise<PublicKey> {
    const ata = token.getAssociatedTokenAddressSync(
      oldMint,
      depositor,
      false,
      oldTokenProgram,
    );
    const tx = new Transaction().add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        ata,
        depositor,
        oldMint,
        oldTokenProgram,
      ),
      token.createTransferCheckedInstruction(
        payerOldTokenAccount,
        oldMint,
        ata,
        this.payer.publicKey,
        amount,
        6,
        [],
        oldTokenProgram,
      ),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);
    await this.banksClient.processTransaction(tx);
    return ata;
  };

  const deposit = async function (
    this: Mocha.Context,
    amount: bigint,
    depositor?: Keypair,
  ) {
    const builder = client.depositIx({
      relaunch,
      oldMint,
      oldTokenProgram,
      amount: new BN(amount.toString()),
      depositor: depositor?.publicKey,
    });
    if (depositor !== undefined) {
      builder.signers([depositor]);
    }
    await builder.rpc();
  };

  const closeDeposits = async function (this: Mocha.Context) {
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
  };

  const sellAndComplete = async function (this: Mocha.Context) {
    await closeDeposits.call(this);
    await client.executeSell({ relaunch });
    await client.completeRelaunch({ relaunch });
  };

  const newTokenBalance = async function (
    this: Mocha.Context,
    owner: PublicKey,
  ): Promise<bigint> {
    const account = await getAccount(
      this.banksClient,
      token.getAssociatedTokenAddressSync(newMint, owner),
    );
    return account.amount;
  };

  it("distributes the depositor bucket pro-rata across depositors", async function () {
    await setupLiveRelaunch.call(this);
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await fundDepositor.call(this, alice.publicKey, 25_000_000_000_000n);
    await fundDepositor.call(this, bob.publicKey, 75_000_000_000_000n);

    await deposit.call(this, 25_000_000_000_000n, alice); // 25M tokens
    await deposit.call(this, 75_000_000_000_000n, bob); // 75M tokens
    await deposit.call(this, 100_000_000_000_000n); // 100M tokens
    await sellAndComplete.call(this);

    // The depositor never signs — the provider wallet cranks alice's and
    // bob's claims.
    await client
      .claimIx({ relaunch, newMint, depositor: alice.publicKey })
      .rpc();
    await client.claimIx({ relaunch, newMint, depositor: bob.publicKey }).rpc();
    await client.claimIx({ relaunch, newMint }).rpc();

    // 10M × 25/200, 10M × 75/200, 10M × 100/200.
    assert.equal(
      (await newTokenBalance.call(this, alice.publicKey)).toString(),
      "1250000000000",
    );
    assert.equal(
      (await newTokenBalance.call(this, bob.publicKey)).toString(),
      "3750000000000",
    );
    assert.equal(
      (await newTokenBalance.call(this, this.payer.publicKey)).toString(),
      "5000000000000",
    );

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.claimed);
    assert.equal(record.seqNum.toString(), "1");

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.seqNum.toString(), "10");

    // The shares divide evenly, so the vault empties completely.
    const vault = await getAccount(
      this.banksClient,
      storedRelaunch.newTokenVault,
    );
    assert.equal(vault.amount.toString(), "0");
  });

  it("floors each entitlement and strands the dust in the vault", async function () {
    await setupLiveRelaunch.call(this);
    const alice = Keypair.generate();
    await fundDepositor.call(this, alice.publicKey, 100_000_000_000_000n);

    const aliceDeposit = 100_000_000_000_000n; // 100M tokens
    const payerDeposit = 200_000_000_000_000n; // 200M tokens
    const total = aliceDeposit + payerDeposit;
    await deposit.call(this, aliceDeposit, alice);
    await deposit.call(this, payerDeposit);
    await sellAndComplete.call(this);

    await client
      .claimIx({ relaunch, newMint, depositor: alice.publicKey })
      .rpc();
    await client.claimIx({ relaunch, newMint }).rpc();

    const aliceClaimed = await newTokenBalance.call(this, alice.publicKey);
    const payerClaimed = await newTokenBalance.call(this, this.payer.publicKey);
    assert.equal(
      aliceClaimed.toString(),
      ((TOKENS_TO_DEPOSITORS * aliceDeposit) / total).toString(),
    );
    assert.equal(
      payerClaimed.toString(),
      ((TOKENS_TO_DEPOSITORS * payerDeposit) / total).toString(),
    );

    // Both thirds floor, so exactly one raw unit of dust stays behind.
    assert.isTrue(aliceClaimed + payerClaimed <= TOKENS_TO_DEPOSITORS);
    const storedRelaunch = await client.fetchRelaunch(relaunch);
    const vault = await getAccount(
      this.banksClient,
      storedRelaunch.newTokenVault,
    );
    assert.equal(vault.amount.toString(), "1");
    assert.equal(
      (aliceClaimed + payerClaimed + vault.amount).toString(),
      TOKENS_TO_DEPOSITORS.toString(),
    );
  });

  it("claims identically for a depositor who entered via deposit_via_buy", async function () {
    // 1 bps of the 1B supply = 100k tokens, reachable with a 50k-token buy
    // off the 1M-token pool.
    await setupLiveRelaunch.call(this, 1);
    const alice = Keypair.generate();
    await fundDepositor.call(this, alice.publicKey, 50_000_000_000n);

    await deposit.call(this, 50_000_000_000n, alice); // 50k tokens
    await client.depositViaBuy({
      relaunch,
      baseOut: new BN(50_000_000_000), // 50k tokens
    });
    await sellAndComplete.call(this);

    await client
      .claimIx({ relaunch, newMint, depositor: alice.publicKey })
      .rpc();
    await client.claimIx({ relaunch, newMint }).rpc();

    // Equal deposits, equal shares: 10M × 50k/100k each.
    const aliceClaimed = await newTokenBalance.call(this, alice.publicKey);
    const payerClaimed = await newTokenBalance.call(this, this.payer.publicKey);
    assert.equal(aliceClaimed.toString(), "5000000000000");
    assert.equal(payerClaimed.toString(), aliceClaimed.toString());
  });

  it("fails to claim the same record twice", async function () {
    await setupLiveRelaunch.call(this);
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await sellAndComplete.call(this);

    await client.claimIx({ relaunch, newMint }).rpc();

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first claim.
      await client
        .claimIx({ relaunch, newMint })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AlreadyClaimed");
    }

    assert.equal(
      (await newTokenBalance.call(this, this.payer.publicKey)).toString(),
      TOKENS_TO_DEPOSITORS.toString(),
    );
  });

  it("fails without a deposit record", async function () {
    await setupLiveRelaunch.call(this);
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await sellAndComplete.call(this);

    const rando = Keypair.generate();
    try {
      await client
        .claimIx({ relaunch, newMint, depositor: rando.publicKey })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails before the relaunch completes", async function () {
    await setupLiveRelaunch.call(this);
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await closeDeposits.call(this);
    await client.executeSell({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.swapped);

    try {
      await client.claimIx({ relaunch, newMint }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotComplete");
    }
  });

  it("fails for a failed relaunch", async function () {
    await setupLiveRelaunch.call(this);
    // Half the threshold, so closing lands in Failed.
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT / 2n);
    await closeDeposits.call(this);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);

    try {
      await client.claimIx({ relaunch, newMint }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotComplete");
    }
  });
}
