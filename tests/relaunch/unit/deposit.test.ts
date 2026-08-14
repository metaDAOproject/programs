import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { BN } from "bn.js";
import { getDepositRecordAddr, RelaunchClient } from "@metadaoproject/programs";
import { getAccount } from "spl-token-bankrun";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

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
    { start = true }: { start?: boolean } = {},
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
      thresholdBps: 1000,
      teamAddress: this.payer.publicKey,
    });

    if (start) {
      await client.startDepositsIx({ relaunch }).rpc();
    }

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

  beforeEach(async function () {
    ({
      oldMint,
      oldTokenProgram,
      payerOldTokenAccount,
      relaunch,
      oldTokenVault,
    } = await setupLiveRelaunch.call(this));
  });

  it("deposits old tokens", async function () {
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(100_000_000), // 100 tokens
      })
      .rpc();

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "100000000");
    assert.equal(storedRelaunch.seqNum.toString(), "2");

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.isTrue(record.relaunch.equals(relaunch));
    assert.isTrue(record.depositor.equals(this.payer.publicKey));
    assert.equal(record.amountDeposited.toString(), "100000000");
    assert.isFalse(record.claimed);
    assert.equal(record.seqNum.toString(), "0");
    const [, recordBump] = getDepositRecordAddr({
      programId: client.getProgramId(),
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.pdaBump, recordBump);

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "100000000");

    const depositorAccount = await getAccount(
      this.banksClient,
      payerOldTokenAccount,
    );
    assert.equal(
      depositorAccount.amount.toString(),
      (DEFAULT_OLD_SUPPLY - 100_000_000n).toString(),
    );
  });

  it("deposits old tokens under Token-2022", async function () {
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

    const storedRelaunch = await client.fetchRelaunch(setup.relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "100000000");

    const record = await client.getDepositRecord({
      relaunch: setup.relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), "100000000");

    const vault = await getAccount(
      this.banksClient,
      setup.oldTokenVault,
      undefined,
      token.TOKEN_2022_PROGRAM_ID,
    );
    assert.equal(vault.amount.toString(), "100000000");
  });

  it("accumulates repeat deposits in the same record", async function () {
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(100_000_000),
      })
      .rpc();
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(200_000_000),
      })
      .rpc();

    const record = await client.getDepositRecord({
      relaunch,
      depositor: this.payer.publicKey,
    });
    assert.equal(record.amountDeposited.toString(), "300000000");
    assert.equal(record.seqNum.toString(), "1");

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "300000000");
    assert.equal(storedRelaunch.seqNum.toString(), "3");

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "300000000");
  });

  it("tracks multiple depositors independently", async function () {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    await fundDepositor.call(this, alice.publicKey, 1_000_000_000n);
    await fundDepositor.call(this, bob.publicKey, 1_000_000_000n);

    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(100_000_000),
        depositor: alice.publicKey,
      })
      .signers([alice])
      .rpc();
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(200_000_000),
        depositor: bob.publicKey,
      })
      .signers([bob])
      .rpc();

    const aliceRecord = await client.getDepositRecord({
      relaunch,
      depositor: alice.publicKey,
    });
    assert.isTrue(aliceRecord.depositor.equals(alice.publicKey));
    assert.equal(aliceRecord.amountDeposited.toString(), "100000000");

    const bobRecord = await client.getDepositRecord({
      relaunch,
      depositor: bob.publicKey,
    });
    assert.isTrue(bobRecord.depositor.equals(bob.publicKey));
    assert.equal(bobRecord.amountDeposited.toString(), "200000000");

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "300000000");

    const vault = await getAccount(this.banksClient, oldTokenVault);
    assert.equal(vault.amount.toString(), "300000000");
  });

  it("fails to deposit zero tokens", async function () {
    try {
      await client
        .depositIx({ relaunch, oldMint, oldTokenProgram, amount: new BN(0) })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidAmount");
    }
  });

  it("fails when the depositor balance is insufficient", async function () {
    const depositor = Keypair.generate();
    await fundDepositor.call(this, depositor.publicKey, 100_000_000n);

    try {
      await client
        .depositIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          amount: new BN(100_000_001),
          depositor: depositor.publicKey,
        })
        .signers([depositor])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InsufficientFunds");
    }

    const depositRecord = client.getDepositRecordAddress({
      relaunch,
      depositor: depositor.publicKey,
    });
    assert.isNull(await this.banksClient.getAccount(depositRecord));
  });

  it("fails before deposits start", async function () {
    const setup = await setupLiveRelaunch.call(this, token.TOKEN_PROGRAM_ID, {
      start: false,
    });

    try {
      await client
        .depositIx({
          relaunch: setup.relaunch,
          oldMint: setup.oldMint,
          oldTokenProgram: token.TOKEN_PROGRAM_ID,
          amount: new BN(100_000_000),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotLive");
    }
  });

  it("fails after the deposit window closes", async function () {
    await this.advanceBySeconds(ONE_WEEK - 10);
    await client
      .depositIx({
        relaunch,
        oldMint,
        oldTokenProgram,
        amount: new BN(100_000_000),
      })
      .rpc();

    await this.advanceBySeconds(10);
    try {
      await client
        .depositIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          amount: new BN(200_000_000),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "DepositWindowClosed");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.equal(storedRelaunch.totalDeposited.toString(), "100000000");
  });

  it("fails with the wrong old-token program", async function () {
    // The vault ATA re-derived under the wrong token program is an address
    // that doesn't exist, so deserialization fails before the has_one check.
    try {
      await client
        .depositIx({
          relaunch,
          oldMint,
          oldTokenProgram: token.TOKEN_2022_PROGRAM_ID,
          amount: new BN(100_000_000),
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails when the destination is not the old token vault", async function () {
    try {
      await client
        .depositIx({
          relaunch,
          oldMint,
          oldTokenProgram,
          amount: new BN(100_000_000),
        })
        .accounts({ oldTokenVault: payerOldTokenAccount })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintHasOne");
    }
  });
}
