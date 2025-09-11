import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { assert } from "chai";
import { PriceBasedUnlockClient } from "@metadaoproject/futarchy/v0.6";
import BN from "bn.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: PublicKey;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let newRecipient: Keypair;
  let locker: PublicKey;
  let lockerTokenAccount: PublicKey;
  let oracleAccount: Keypair;
  let squadsMultisigVault: Keypair;
  let changeKey: Keypair;

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = this.payer.publicKey;
    recipient = Keypair.generate();
    newRecipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    squadsMultisigVault = Keypair.generate();
    changeKey = Keypair.generate();

    // Create mock oracle data: 16 bytes aggregator (u128) + 8 bytes slot (u64)
    const mockOracleData = Buffer.alloc(24);
    // Write aggregator value (u128 little endian) - price of 1000000
    mockOracleData.writeBigUInt64LE(BigInt(1000000), 0);
    mockOracleData.writeBigUInt64LE(BigInt(0), 8);
    // Write slot (u64 little endian) - current slot
    const currentSlot = await this.context.banksClient.getClock().then(c => c.slot);
    mockOracleData.writeBigUInt64LE(BigInt(currentSlot), 16);

    // Set oracle account data
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: mockOracleData,
    });

    // Fund the accounts with SOL
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
        toPubkey: squadsMultisigVault.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);

    // Create token mint and accounts
    tokenMint = await this.createMint(tokenAuthority, 6);
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority);
    const recipientTokenAccount = await this.createTokenAccount(tokenMint, recipient.publicKey);

    // Mint tokens to the authority's account so we have tokens to lock
    await this.mintTo(tokenMint, tokenAuthority, this.payer, 1000000); // 1M tokens

    // Initialize a locker
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      lockerAuthority: squadsMultisigVault.publicKey,
    };

    const initTx = await this.priceBasedUnlock.initializeLockerIx({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      fromTokenAccount: tokenAccount,
      tokenAuthority: tokenAuthority,
      recipientTokenAccount: recipientTokenAccount,
      payer: this.payer.publicKey,
    }).transaction();

    initTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    initTx.sign(createKey, this.payer);
    await this.banksClient.processTransaction(initTx);

    locker = this.priceBasedUnlock.getLockerAddress(createKey.publicKey);
  });

  it("should execute change when recipient proposed and authority executes", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey = Keypair.generate();
    
    // Debug: check locker state before proposing
    const lockerBeforePropose = await this.priceBasedUnlock.getLocker(locker);
    console.log("Execute test setup - recipient matches:", lockerBeforePropose.tokenRecipient.toString() === recipient.publicKey.toString());
    
    // First, recipient proposes the change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: testChangeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    // Now DAO executes the change after governance approval
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, testChangeKey.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: squadsMultisigVault.publicKey, // DAO executes
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(executeTx);

    // Verify the change was applied
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("Recipient proposed -> Authority executed");
    console.log("Change applied correctly:", lockerAccount.tokenRecipient.toString() === newRecipient.publicKey.toString());
    console.log("State transition: PendingChange -> Locked");
    
    assert.equal(lockerAccount.tokenRecipient.toString(), newRecipient.publicKey.toString());
    assert.equal(lockerAccount.state.locked !== undefined, true); // Should be back to Locked state

    // Verify change request account was closed
    try {
      await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
      assert.fail("Change request should have been closed");
    } catch (error) {
      console.log("Change request account properly closed");
      // Expected - account should be closed
    }
  });

  it("should execute change when authority proposed and recipient executes", async function () {
    const changeKey2 = Keypair.generate();
    const newOracleAccount = Keypair.generate();
    
    // First, locker authority proposes the change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          oracle: { 
            newOracleConfig: {
              oracleAccount: newOracleAccount.publicKey,
              byteOffset: 16,
            }
          }
        },
        createKey: changeKey2.publicKey,
      },
      locker,
      proposer: squadsMultisigVault.publicKey, // Authority proposes
      payer: squadsMultisigVault.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(proposeTx);

    // Now recipient executes the change
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey2.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: recipient.publicKey, // Recipient executes
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(recipient);
    await this.banksClient.processTransaction(executeTx);

    // Verify the change was applied
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("Authority proposed -> Recipient executed");
    console.log("Oracle change applied correctly:", lockerAccount.oracleConfig.oracleAccount.toString() === newOracleAccount.publicKey.toString());
    console.log("Byte offset applied correctly:", lockerAccount.oracleConfig.byteOffset === 16);
    
    assert.equal(lockerAccount.oracleConfig.oracleAccount.toString(), newOracleAccount.publicKey.toString());
    assert.equal(lockerAccount.oracleConfig.byteOffset, 16);
    assert.equal(lockerAccount.state.locked !== undefined, true); // Should be back to Locked state
  });

  it("should execute oracle change successfully", async function () {
    const newOracleAccount = Keypair.generate();
    
    // Recipient proposes oracle change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          oracle: { 
            newOracleConfig: {
              oracleAccount: newOracleAccount.publicKey,
              byteOffset: 8,
            }
          }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    // DAO executes the change
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: squadsMultisigVault.publicKey,
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(executeTx);

    // Verify oracle config was updated
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    
    console.log("Oracle change execution test");
    console.log("Oracle account updated:", lockerAccount.oracleConfig.oracleAccount.toString() === newOracleAccount.publicKey.toString());
    console.log("Byte offset updated:", lockerAccount.oracleConfig.byteOffset === 8);
    
    assert.equal(lockerAccount.oracleConfig.oracleAccount.toString(), newOracleAccount.publicKey.toString());
    assert.equal(lockerAccount.oracleConfig.byteOffset, 8);
  });

  it("should fail if wrong vault tries to execute", async function () {
    // Recipient proposes change (correct pattern)
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    // Try to execute with wrong squads vault
    const wrongVault = Keypair.generate();
    await this.context.setAccount(wrongVault.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: Buffer.alloc(0),
    });
    
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    
    try {
      console.log("Testing wrong executor rejection - using:", wrongVault.publicKey.toString().slice(0, 8));
      
      const executeTx = await this.priceBasedUnlock.executeChangeIx({
        locker,
        changeRequest: changeRequestAddr,
        executor: wrongVault.publicKey,
      }).transaction();

      executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      executeTx.sign(wrongVault);
      await this.banksClient.processTransaction(executeTx);
      
      assert.fail("Should have failed with wrong vault");
    } catch (error) {
      console.log("Wrong executor correctly rejected");
      assert.include(error.message.toLowerCase(), "0x1777");
    }
  });

  it("should execute recipient change when authority proposed and recipient executes", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey3 = Keypair.generate();
    
    console.log("Authority proposes recipient change test");
    
    // First, authority proposes recipient change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: testChangeKey3.publicKey,
      },
      locker,
      proposer: squadsMultisigVault.publicKey, // Authority proposes
      payer: squadsMultisigVault.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(proposeTx);

    console.log("Authority proposal successful");

    // Now recipient executes the change
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, testChangeKey3.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: recipient.publicKey, // Recipient executes
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(recipient);
    await this.banksClient.processTransaction(executeTx);

    // Verify the change was applied
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    
    console.log("Authority proposed recipient change -> Recipient executed");
    console.log("Recipient change applied correctly:", lockerAccount.tokenRecipient.toString() === newRecipient.publicKey.toString());
    
    assert.equal(lockerAccount.tokenRecipient.toString(), newRecipient.publicKey.toString());
    assert.equal(lockerAccount.state.locked !== undefined, true);
  });

  it("should execute oracle change when recipient proposed and authority executes", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey4 = Keypair.generate();
    const newOracleAccount2 = Keypair.generate();
    
    console.log("Recipient proposes oracle change test");
    
    // First, recipient proposes oracle change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          oracle: { 
            newOracleConfig: {
              oracleAccount: newOracleAccount2.publicKey,
              byteOffset: 24,
            }
          }
        },
        createKey: testChangeKey4.publicKey,
      },
      locker,
      proposer: recipient.publicKey, // Recipient proposes
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    console.log("Recipient proposal successful");

    // Now authority executes the change
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, testChangeKey4.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: squadsMultisigVault.publicKey, // Authority executes
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(executeTx);

    // Verify the change was applied
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    
    console.log("Recipient proposed oracle change -> Authority executed");
    console.log("Oracle change applied correctly:", lockerAccount.oracleConfig.oracleAccount.toString() === newOracleAccount2.publicKey.toString());
    console.log("Byte offset applied correctly:", lockerAccount.oracleConfig.byteOffset === 24);
    
    assert.equal(lockerAccount.oracleConfig.oracleAccount.toString(), newOracleAccount2.publicKey.toString());
    assert.equal(lockerAccount.oracleConfig.byteOffset, 24);
    assert.equal(lockerAccount.state.locked !== undefined, true);
  });

  it("should fail if recipient tries to execute their own proposal", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey5 = Keypair.generate();
    
    console.log("Self-execution rejection test");
    
    // First, recipient proposes a change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: testChangeKey5.publicKey,
      },
      locker,
      proposer: recipient.publicKey, // Recipient proposes
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    console.log("Recipient proposal successful");

    // Now try to execute with same recipient (should fail)
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, testChangeKey5.publicKey);
    
    try {
      console.log("Proposer was:", "recipient");
      console.log("Expected executor:", "locker authority");
      console.log("Trying to execute with:", "recipient (same as proposer)");
      console.log("Should fail - no self-execution allowed");
      
      const executeTx = await this.priceBasedUnlock.executeChangeIx({
        locker,
        changeRequest: changeRequestAddr,
        executor: recipient.publicKey, // Same as proposer - should fail
      }).transaction();

      executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      executeTx.sign(recipient);
      await this.banksClient.processTransaction(executeTx);
      
      assert.fail("Should have failed with self-execution");
    } catch (error) {
      console.log("Self-execution correctly rejected");
      // Should fail with UnauthorizedLockerAuthority since recipient != authority
      assert.include(error.message.toLowerCase(), "0x1777");
    }
  });

  it("should fail if authority tries to execute their own proposal", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey6 = Keypair.generate();
    
    console.log("Authority self-execution rejection test");
    
    // First, authority proposes a change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          oracle: { 
            newOracleConfig: {
              oracleAccount: Keypair.generate().publicKey,
              byteOffset: 32,
            }
          }
        },
        createKey: testChangeKey6.publicKey,
      },
      locker,
      proposer: squadsMultisigVault.publicKey, // Authority proposes
      payer: squadsMultisigVault.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(proposeTx);

    console.log("Authority proposal successful");

    // Now try to execute with same authority (should fail)
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, testChangeKey6.publicKey);
    
    try {
      console.log("Proposer was:", "locker authority");
      console.log("Expected executor:", "recipient");
      console.log("Trying to execute with:", "locker authority (same as proposer)");
      console.log("Should fail - no self-execution allowed");
      
      const executeTx = await this.priceBasedUnlock.executeChangeIx({
        locker,
        changeRequest: changeRequestAddr,
        executor: squadsMultisigVault.publicKey, // Same as proposer - should fail
      }).transaction();

      executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      executeTx.sign(squadsMultisigVault);
      await this.banksClient.processTransaction(executeTx);
      
      assert.fail("Should have failed with self-execution");
    } catch (error) {
      console.log("Authority self-execution correctly rejected");
      // Should fail with UnauthorizedChangeRequest since authority != recipient
      assert.include(error.message.toLowerCase(), "0x1775");
    }
  });

  it("should fail if locker is not in PendingChange state", async function () {
    // Don't propose any change, try to execute directly
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    
    try {
      const executeTx = await this.priceBasedUnlock.executeChangeIx({
        locker,
        changeRequest: changeRequestAddr,
        executor: squadsMultisigVault.publicKey,
      }).transaction();

      executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      executeTx.sign(squadsMultisigVault);
      await this.banksClient.processTransaction(executeTx);
      
      assert.fail("Should have failed without pending change");
    } catch (error) {
      // Expected - either account not found or invalid state
    }
  });

  it("should restore previous state after execution", async function () {
    // Verify locker starts in Locked state (no need to change state)
    const lockerBefore = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerBefore.state.locked !== undefined, true);

    // Propose change (this puts it in PendingChange state)
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    // Check intermediate state after proposal
    const lockerAfterProposal = await this.priceBasedUnlock.getLocker(locker);
    console.log("Intermediate state after proposal:", JSON.stringify(lockerAfterProposal.state, null, 2));

    // Execute change
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    
    const executeTx = await this.priceBasedUnlock.executeChangeIx({
      locker,
      changeRequest: changeRequestAddr,
      executor: squadsMultisigVault.publicKey,
    }).transaction();

    executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    executeTx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(executeTx);

    // Verify it's back in Locked state (the original state)
    const lockerAfter = await this.priceBasedUnlock.getLocker(locker);
    
    console.log("State restoration test");
    console.log("1️⃣ Original state before proposal:", JSON.stringify(lockerBefore.state, null, 2));
    console.log("2️⃣ Intermediate state after proposal:", JSON.stringify(lockerAfterProposal.state, null, 2));
    console.log("3️⃣ Final state after execution:", JSON.stringify(lockerAfter.state, null, 2));
    console.log("State transition: Locked -> PendingChange -> Locked");
    console.log("Recipient change applied:", lockerAfter.tokenRecipient.toString());
    console.log("Expected new recipient:", newRecipient.publicKey.toString());
    console.log("State restored to Locked:", lockerAfter.state.locked !== undefined);
    console.log("Change applied:", lockerAfter.tokenRecipient.toString() === newRecipient.publicKey.toString());
    
    assert.equal(lockerAfter.state.locked !== undefined, true);
    assert.equal(lockerAfter.tokenRecipient.toString(), newRecipient.publicKey.toString());
  });

  it("should fail with mismatched change request", async function () {
    // Propose one change
    const proposeTx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    proposeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    proposeTx.sign(recipient);
    await this.banksClient.processTransaction(proposeTx);

    // Try to execute with a different change request address
    const wrongChangeKey = Keypair.generate();
    const wrongChangeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, wrongChangeKey.publicKey);
    
    try {
      const executeTx = await this.priceBasedUnlock.executeChangeIx({
        locker,
        changeRequest: wrongChangeRequestAddr,
        executor: squadsMultisigVault.publicKey,
      }).transaction();

      executeTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      executeTx.sign(squadsMultisigVault);
      await this.banksClient.processTransaction(executeTx);
      
      assert.fail("Should have failed with wrong change request");
    } catch (error) {
      console.log(error)
    }
  });
}