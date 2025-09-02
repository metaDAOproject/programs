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

  it("should start unlock successfully when timestamp is reached", async function () {
    // First initialize the locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN((await this.context.banksClient.getClock()).unixTimestamp + 1), // 1 second from now
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await this.priceBasedUnlock.initializeLocker({
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

    // Advance time past unlock timestamp
    await this.advanceBySeconds(2);

    // Create mock oracle data with aggregator value
    const mockOracleData = new Uint8Array(32);
    const aggregatorValue = new BN(5000000); // 5.0
    mockOracleData.set(new Uint8Array(aggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);

    // Set oracle account data
    await this.banksClient.setAccountData(oracleAccount.publicKey, mockOracleData);

    // Start unlock
    const startTx = await this.priceBasedUnlock.startUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
    });

    await this.banksClient.processTransaction(startTx);

    // Verify locker state changed to Unlocking
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert(lockerAccount.state.unlocking !== undefined);
    if (lockerAccount.state.unlocking) {
      assert.equal(lockerAccount.state.unlocking.startAggregator.toString(), "5000000");
      assert(lockerAccount.state.unlocking.startTimestamp > 0);
    }
  });

  it("should fail if unlock timestamp has not been reached", async function () {
    // Initialize locker with future timestamp
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN((await this.context.banksClient.getClock()).unixTimestamp + 3600), // 1 hour from now
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await this.priceBasedUnlock.initializeLocker({
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

    // Try to start unlock before timestamp
    try {
      const startTx = await this.priceBasedUnlock.startUnlock({
        locker,
        lockerAuthority: lockerAuthority.publicKey,
        oracleAccount: oracleAccount.publicKey,
      });

      await this.banksClient.processTransaction(startTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "UnlockTimestampNotReached");
    }
  });

  it("should fail if locker is not in Locked state", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN((await this.context.banksClient.getClock()).unixTimestamp + 1),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    const initTx = await this.priceBasedUnlock.initializeLocker({
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
    
    const mockOracleData = new Uint8Array(32);
    const aggregatorValue = new BN(5000000);
    mockOracleData.set(new Uint8Array(aggregatorValue.toString(16).padStart(32, '0').match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []), 0);
    await this.banksClient.setAccountData(oracleAccount.publicKey, mockOracleData);

    const startTx = await this.priceBasedUnlock.startUnlock({
      locker,
      lockerAuthority: lockerAuthority.publicKey,
      oracleAccount: oracleAccount.publicKey,
    });

    await this.banksClient.processTransaction(startTx);

    // Try to start unlock again (should fail)
    try {
      const startTx2 = await this.priceBasedUnlock.startUnlock({
        locker,
        lockerAuthority: lockerAuthority.publicKey,
        oracleAccount: oracleAccount.publicKey,
      });

      await this.banksClient.processTransaction(startTx2);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidLockerState");
    }
  });
}
