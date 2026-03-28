import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
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
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let recipientTokenAccount: PublicKey;
  let performancePackage: PublicKey;
  let lockerTokenAccount: PublicKey;
  let oracleAccount: Keypair;
  let lockerAuthority: Keypair;

  beforeEach(async function () {
    // Create test accounts
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    lockerAuthority = Keypair.generate();

    tokenMint = await this.createMint(this.payer.publicKey, 6);

    // Create token accounts
    recipientTokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey,
      true,
    );

    // Mint some tokens to the authority
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

    return;

    // Fund accounts with SOL using SystemProgram
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: createKey.publicKey,
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
      }),
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);
  });

  it("should start unlock successfully when timestamp is reached", async function () {
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
    const lockerAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert(lockerAccount.state.unlocking !== undefined);
    if (lockerAccount.state.unlocking) {
      assert.equal(
        lockerAccount.state.unlocking.startAggregator.toString(),
        "5000000",
      );
      assert(lockerAccount.state.unlocking.startTimestamp.toNumber() > 0);
    }
  });

  it("should fail if unlock timestamp has not been reached", async function () {
    const callbacks = expectError(
      "UnlockTimestampNotReached",
      "Unlock timestamp has not been reached yet",
    );
    // Try to start unlock before timestamp
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if locker is not in Locked state", async function () {
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
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Advance time slightly to make the next transaction different
    await this.advanceBySeconds(1);

    const callbacks = expectError(
      "InvalidPerformancePackageState",
      "Performance package is not in the expected state",
    );

    // Try to start unlock again (should fail)
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
