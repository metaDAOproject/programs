import { PublicKey, Keypair, Transaction, SystemProgram, TransactionInstruction, ComputeBudgetInstruction, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import BN from "bn.js";
import { getPerformancePackageAddr } from "@metadaoproject/futarchy/v0.6";
import { expectError } from "../../utils.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: Keypair;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let recipientTokenAccount: PublicKey;
  let performancePackage: PublicKey;
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

    // Fund accounts with SOL using SystemProgram
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: createKey.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: tokenAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: recipient.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: lockerAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);
  });

  beforeEach(async function () {
    performancePackage = getPerformancePackageAddr({
      createKey: createKey.publicKey,
    })[0];

    // Derive associated token account for locker
    lockerTokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      performancePackage,
      true
    );
  });

  it("should start unlock successfully when timestamp is reached", async function () {
    // First initialize the locker
    const params = {
      tranches: [
        {
          priceThreshold: new BN(1000000),
          tokenAmount: new BN(100000),
        }
      ],
      grantee: recipient.publicKey,
      performancePackageAuthority: lockerAuthority.publicKey,
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

    await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        grantor: tokenAuthority.publicKey,
      })
      .signers([createKey, tokenAuthority])
      .rpc();

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
      owner: this.priceBasedPerformancePackage.programId,
      lamports: 1000000000,
      data: oracleData,
    });

    // Start unlock
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();


    // Verify locker state changed to Unlocking
    const lockerAccount = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
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
    
    // Fund the futureCreateKey with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: futureCreateKey.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);
    
    const params = {
      // priceThreshold: new BN(1000000),
      // tokenAmount: new BN(100000),
      tranches: [
        {
          priceThreshold: new BN(1000000),
          tokenAmount: new BN(100000),
        }
      ],
      grantee: recipient.publicKey,
      performancePackageAuthority: lockerAuthority.publicKey,
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

    await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: futureCreateKey.publicKey,
        tokenMint,
        grantor: tokenAuthority.publicKey,
      })
      .signers([futureCreateKey, tokenAuthority])
      .rpc();

    // initTx.recentBlockhash = (
    //   await this.context.banksClient.getLatestBlockhash()
    // )[0];
    // initTx.sign(futureCreateKey, this.payer, tokenAuthority);
    // await this.banksClient.processTransaction(initTx);

    const futureLocker = getPerformancePackageAddr({
        createKey: futureCreateKey.publicKey
    })[0];

    const callbacks = expectError("UnlockTimestampNotReached", "Unlock timestamp has not been reached yet");
    // Try to start unlock before timestamp
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage: futureLocker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    //   // startTx.recentBlockhash = (
    //   //   await this.context.banksClient.getLatestBlockhash()
    //   // )[0];
    //   // startTx.sign(recipient);
    //   // await this.banksClient.processTransaction(startTx);
    //   assert.fail("Expected transaction to fail");
    // } catch (error) {
    //   assert.include(error.message, "0x1770");
    // }
  });

  it("should fail if locker is not in Locked state", async function () {
    // Initialize locker
    const doubleCreateKey = Keypair.generate();
    
    // Fund the doubleCreateKey with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: doubleCreateKey.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);
    
    const params = {
      tranches: [
        {
          priceThreshold: new BN(1000000),
          tokenAmount: new BN(100000),
        }
      ],
      grantee: recipient.publicKey,
      performancePackageAuthority: lockerAuthority.publicKey,
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

    const initTx = await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: doubleCreateKey.publicKey,
        tokenMint,
        grantor: tokenAuthority.publicKey,
      })
      .signers([doubleCreateKey, tokenAuthority])
      .rpc();

    const doubleLocker = getPerformancePackageAddr({
      createKey: doubleCreateKey.publicKey
    })[0];

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
      owner: this.priceBasedPerformancePackage.programId,
      lamports: 1000000000,
      data: oracleData,
    });

    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage: doubleLocker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();


    // Advance time slightly to make the next transaction different
    await this.advanceBySeconds(1);

    const callbacks = expectError("InvalidPerformancePackageState", "Performance package is not in the expected state");

    // Try to start unlock again (should fail)
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage: doubleLocker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 })
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
