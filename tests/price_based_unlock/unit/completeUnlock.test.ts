import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import { PriceBasedTokenLockClient } from "@metadaoproject/futarchy/v0.6";
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
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority.publicKey);
    recipientTokenAccount = token.getAssociatedTokenAddressSync(tokenMint, recipient.publicKey, true);
    
    // Create the recipient token account
    await this.createTokenAccount(tokenMint, recipient.publicKey);

    // Mint some tokens to the authority
    await this.mintTo(tokenMint, tokenAuthority.publicKey, tokenAuthority, 1000000);

    // Fund the create key, recipient, and locker authority
    await this.transfer(
      tokenMint,
      this.payer,
      createKey.publicKey,
      1000000000
    );
    await this.transfer(
      tokenMint,
      this.payer,
      recipient.publicKey,
      1000000000
    );
    await this.transfer(
      tokenMint,
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
    lockerTokenAccount = token.getAssociatedTokenAddressSync(tokenMint, locker, true);
    
    // Create the locker token account (PDA)
    const createLockerTokenAccountIx = token.createAssociatedTokenAccountInstruction(
      this.payer.publicKey,
      lockerTokenAccount,
      locker,
      tokenMint
    );
    const createLockerTx = new Transaction().add(createLockerTokenAccountIx);
    createLockerTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    createLockerTx.feePayer = this.payer.publicKey;
    createLockerTx.sign(this.payer);
    await this.banksClient.processTransaction(createLockerTx);
  });

  it("should complete unlock successfully when price threshold is met", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) + 1),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(5), // 5 seconds for faster testing
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await priceBasedUnlock.initializeLocker({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      tokenAccount,
      tokenAuthority: tokenAuthority.publicKey,
      lockerTokenAccount,
      recipientTokenAccount,
      payer: this.payer.publicKey,
    });

    await this.banksClient.processTransaction(initTx);

    // Advance time and start unlock
    await this.advanceBySeconds(2);
    
    // Set initial oracle data
    const initialOracleData = new Uint8Array(32);
    const initialAggregatorValue = new BN(1000000); // 1.0
    initialOracleData.set(new Uint8Array(initialAggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, initialOracleData);

    const startTx = await priceBasedUnlock.startUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
    });

    await this.banksClient.processTransaction(startTx);

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(6);

    // Set final oracle data with higher price (meets threshold)
    const finalOracleData = new Uint8Array(32);
    const finalAggregatorValue = new BN(6000000); // 6.0
    finalOracleData.set(new Uint8Array(finalAggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, finalOracleData);

    // Complete unlock
    const completeTx = await priceBasedUnlock.completeUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
      lockerTokenAccount,
      recipientTokenAccount,
    });

    await this.banksClient.processTransaction(completeTx);

    // Verify locker state changed to Unlocked
    const lockerAccount = await priceBasedUnlock.getLocker(locker);
    assert(lockerAccount.state.unlocked !== undefined);

    // Verify tokens were transferred to recipient
    const recipientBalance = await this.getTokenBalance(tokenMint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "100000");

    // Verify locker token account is empty
    const lockerBalance = await this.getTokenBalance(tokenMint, locker);
    assert.equal(lockerBalance.toString(), "0");
  });

  it("should fail if locker is not in Unlocking state", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(this.context.clock.unixTimestamp + 1),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await priceBasedUnlock.initializeLocker({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      tokenAccount,
      tokenAuthority: tokenAuthority.publicKey,
      lockerTokenAccount,
      recipientTokenAccount,
      payer: this.payer.publicKey,
    });

    await this.banksClient.processTransaction(initTx);

    // Try to complete unlock before starting it
    try {
      const completeTx = await priceBasedUnlock.completeUnlock({
        locker,
        lockerAuthority: lockerAuthority.publicKey,
        oracleAccount: oracleAccount.publicKey,
        lockerTokenAccount,
        recipientTokenAccount,
      });

      await this.banksClient.processTransaction(completeTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidLockerState");
    }
  });

  it("should fail if TWAP calculation period has not elapsed", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(this.context.clock.unixTimestamp + 1),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(10), // 10 seconds
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await priceBasedUnlock.initializeLocker({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      tokenAccount,
      tokenAuthority: tokenAuthority.publicKey,
      lockerTokenAccount,
      recipientTokenAccount,
      payer: this.payer.publicKey,
    });

    await this.banksClient.processTransaction(initTx);

    // Advance time and start unlock
    await this.advanceBySeconds(2);
    
    const initialOracleData = new Uint8Array(32);
    const initialAggregatorValue = new BN(1000000);
    initialOracleData.set(new Uint8Array(initialAggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, initialOracleData);

    const startTx = await priceBasedUnlock.startUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
    });

    await this.banksClient.processTransaction(startTx);

    // Try to complete unlock before TWAP period elapses
    await this.advanceBySeconds(5); // Only 5 seconds, need 10

    try {
      const completeTx = await priceBasedUnlock.completeUnlock({
        locker,
        lockerAuthority: lockerAuthority.publicKey,
        oracleAccount: oracleAccount.publicKey,
        lockerTokenAccount,
        recipientTokenAccount,
      });

      await this.banksClient.processTransaction(completeTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "TwapCalculationFailed");
    }
  });

  it("should fail if price threshold is not met", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(this.context.clock.unixTimestamp + 1),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await priceBasedUnlock.initializeLocker({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      tokenAccount,
      tokenAuthority: tokenAuthority.publicKey,
      lockerTokenAccount,
      recipientTokenAccount,
      payer: this.payer.publicKey,
    });

    await this.banksClient.processTransaction(initTx);

    // Advance time and start unlock
    await this.advanceBySeconds(2);
    
    const initialOracleData = new Uint8Array(32);
    const initialAggregatorValue = 1000000n; // 1.0
    initialOracleData.set(new Uint8Array(initialAggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, initialOracleData);

    const startTx = await priceBasedUnlock.startUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
    });

    await this.banksClient.processTransaction(startTx);

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(6);

    // Set final oracle data with lower price (doesn't meet threshold)
    const finalOracleData = new Uint8Array(32);
    const finalAggregatorValue = new BN(500000); // 0.5 (below 1.0 threshold)
    finalOracleData.set(new Uint8Array(finalAggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, finalOracleData);

    // Try to complete unlock
    try {
      const completeTx = await priceBasedUnlock.completeUnlock({
        locker,
        lockerAuthority: lockerAuthority.publicKey,
        oracleAccount: oracleAccount.publicKey,
        lockerTokenAccount,
        recipientTokenAccount,
      });

      await this.banksClient.processTransaction(completeTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "PriceThresholdNotMet");
    }
  });
}
