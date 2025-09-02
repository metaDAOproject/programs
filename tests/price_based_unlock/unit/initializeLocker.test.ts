import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import { mintTo } from "spl-token-bankrun";
import { PriceBasedTokenLockClient } from "@metadaoproject/futarchy/v0.6";
import BN from "bn.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: PublicKey;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let recipientTokenAccount: PublicKey;
  let locker: PublicKey;
  let lockerTokenAccount: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = this.payer.publicKey;
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();

    // Create token mint
    tokenMint = await this.createMint(tokenAuthority, 6);

    // Create token accounts
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority);
    recipientTokenAccount = await this.createTokenAccount(tokenMint, recipient.publicKey);

    // Mint some tokens to the token account
    await mintTo(
      this.context.banksClient,
      this.payer,
      tokenMint,
      tokenAccount,
      this.payer,
      1000000
    );



    // Derive PDA for locker
    const [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), createKey.publicKey.toBuffer()],
      this.priceBasedUnlock.programId
    );
    locker = lockerPda;

    // Derive associated token account for locker
    lockerTokenAccount = token.getAssociatedTokenAddressSync(tokenMint, locker, true);
  });

  it("should initialize a locker successfully", async function () {
    const params = {
      priceThreshold: new BN(1000000), // 1.0 with 6 decimals
      tokenAmount: new BN(100000), // 0.1 tokens
      unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600), // 1 hour from now
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300), // 5 minutes
      tokenRecipient: recipient.publicKey,
    };

    const tx = await this.priceBasedUnlock.initializeLocker({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      tokenAccount,
      tokenAuthority: tokenAuthority,
      lockerTokenAccount,
      recipientTokenAccount,
      payer: this.payer.publicKey,
    });

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(createKey, this.payer);
    await this.banksClient.processTransaction(tx);

    // Verify locker was created
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerAccount.priceThreshold.toString(), "1000000");
    assert.equal(lockerAccount.tokenAmount.toString(), "100000");
    assert.equal(lockerAccount.unlockTimestamp.toString(), params.unlockTimestamp.toString());
    assert.equal(lockerAccount.oracleAccount.toString(), oracleAccount.publicKey.toString());
    assert.equal(lockerAccount.aggregatorByteOffset, 0);
    assert.equal(lockerAccount.twapLengthSeconds.toString(), "300");
    assert.equal(lockerAccount.tokenRecipient.toString(), recipient.publicKey.toString());
    assert.equal(lockerAccount.state.locked, undefined);

    // Verify tokens were transferred
    const lockerBalance = await this.getTokenBalance(tokenMint, locker);
    assert.equal(lockerBalance.toString(), "100000");

    const authorityBalance = await this.getTokenBalance(tokenMint, tokenAuthority.publicKey);
    assert.equal(authorityBalance.toString(), "900000"); // 1000000 - 100000
  });

  it("should fail if unlock timestamp is in the past", async function () {
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) - 3600), // 1 hour ago
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    try {
      const tx = await this.priceBasedUnlock.initializeLocker({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        tokenAccount,
        tokenAuthority: tokenAuthority,
        lockerTokenAccount,
        recipientTokenAccount,
        payer: this.payer.publicKey,
      });

      tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      tx.sign(createKey, this.payer);
      await this.banksClient.processTransaction(tx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "UnlockTimestampNotReached");
    }
  });

  it("should fail if token amount is zero", async function () {
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(0),
      unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600),
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    try {
      const tx = await this.priceBasedUnlock.initializeLocker({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        tokenAccount,
        tokenAuthority: tokenAuthority,
        lockerTokenAccount,
        recipientTokenAccount,
        payer: this.payer.publicKey,
      });

      tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      tx.sign(createKey, this.payer);
      await this.banksClient.processTransaction(tx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "InvalidOracleData");
    }
  });
}
