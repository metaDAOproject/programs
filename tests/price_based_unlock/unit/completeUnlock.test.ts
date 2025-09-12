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

  before(async function () {
    // Create test accounts
    oracleAccount = Keypair.generate();

    // Token mint will be created per test
  });

  beforeEach(async function () {
    // Generate new keys for each test to avoid account conflicts
    createKey = Keypair.generate();
    recipient = Keypair.generate();
    tokenAuthority = Keypair.generate();

    // Create fresh token mint for each test
    tokenMint = await this.createMint(tokenAuthority.publicKey, 6);

    // Fund the keys with SOL
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
        toPubkey: tokenAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);

    // Derive PDA for locker
    const [lockerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), createKey.publicKey.toBuffer()],
      this.priceBasedUnlock.programId
    );
    locker = lockerPda;

    // Get the locker token account address (PDA) - will be created by initializeLocker
    lockerTokenAccount =
      this.priceBasedUnlock.getLockerTokenAccountAddress(locker);

    // Create fresh token accounts for each test
    // console.log("=== BEFOREEACH DEBUG ===");
    // console.log("Creating token account for tokenAuthority:", tokenAuthority.publicKey.toString());

    // Use associated token accounts for consistency
    tokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      tokenAuthority.publicKey,
      true
    );
    await this.createTokenAccount(tokenMint, tokenAuthority.publicKey);
    // console.log("Created tokenAccount address:", tokenAccount.toString());

    recipientTokenAccount = token.getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey,
      true
    );
    await this.createTokenAccount(tokenMint, recipient.publicKey);
    // console.log("Created recipientTokenAccount address:", recipientTokenAccount.toString());

    // Mint fresh tokens for each test
    // console.log("Minting 1000000 tokens to tokenAuthority");
    // console.log("TokenAuthority public key:", tokenAuthority.publicKey.toString());
    // console.log("Token account address:", tokenAccount.toString());
    // console.log("Token mint address:", tokenMint.toString());

    try {
      await this.mintTo(
        tokenMint,
        tokenAuthority.publicKey,
        tokenAuthority,
        1000000
      );
      // console.log("Minting completed successfully");
    } catch (error) {
      // console.log("Minting failed:", error.message, error);
      // console.log("Full error:", JSON.stringify(error, null, 2));
    }

    // Verify minting worked - try direct account check
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        tokenAccount
      );
      if (accountInfo) {
        // console.log("Token account exists with", accountInfo.lamports, "lamports");
        // Parse token account data to get balance
        if (accountInfo.data && accountInfo.data.length >= 64) {
          // Token account balance is stored as u64 at offset 64 in the account data
          const balanceBuffer = accountInfo.data.slice(64, 72);
          const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
          // console.log("Token account balance after minting:", balance.toString());
        } else {
          // console.log("Token account data is too small or missing");
        }
      } else {
        // console.log("Token account does not exist after minting");
      }
    } catch (error) {
      // console.log("Could not check token account after minting:", error.message);
    }
  });

  it("should unlock 100% of tokens when price meets threshold", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(5), // 5 seconds for faster testing
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    // Advance time and start unlock
    await this.advanceBySeconds(2);

    // Set initial oracle data: 16 bytes aggregator (u128) + 8 bytes timestamp (i64)
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

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.feePayer = recipient.publicKey;
    startTx.sign(recipient);
    await this.banksClient.processTransaction(startTx);

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(6);

    // Set final oracle data with higher price (meets threshold)
    const finalOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 7000000 to ensure TWAP >= threshold
    // TWAP = (7000000 - 1000000) / 6 = 1000000 (exactly the threshold)
    finalOracleData.writeBigUInt64LE(BigInt(7000000), 0);
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
    const completeTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    completeTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    completeTx.feePayer = this.payer.publicKey;
    completeTx.sign(this.payer);
    await this.banksClient.processTransaction(completeTx);

    // Verify locker state changed back to Locked (allows repeated unlock cycles)
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    // console.log("=== COMPLETE UNLOCK TEST DEBUG ===");
    // console.log("Locker state:", JSON.stringify(lockerAccount.state, null, 2));
    // console.log("Tokens already unlocked:", lockerAccount.tokensAlreadyUnlocked.toString());
    // console.log("Total token amount:", lockerAccount.tokenAmount.toString());

    // Verify tokens were transferred to recipient
    const recipientBalance = await this.getTokenBalance(
      tokenMint,
      recipient.publicKey
    );
    // console.log("Recipient balance:", recipientBalance.toString());

    // Verify locker token account is empty (may not exist if all tokens transferred)
    let lockerBalance = "0";
    try {
      const balance = await this.getTokenBalance(tokenMint, lockerTokenAccount);
      lockerBalance = balance.toString();
    } catch (error) {
      // Token account not found means it's empty or closed - this is expected
      console.log(
        "Locker token account not found (expected for empty account)"
      );
    }
    console.log("Locker token account balance:", lockerBalance);

    assert(
      lockerAccount.state.locked !== undefined,
      "Locker should be back in Locked state for repeated cycles"
    );
    assert.equal(
      recipientBalance.toString(),
      "100000",
      "Recipient should have 100000 tokens"
    );
    assert.equal(lockerBalance, "0", "Locker token account should be empty");
  });

  it("should fail if locker is not in Unlocking state", async function () {
    // Initialize locker
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
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    // Try to complete unlock before starting it
    try {
      const completeTx = await this.priceBasedUnlock
        .completeUnlockIx({
          locker,
          oracleAccount: oracleAccount.publicKey,
          tokenMint,
          tokenRecipient: recipient.publicKey,
          payer: this.payer.publicKey,
        })
        .transaction();

      completeTx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      completeTx.feePayer = this.payer.publicKey;
      completeTx.sign(this.payer);
      await this.banksClient.processTransaction(completeTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message.toLowerCase(), "0x1772");
    }
  });

  it("should fail if TWAP calculation period has not elapsed", async function () {
    // Initialize locker
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
      twapLengthSeconds: new BN(10), // 10 seconds
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.feePayer = recipient.publicKey;
    startTx.sign(recipient);
    await this.banksClient.processTransaction(startTx);

    // Try to complete unlock before TWAP period elapses
    await this.advanceBySeconds(5); // Only 5 seconds, need 10

    try {
      const completeTx = await this.priceBasedUnlock
        .completeUnlockIx({
          locker,
          oracleAccount: oracleAccount.publicKey,
          tokenMint,
          tokenRecipient: recipient.publicKey,
          payer: this.payer.publicKey,
        })
        .transaction();

      completeTx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      completeTx.feePayer = this.payer.publicKey;
      completeTx.sign(this.payer);
      await this.banksClient.processTransaction(completeTx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message.toLowerCase(), "0x1773");
    }
  });

  it("should unlock 50% of tokens when price is 50% of threshold", async function () {
    // Debug: Check token balances BEFORE initialization
    console.log("=== BEFORE INIT (50% TEST) ===");
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        tokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        console.log("Source account balance before init:", balance.toString());
        console.log("Source account address:", tokenAccount.toString());
        console.log(
          "Locker token account address:",
          lockerTokenAccount.toString()
        );
      } else {
        console.log("Source account data invalid before init");
      }
    } catch (error) {
      console.log("Source account not found before init");
    }

    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    // Debug: Check token balances after initialization
    console.log("=== AFTER INIT (50% TEST) ===");
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        tokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        console.log("Source account balance after init:", balance.toString());
      } else {
        console.log("Source account data invalid after init");
      }
    } catch (error) {
      console.log("Source account not found");
    }

    try {
      const accountInfo = await this.context.banksClient.getAccount(
        lockerTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        console.log("Initial locker token balance:", balance.toString());
      } else {
        console.log("Initial locker token account data invalid after init");
      }
    } catch (error) {
      console.log("Initial locker token account not found after init");
    }

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

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.feePayer = recipient.publicKey;
    startTx.sign(recipient);
    await this.banksClient.processTransaction(startTx);

    // Advance time past TWAP calculation period
    await this.advanceBySeconds(6);

    // Set final oracle data with 50% of threshold price
    const finalOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price that results in TWAP of 0.5 (50% of 1.0 threshold)
    // TWAP = (4000000 - 1000000) / 6 = 500000 (50% of threshold)
    finalOracleData.writeBigUInt64LE(BigInt(4000000), 0);
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
    const completeTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    completeTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    completeTx.feePayer = this.payer.publicKey;
    completeTx.sign(this.payer);
    await this.banksClient.processTransaction(completeTx);

    // Verify locker is still in Unlocking state (not fully unlocked)
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("=== 50% UNLOCK TEST DEBUG ===");
    console.log("Locker state:", JSON.stringify(lockerAccount.state, null, 2));
    console.log(
      "Tokens already unlocked:",
      lockerAccount.tokensAlreadyUnlocked.toString()
    );
    console.log("Total token amount:", lockerAccount.tokenAmount.toString());

    // Verify 50% of tokens were transferred to recipient (50,000 out of 100,000)
    let recipientBalance = "0";
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        recipientTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        recipientBalance = balance.toString();
      }
    } catch (error) {
      recipientBalance = "0";
    }
    console.log("Recipient balance:", recipientBalance.toString());

    assert(lockerAccount.state.locked !== undefined);
    assert.equal(recipientBalance.toString(), "50000");

    // Verify tokens_already_unlocked is tracked correctly
    assert.equal(lockerAccount.tokensAlreadyUnlocked.toString(), "50000");

    // Verify remaining tokens are still in locker (50,000)
    let lockerBalance = "0";
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        lockerTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        lockerBalance = balance.toString();
      }
    } catch (error) {
      // Token account not found - check if it should be empty
      lockerBalance = "0";
    }
    console.log("Locker token account balance:", lockerBalance);

    // For 50% unlock, there should still be 50,000 tokens in the locker
    assert.equal(lockerBalance, "50000");
  });

  it("should allow multiple unlock calls as price increases", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    // Start unlock process
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

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.feePayer = recipient.publicKey;
    startTx.sign(recipient);
    await this.banksClient.processTransaction(startTx);

    // First unlock at 30% price (30,000 tokens)
    await this.advanceBySeconds(6);
    const firstUnlockData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price results in TWAP of 0.3
    // start_aggregator = 1,000,000, time_passed = 6, target_twap = 300,000
    // current_aggregator = start + (target_twap * time_passed) = 1,000,000 + (300,000 * 6) = 2,800,000
    firstUnlockData.writeBigUInt64LE(BigInt(2800000), 0);
    firstUnlockData.writeBigUInt64LE(BigInt(0), 8);
    // Write current timestamp (i64 little endian)
    const firstCurrentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    firstUnlockData.writeBigInt64LE(BigInt(firstCurrentTimestamp), 16);
    console.log("=== FIRST UNLOCK DEBUG ===");
    console.log("First unlock timestamp:", firstCurrentTimestamp);
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: firstUnlockData,
    });

    const firstCompleteTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    // Add unique memo to ensure transaction uniqueness
    const uniqueMemo = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`unlock1-${Date.now()}-${Math.random()}`, "utf8"),
    });
    firstCompleteTx.add(uniqueMemo);

    await this.advanceBySlots(10n);
    firstCompleteTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    firstCompleteTx.feePayer = this.payer.publicKey;
    firstCompleteTx.sign(this.payer);
    await this.banksClient.processTransaction(firstCompleteTx);

    // Verify first unlock results
    let recipientBalance = "0";
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        recipientTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        recipientBalance = balance.toString();
      }
    } catch (error) {
      recipientBalance = "0";
    }

    let lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("=== FIRST UNLOCK RESULT DEBUG ===");
    console.log("First unlock recipient balance:", recipientBalance.toString());
    console.log(
      "First unlock tokens already unlocked:",
      lockerAccount.tokensAlreadyUnlocked.toString()
    );
    console.log("Expected 30% = 30,000 tokens");
    console.log("Locker state:", JSON.stringify(lockerAccount.state, null, 2));

    assert.equal(recipientBalance.toString(), "30000");
    assert.equal(lockerAccount.tokensAlreadyUnlocked.toString(), "30000");
    assert(
      lockerAccount.state.locked !== undefined,
      "Should be back in locked state after each unlock cycle"
    );

    // Second unlock at 80% price (80,000 total, so 50,000 more tokens)
    await this.advanceBySeconds(2);

    // First set initial oracle data for the second cycle
    const secondInitialTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);

    const secondInitialData = Buffer.alloc(24);
    // Set a known starting aggregator value for predictable TWAP calculation
    const startAggregator = BigInt(1000000);
    secondInitialData.writeBigUInt64LE(startAggregator, 0);
    secondInitialData.writeBigUInt64LE(BigInt(0), 8);
    secondInitialData.writeBigInt64LE(BigInt(secondInitialTimestamp), 16);
    
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: secondInitialData,
    });

    // Start the second unlock cycle
    const secondStartTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    // Add unique memo to prevent "transaction already processed" errors
    const secondStartMemo = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`start-unlock2-${Date.now()}-${Math.random()}`, "utf8"),
    });
    secondStartTx.add(secondStartMemo);

    secondStartTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    secondStartTx.feePayer = recipient.publicKey;
    secondStartTx.sign(recipient);
    await this.banksClient.processTransaction(secondStartTx);

    // Advance time past TWAP calculation period (need at least 5 seconds for TWAP)
    await this.advanceBySeconds(6);

    // Now set oracle data with timestamp after the start unlock
    const secondCurrentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);

    const secondUnlockData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price results in TWAP of 0.8
    // For 80% unlock: TWAP should be 800,000. With ~6 seconds and start_aggregator = 1,000,000:
    // aggregator_change = 800,000 * 6 = 4,800,000
    // current_aggregator = start_aggregator + aggregator_change = 1,000,000 + 4,800,000 = 5,800,000
    const currentAggregator = startAggregator + BigInt(800000 * 6);
    console.log(
      "Setting aggregator for 80% unlock:",
      currentAggregator.toString()
    );
    secondUnlockData.writeBigUInt64LE(currentAggregator, 0);
    secondUnlockData.writeBigUInt64LE(BigInt(0), 8);
    // Write current timestamp (i64 little endian)
    secondUnlockData.writeBigInt64LE(BigInt(secondCurrentTimestamp), 16);
    
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: secondUnlockData,
    });

    const secondCompleteTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    // Add unique memo to ensure transaction uniqueness
    const uniqueMemo2 = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`unlock2-${Date.now()}-${Math.random()}`, "utf8"),
    });
    secondCompleteTx.add(uniqueMemo2);

    // Advance 10 slots for unique blockhash
    await this.advanceBySlots(10n);
    secondCompleteTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    secondCompleteTx.feePayer = this.payer.publicKey;
    secondCompleteTx.sign(this.payer);
    await this.banksClient.processTransaction(secondCompleteTx);

    // Verify second unlock results
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        recipientTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        recipientBalance = balance.toString();
      }
    } catch (error) {
      recipientBalance = "0";
    }
    lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("=== SECOND UNLOCK RESULT DEBUG ===");
    console.log("Expected: 80000 tokens");
    console.log("Actual recipient balance:", recipientBalance.toString());
    console.log(
      "Actual tokens already unlocked:",
      lockerAccount.tokensAlreadyUnlocked.toString()
    );
    console.log(
      "Expected tokens already unlocked: 43000 (if 43% unlock) or 80000 (if 80% unlock)"
    );
    assert.equal(recipientBalance.toString(), "80000");
    assert.equal(lockerAccount.tokensAlreadyUnlocked.toString(), "80000");
    assert(
      lockerAccount.state.locked !== undefined,
      "Should be back in locked state after each unlock cycle"
    );

    // Third unlock at 100% price (all remaining 20,000 tokens)
    await this.advanceBySeconds(2);

    // First set initial oracle data for the third cycle
    const thirdInitialTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);

    const thirdInitialData = Buffer.alloc(24);
    // Set a known starting aggregator value for predictable TWAP calculation
    const thirdStartAggregator = BigInt(1000000);
    thirdInitialData.writeBigUInt64LE(thirdStartAggregator, 0);
    thirdInitialData.writeBigUInt64LE(BigInt(0), 8);
    thirdInitialData.writeBigInt64LE(BigInt(thirdInitialTimestamp), 16);
    
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: thirdInitialData,
    });

    // Start the third unlock cycle
    const thirdStartTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    // Add unique memo to prevent "transaction already processed" errors
    const thirdStartMemo = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`start-unlock3-${Date.now()}-${Math.random()}`, "utf8"),
    });
    thirdStartTx.add(thirdStartMemo);

    thirdStartTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    thirdStartTx.feePayer = recipient.publicKey;
    thirdStartTx.sign(recipient);
    await this.banksClient.processTransaction(thirdStartTx);

    // Advance time past TWAP calculation period (need at least 5 seconds for TWAP)
    await this.advanceBySeconds(6);

    // Now set oracle data with timestamp after the start unlock
    const thirdCurrentTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);

    const thirdUnlockData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price results in TWAP of 1.0
    // For 100% unlock: TWAP should be 1,000,000. With ~6 seconds and start_aggregator = 1,000,000:
    // aggregator_change = 1,000,000 * 6 = 6,000,000
    // current_aggregator = start_aggregator + aggregator_change = 1,000,000 + 6,000,000 = 7,000,000
    thirdUnlockData.writeBigUInt64LE(thirdStartAggregator + BigInt(1000000 * 6), 0);
    thirdUnlockData.writeBigUInt64LE(BigInt(0), 8);
    // Write current timestamp (i64 little endian)
    thirdUnlockData.writeBigInt64LE(BigInt(thirdCurrentTimestamp), 16);
    
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: thirdUnlockData,
    });

    const thirdCompleteTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    // Add unique memo to ensure transaction uniqueness
    const uniqueMemo3 = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`unlock3-${Date.now()}-${Math.random()}`, "utf8"),
    });
    thirdCompleteTx.add(uniqueMemo3);

    // Advance 10 slots for unique blockhash
    await this.advanceBySlots(10n);
    thirdCompleteTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    thirdCompleteTx.feePayer = this.payer.publicKey;
    thirdCompleteTx.sign(this.payer);
    await this.banksClient.processTransaction(thirdCompleteTx);

    // Verify final unlock results
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        recipientTokenAccount
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        recipientBalance = balance.toString();
      }
    } catch (error) {
      recipientBalance = "0";
    }
    assert.equal(
      recipientBalance.toString(),
      "100000",
      "All tokens should be unlocked"
    );

    lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerAccount.tokensAlreadyUnlocked.toString(), "100000");
    assert(
      lockerAccount.state.locked !== undefined,
      "Should be back to locked state after full unlock"
    );

    // Verify locker is empty
    let lockerBalance;
    try {
      lockerBalance = await this.getTokenBalance(tokenMint, locker);
    } catch (error) {
      lockerBalance = "0";
    }
    assert.equal(lockerBalance.toString(), "0");
  });

  it("should not unlock additional tokens if price decreases", async function () {
    // Initialize locker
    const params = {
      priceThreshold: new BN(1000000), // 1.0 threshold
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 1
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(5),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: this.payer.publicKey,
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

    // Start unlock process
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

    const startTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    startTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    startTx.feePayer = recipient.publicKey;
    startTx.sign(recipient);
    await this.banksClient.processTransaction(startTx);

    // First unlock at 60% price (60,000 tokens)
    await this.advanceBySeconds(6);
    const firstUnlockData = Buffer.alloc(24);
    const firstAggregatorValue = BigInt(4600000); // Results in TWAP of 0.6
    firstUnlockData.writeBigUInt64LE(firstAggregatorValue, 0);
    firstUnlockData.writeBigUInt64LE(BigInt(0), 8);
    const firstTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    firstUnlockData.writeBigInt64LE(BigInt(firstTimestamp), 16);
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: firstUnlockData,
    });

    const firstCompleteTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    // Add unique memo to ensure transaction uniqueness
    const uniqueMemo1 = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(
        `decrease-test-unlock1-${Date.now()}-${Math.random()}`,
        "utf8"
      ),
    });
    firstCompleteTx.add(uniqueMemo1);

    firstCompleteTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    firstCompleteTx.feePayer = this.payer.publicKey;
    firstCompleteTx.sign(this.payer);
    await this.banksClient.processTransaction(firstCompleteTx);

    // Verify first unlock
    let recipientBalance = await this.getTokenBalance(
      tokenMint,
      recipient.publicKey
    );
    assert.equal(recipientBalance.toString(), "60000");

    // Try to unlock again - same aggregator but more time = lower TWAP (should not unlock additional tokens)
    await this.advanceBySeconds(2);

    // Start the second unlock cycle first
    const secondStartTx = await this.priceBasedUnlock
      .startUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .transaction();

    // Add unique memo to prevent "transaction already processed" errors
    const decreaseTestStartMemo = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(`decrease-start-${Date.now()}-${Math.random()}`, "utf8"),
    });
    secondStartTx.add(decreaseTestStartMemo);

    secondStartTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    secondStartTx.feePayer = recipient.publicKey;
    secondStartTx.sign(recipient);
    await this.banksClient.processTransaction(secondStartTx);

    // Advance time past TWAP period
    await this.advanceBySeconds(6);

    const secondUnlockData = Buffer.alloc(24);
    const secondAggregatorValue = BigInt(4600000); // Same aggregator but more time elapsed = lower TWAP
    secondUnlockData.writeBigUInt64LE(secondAggregatorValue, 0);
    secondUnlockData.writeBigUInt64LE(BigInt(0), 8);
    const secondTimestamp = await this.context.banksClient
      .getClock()
      .then((c) => c.unixTimestamp);
    secondUnlockData.writeBigInt64LE(BigInt(secondTimestamp), 16);
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: secondUnlockData,
    });

    const secondCompleteTx = await this.priceBasedUnlock
      .completeUnlockIx({
        locker,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
        payer: this.payer.publicKey,
      })
      .transaction();

    // Add unique memo to ensure transaction uniqueness
    const uniqueMemo2 = new TransactionInstruction({
      keys: [],
      programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      data: Buffer.from(
        `decrease-test-unlock2-${Date.now()}-${Math.random()}`,
        "utf8"
      ),
    });
    secondCompleteTx.add(uniqueMemo2);

    secondCompleteTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    secondCompleteTx.feePayer = this.payer.publicKey;
    secondCompleteTx.sign(this.payer);
    await this.banksClient.processTransaction(secondCompleteTx);

    // Verify no additional tokens were unlocked
    recipientBalance = await this.getTokenBalance(
      tokenMint,
      recipient.publicKey
    );
    assert.equal(
      recipientBalance.toString(),
      "60000",
      "No additional tokens should be unlocked"
    );

    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerAccount.tokensAlreadyUnlocked.toString(), "60000");
  });
}
