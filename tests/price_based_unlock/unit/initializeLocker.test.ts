import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { mintTo } from "spl-token-bankrun";
import BN from "bn.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: Keypair;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let locker: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = Keypair.generate();
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();

    // Create token mint
    tokenMint = await this.createMint(tokenAuthority.publicKey, 6);

    // Create token account
    tokenAccount = await this.createTokenAccount(
      tokenMint,
      tokenAuthority.publicKey
    );

    // Mint some tokens to the token account
    await mintTo(
      this.context.banksClient,
      this.payer,
      tokenMint,
      tokenAccount,
      tokenAuthority,
      1000000
    );

    // Derive PDA for locker
    const [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), createKey.publicKey.toBuffer()],
      this.priceBasedUnlock.programId
    );
    locker = lockerPda;
  });

  it("should initialize a locker successfully", async function () {
    const params = {
      priceThreshold: new BN(1000000), // 1.0 with 6 decimals
      tokenAmount: new BN(100000), // 0.1 tokens
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ), // 1 hour from now
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300), // 5 minutes
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
    };

    const tx = await this.priceBasedUnlock
      .initializeLockerIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        fromTokenAccount: tokenAccount,
        tokenAuthority: tokenAuthority.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    tx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    tx.sign(createKey, this.payer, tokenAuthority);
    await this.banksClient.processTransaction(tx);

    // Verify locker was created
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerAccount.priceThreshold.toString(), "1000000");
    assert.equal(lockerAccount.tokenAmount.toString(), "100000");
    assert.equal(
      lockerAccount.unlockTimestamp.toString(),
      params.unlockTimestamp.toString()
    );
    assert.equal(
      lockerAccount.oracleConfig.oracleAccount.toString(),
      oracleAccount.publicKey.toString()
    );
    assert.equal(lockerAccount.oracleConfig.byteOffset, 0);
    assert.equal(lockerAccount.twapLengthSeconds.toString(), "300");
    assert.equal(
      lockerAccount.tokenRecipient.toString(),
      recipient.publicKey.toString()
    );
    assert.equal(
      lockerAccount.lockerAuthority.toString(),
      this.payer.publicKey.toString()
    );
    assert.exists(lockerAccount.state.locked);

    // Verify tokens were transferred
    const lockerBalance = await this.getTokenBalance(tokenMint, locker);
    assert.equal(lockerBalance.toString(), "100000");

    const authorityBalance = await this.getTokenBalance(
      tokenMint,
      tokenAuthority.publicKey
    );
    assert.equal(authorityBalance.toString(), "900000"); // 1000000 - 100000
  });

  it("should fail if unlock timestamp is in the past", async function () {
    const pastCreateKey = Keypair.generate();
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) - 3600
      ), // 1 hour ago
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
    };

    try {
      const tx = await this.priceBasedUnlock
        .initializeLockerIx({
          params,
          createKey: pastCreateKey.publicKey,
          tokenMint,
          fromTokenAccount: tokenAccount,
          tokenAuthority: tokenAuthority.publicKey,
          payer: this.payer.publicKey,
        })
        .transaction();

      tx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      tx.sign(pastCreateKey, this.payer, tokenAuthority);
      await this.banksClient.processTransaction(tx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "UnlockTimestampInPast");
    }
  });

  it("should fail if token amount is zero", async function () {
    const zeroCreateKey = Keypair.generate();
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(0),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
    };

    try {
      const tx = await this.priceBasedUnlock
        .initializeLockerIx({
          params,
          createKey: zeroCreateKey.publicKey,
          tokenMint,
          fromTokenAccount: tokenAccount,
          tokenAuthority: tokenAuthority.publicKey,
          payer: this.payer.publicKey,
        })
        .transaction();

      tx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      tx.sign(zeroCreateKey, this.payer, tokenAuthority);
      await this.banksClient.processTransaction(tx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message, "TokenAmountZero");
    }
  });
}
