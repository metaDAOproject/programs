import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import BN from "bn.js";
import { getPerformancePackageAddr } from "@metadaoproject/futarchy-v2";
import { expectError } from "../../utils.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: Keypair;
  let recipient: Keypair;
  let performancePackage: PublicKey;
  let performancePackageTokenAccount: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    // Generate new keys for each test to avoid account conflicts
    createKey = Keypair.generate();
    recipient = Keypair.generate();
    // tokenAuthority = Keypair.generate();
    oracleAccount = Keypair.generate();

    tokenMint = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      200 * 10 ** 6,
    );

    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: oracleAccount.publicKey,
      recipient: recipient.publicKey,
    });
  });

  it("should unlock 100% of tokens when price meets threshold", async function () {
    // Advance time and start unlock
    await this.advanceBySeconds(2);

    // Set initial oracle data: 16 bytes aggregator (u128) + 8 bytes timestamp (i64)
    const initialOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 1000000
    initialOracleData.writeBigUInt64LE(BigInt(1e12), 0);
    initialOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const currentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    initialOracleData.writeBigInt64LE(BigInt(currentTimestamp), 16);
    this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: initialOracleData,
    });

    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(86_400);

    // Set final oracle data with higher price (meets threshold)
    const finalOracleData = Buffer.alloc(24);
    finalOracleData.writeBigUInt64LE(BigInt((2 * 86_400 + 1) * 1e12), 0);
    finalOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const finalTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    finalOracleData.writeBigInt64LE(BigInt(finalTimestamp), 16);
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: finalOracleData,
    });

    // Complete unlock
    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      })
      .rpc();

    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(200 * 10 ** 6),
      "Recipient should have 100000 tokens",
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      0n,
      "PerformancePackage token account should be empty",
    );

    for (const tranche of performancePackageAccount.tranches) {
      assert.equal(tranche.isUnlocked, true, "Tranche should be unlocked");
    }

    assert.exists(
      performancePackageAccount.state.locked,
      "PerformancePackage should be in Locked state",
    );
  });

  it("should unlock the first tranche when the price meets that threshold", async function () {
    // Advance time and start unlock
    await this.advanceBySeconds(2);

    // Set initial oracle data: 16 bytes aggregator (u128) + 8 bytes timestamp (i64)
    const initialOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 1000000
    initialOracleData.writeBigUInt64LE(BigInt(1e12), 0);
    initialOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const currentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    initialOracleData.writeBigInt64LE(BigInt(currentTimestamp), 16);
    this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: initialOracleData,
    });

    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(86_400);

    // Set final oracle data with higher price (meets threshold)
    const finalOracleData = Buffer.alloc(24);
    finalOracleData.writeBigUInt64LE(BigInt((86_400 + 1) * 1e12), 0);
    finalOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const finalTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    finalOracleData.writeBigInt64LE(BigInt(finalTimestamp), 16);
    this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: finalOracleData,
    });

    // Complete unlock
    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      })
      .rpc();

    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(100 * 10 ** 6),
      "Recipient should have 100 tokens",
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(100 * 10 ** 6),
      "PerformancePackage token account should be empty",
    );

    assert.equal(
      performancePackageAccount.tranches[0].isUnlocked,
      true,
      "First tranche should be unlocked",
    );
    assert.equal(
      performancePackageAccount.tranches[1].isUnlocked,
      false,
      "Second tranche should not be unlocked",
    );

    assert.exists(
      performancePackageAccount.state.locked,
      "PerformancePackage should be in Locked state",
    );

    // now try it again with a higher price
    await this.advanceBySeconds(1000);

    initialOracleData.writeBigUInt64LE(BigInt(14e12), 0);
    initialOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const initialTimestamp2 = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    initialOracleData.writeBigInt64LE(BigInt(initialTimestamp2), 16);
    this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: initialOracleData,
    });

    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await this.advanceBySeconds(86_400);

    finalOracleData.writeBigUInt64LE(BigInt((2 * 86_400 + 14) * 1e12), 0);
    finalOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const finalTimestamp2 = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    finalOracleData.writeBigInt64LE(BigInt(finalTimestamp2), 16);
    this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: finalOracleData,
    });

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      })
      .rpc();

    const performancePackageAccount2 =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(
      performancePackageAccount2.tranches[0].isUnlocked,
      true,
      "First tranche should be unlocked",
    );
    assert.equal(
      performancePackageAccount2.tranches[1].isUnlocked,
      true,
      "Second tranche should be unlocked",
    );

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(200 * 10 ** 6),
      "Recipient should have 200 tokens",
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      0n,
      "PerformancePackage token account should be empty",
    );

    assert.exists(
      performancePackageAccount2.state.locked,
      "PerformancePackage should be in Locked state",
    );
  });

  it("should fail if performancePackage is not in Unlocking state", async function () {
    const callbacks = expectError(
      "InvalidPerformancePackageState",
      "PerformancePackage is not in Unlocking state",
    );

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if TWAP calculation period has not elapsed", async function () {
    // Advance time and start unlock
    await this.advanceBySeconds(2);

    const initialOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 1000000
    initialOracleData.writeBigUInt64LE(BigInt(1000000), 0);
    initialOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write timestamp (i64 little endian) - current timestamp
    const currentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    initialOracleData.writeBigInt64LE(BigInt(currentTimestamp), 16);
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: initialOracleData,
    });

    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Try to complete unlock before TWAP period elapses
    await this.advanceBySeconds(5); // Only 5 seconds, need 10

    const callbacks = expectError(
      "TwapPeriodNotElapsed",
      "TWAP calculation period has not elapsed",
    );

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
