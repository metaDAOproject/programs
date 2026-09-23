import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { RelaunchClient } from "@metadaoproject/programs";
import { getAccount } from "spl-token-bankrun";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

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
  let oldTokenVault: PublicKey;

  before(function () {
    client = this.relaunch;
  });

  const setupLiveRelaunch = async function (
    this: Mocha.Context,
    tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
  ) {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
      oldTokenProgram: tokenProgram,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint: token.NATIVE_MINT,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: WSOL_POOL_QUOTE_RESERVE,
      baseTokenProgram: tokenProgram,
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
      thresholdBps: DEFAULT_THRESHOLD_BPS,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();

    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const oldTokenVault = token.getAssociatedTokenAddressSync(
      setup.oldMint,
      relaunchSigner,
      true,
      tokenProgram,
    );

    return { ...setup, relaunch, oldTokenVault };
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

  beforeEach(async function () {
    ({
      oldMint,
      oldTokenProgram,
      payerOldTokenAccount,
      relaunch,
      oldTokenVault,
    } = await setupLiveRelaunch.call(this));
  });

  it("refunds the exact accumulated deposit after a threshold miss", async function () {
    await deposit.call(this, 100_000_000n); // 100 tokens
    await deposit.call(this, 200_000_000n); // 200 tokens
    await closeDeposits.call(this);

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);

    await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.claimed);
    assert.equal(record.amountDeposited.toString(), "300000000");
    assert.equal(record.seqNum.toString(), "2");

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.seqNum.toString(), "5");

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "0");

    const depositorAccount = await getAccount(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      depositorAccount.amount.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
  });

  it("refunds under Token-2022", async function () {
    const setup = await setupLiveRelaunch.call(
      this,
      token.TOKEN_2022_PROGRAM_ID,
    );

    await client
      .depositIx({
        relaunch: setup.relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
        amount: new BN(100_000_000),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch: setup.relaunch }).rpc();

    await client
      .claimRefundIx({
        relaunch: setup.relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const record = await client.getDepositRecord({
      relaunch: setup.relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.claimed);

    const vault = await getAccount(
      this.banksClient,
      setup.oldTokenVault,
      undefined,
      token.TOKEN_2022_PROGRAM_ID,
    );
    assert.equal(vault.amount.toString(), "0");

    const depositorAccount = await getAccount(
      this.banksClient,
      setup.payerOldTokenAccount,
      undefined,
      token.TOKEN_2022_PROGRAM_ID,
    );
    assert.equal(
      depositorAccount.amount.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
  });

  it("refunds every depositor exactly and empties the vault", async function () {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const aliceAta = await fundDepositor.call(
      this,
      alice.publicKey,
      1_000_000_000n, // 1,000 tokens
    );
    const bobAta = await fundDepositor.call(
      this,
      bob.publicKey,
      1_000_000_000n,
    );

    await deposit.call(this, 100_000_000n, alice);
    await deposit.call(this, 200_000_000n, bob);
    await deposit.call(this, 300_000_000n);
    await closeDeposits.call(this);

    await client
      .claimRefundIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        depositor: alice.publicKey,
      })
      .rpc();
    await client
      .claimRefundIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        depositor: bob.publicKey,
      })
      .rpc();
    await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();

    const aliceAccount = await getAccount(this.banksClient, aliceAta);
    assert.equal(aliceAccount.amount.toString(), "1000000000");

    const bobAccount = await getAccount(this.banksClient, bobAta);
    assert.equal(bobAccount.amount.toString(), "1000000000");

    const payerAccount = await getAccount(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      payerAccount.amount.toString(),
      (DEFAULT_OLD_SUPPLY - 2_000_000_000n).toString(),
    );

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "0");
  });

  it("fails to refund the same record twice", async function () {
    await deposit.call(this, 100_000_000n);
    await closeDeposits.call(this);

    await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first claim.
      await client
        .claimRefundIx({ relaunch, oldMint, oldTokenProgram })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AlreadyClaimed");
    }

    const depositorAccount = await getAccount(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      depositorAccount.amount.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
  });

  it("fails without a deposit record", async function () {
    await deposit.call(this, 100_000_000n);
    await closeDeposits.call(this);

    const rando = Keypair.generate();
    await fundDepositor.call(this, rando.publicKey, 0n);

    try {
      await client
        .claimRefundIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          depositor: rando.publicKey,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails while the relaunch is Live", async function () {
    await deposit.call(this, 100_000_000n);

    try {
      await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotFailed");
    }
  });

  it("fails while the relaunch is SellPending", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await closeDeposits.call(this);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sellPending);

    try {
      await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotFailed");
    }
  });

  it("refunds after the grace period lapses and mark_failed cranks", async function () {
    await deposit.call(this, DEFAULT_THRESHOLD_AMOUNT);
    await closeDeposits.call(this);
    await this.advanceBySeconds(ONE_DAY + 1);
    await client.markFailedIx({ relaunch }).rpc();

    await client.claimRefundIx({ relaunch, oldMint, oldTokenProgram }).rpc();

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.claimed);

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "0");

    const depositorAccount = await getAccount(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      depositorAccount.amount.toString(),
      DEFAULT_OLD_SUPPLY.toString(),
    );
  });

  it("lets any keypair crank a refund for a depositor", async function () {
    const alice = Keypair.generate();
    const aliceAta = await fundDepositor.call(
      this,
      alice.publicKey,
      1_000_000_000n,
    );
    await deposit.call(this, 100_000_000n, alice);
    await closeDeposits.call(this);

    const cranker = Keypair.generate();
    const fund = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: cranker.publicKey,
        lamports: LAMPORTS_PER_SOL,
      }),
    );
    fund.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fund.feePayer = this.payer.publicKey;
    fund.sign(this.payer);
    await this.banksClient.processTransaction(fund);

    const tx = new Transaction().add(
      await client
        .claimRefundIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          depositor: alice.publicKey,
        })
        .instruction(),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = cranker.publicKey;
    tx.sign(cranker);
    await this.banksClient.processTransaction(tx);

    const aliceAccount = await getAccount(this.banksClient, aliceAta);
    assert.equal(aliceAccount.amount.toString(), "1000000000");

    const record = await client.getDepositRecord({
      relaunch,
      depositor: alice.publicKey,
    });
    assert.isTrue(record.claimed);
  });
}
