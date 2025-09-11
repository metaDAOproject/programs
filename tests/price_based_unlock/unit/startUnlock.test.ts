import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import { MAINNET_USDC } from "@metadaoproject/futarchy/v0.6";
import BN from "bn.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: Keypair;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let recipientTokenAccount: PublicKey;
  let locker: PublicKey;
  let lockerTokenAccount: PublicKey;
  let oracleAccount: Keypair;
  let lockerAuthority: Keypair;

  before(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = Keypair.generate();
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    lockerAuthority = Keypair.generate();

    // Create token mint
    tokenMint = await this.createMint(tokenAuthority.publicKey, 6);

    // Create token accounts
    tokenAccount = await this.createTokenAccount(
      tokenMint,
      tokenAuthority.publicKey
    );
    recipientTokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey,
      true
    );

    // Create the recipient token account
    await this.createTokenAccount(tokenMint, recipient.publicKey);

    // Mint some tokens to the authority
    await this.mintTo(
      tokenMint,
      tokenAuthority.publicKey,
      tokenAuthority,
      1000000
    );

    // Fund the create key, recipient, and locker authority
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      createKey.publicKey,
      1000000000
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      recipient.publicKey,
      1000000000
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      lockerAuthority.publicKey,
      1000000000
    );
  });

  beforeEach(async function () {
    // Derive PDA for locker
    const [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), createKey.publicKey.toBuffer()],
      this.priceBasedUnlock.programId
    );
    locker = lockerPda;

    // Derive associated token account for locker
    lockerTokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      locker,
      true
    );
  });

  it("should start unlock successfully when timestamp is reached", async function () {
    // First initialize the locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ), // 1 second from now
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: lockerAuthority.publicKey,
    };

    const initTx = await this.priceBasedUnlock
      .initializeLockerIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        fromTokenAccount: tokenAccount,
        tokenAuthority: tokenAuthority.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    initTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    initTx.sign(createKey, this.payer, tokenAuthority);
    await this.banksClient.processTransaction(initTx);

    // Advance time past unlock timestamp
    await this.advanceBySeconds(2);

    // Create oracle data buffer (24 bytes: u128 + i64)
    const oracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 5000000
    oracleData.writeBigUInt64LE(BigInt(5000000), 0);
    oracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const currentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    oracleData.writeBigInt64LE(BigInt(currentTimestamp), 16);

    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: this.priceBasedUnlock.programId,
      lamports: 1000000000,
      data: oracleData,
    });

    // Start unlock
    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.sign(lockerAuthority, this.payer);
    await this.banksClient.processTransaction(startTx);

    // Verify locker state changed to Unlocking
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert(lockerAccount.state.unlocking !== undefined);
    if (lockerAccount.state.unlocking) {
      assert.equal(
        lockerAccount.state.unlocking.startAggregator.toString(),
        "5000000"
      );
      assert(lockerAccount.state.unlocking.startTimestamp.toNumber() > 0);
    }
  });

  it("should fail if unlock timestamp has not been reached", async function () {
    // Initialize locker with future timestamp
    const futureCreateKey = Keypair.generate();
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ), // 1 hour from now
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: lockerAuthority.publicKey,
    };

    const initTx = await this.priceBasedUnlock
      .initializeLockerIx({
        params,
        createKey: futureCreateKey.publicKey,
        tokenMint,
        fromTokenAccount: tokenAccount,
        tokenAuthority: tokenAuthority.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    initTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    initTx.sign(futureCreateKey, this.payer, tokenAuthority);
    await this.banksClient.processTransaction(initTx);

    const futureLocker = this.priceBasedUnlock.getLockerAddress(
      futureCreateKey.publicKey
    );

    // Try to start unlock before timestamp
    try {
      const startTx = await this.priceBasedUnlock
        .startUnlockIx({
          locker: futureLocker,
          oracleAccount: oracleAccount.publicKey,
        })
        .transaction();

      startTx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      startTx.sign(lockerAuthority, this.payer);
      await this.banksClient.processTransaction(startTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "UnlockTimestampNotReached");
    }
  });

  it("should fail if locker is not in Locked state", async function () {
    // Initialize locker
    const doubleCreateKey = Keypair.generate();
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: lockerAuthority.publicKey,
    };

    const initTx = await this.priceBasedUnlock
      .initializeLockerIx({
        params,
        createKey: doubleCreateKey.publicKey,
        tokenMint,
        fromTokenAccount: tokenAccount,
        tokenAuthority: tokenAuthority.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    initTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    initTx.sign(doubleCreateKey, this.payer, tokenAuthority);
    await this.banksClient.processTransaction(initTx);

    const doubleLocker = this.priceBasedUnlock.getLockerAddress(
      doubleCreateKey.publicKey
    );

    // Advance time and start unlock
    await this.advanceBySeconds(2);

    const oracleData = Buffer.alloc(24);
    oracleData.writeBigUInt64LE(BigInt(5000000), 0);
    oracleData.writeBigUInt64LE(BigInt(0), 8);
    const currentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    oracleData.writeBigInt64LE(BigInt(currentTimestamp), 16);

    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: this.priceBasedUnlock.programId,
      lamports: 1000000000,
      data: oracleData,
    });

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker: doubleLocker,
        oracleAccount: oracleAccount.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.sign(lockerAuthority, this.payer);
    await this.banksClient.processTransaction(startTx);

    // Try to start unlock again (should fail)
    try {
      const startTx2 = await this.priceBasedUnlock
        .startUnlockIx({
          locker: doubleLocker,
          oracleAccount: oracleAccount.publicKey,
        })
        .transaction();

      startTx2.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      startTx2.sign(lockerAuthority, this.payer);
      await this.banksClient.processTransaction(startTx2);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidLockerState");
    }
  });
}
