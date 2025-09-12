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

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = this.payer.publicKey;
    recipient = Keypair.generate();
    newRecipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    squadsMultisigVault = Keypair.generate();

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

    // Initialize a locker first
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

    const tx = await this.priceBasedUnlock.initializeLockerIx({
      params,
      createKey: createKey.publicKey,
      tokenMint,
      fromTokenAccount: tokenAccount,
      tokenAuthority: tokenAuthority,
      payer: this.payer.publicKey,
    }).transaction();

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(createKey, this.payer);
    await this.banksClient.processTransaction(tx);

    // Get locker address
    locker = this.priceBasedUnlock.getLockerAddress(createKey.publicKey);
    
    // Debug: verify locker initialization
    const initialLocker = await this.priceBasedUnlock.getLocker(locker);
    console.log("=== LOCKER INITIALIZATION DEBUG ===");
    console.log("Locker address:", locker.toString());
    console.log("Stored token_recipient:", initialLocker.tokenRecipient.toString());
    console.log("Stored locker_authority:", initialLocker.lockerAuthority.toString());
    console.log("Expected recipient:", recipient.publicKey.toString());
    console.log("Expected authority:", squadsMultisigVault.publicKey.toString());
    console.log("Recipient matches:", initialLocker.tokenRecipient.toString() === recipient.publicKey.toString());
    console.log("Authority matches:", initialLocker.lockerAuthority.toString() === squadsMultisigVault.publicKey.toString());
  });

  it("should allow recipient to propose a change (recipient → locker authority execution flow)", async function () {
    const changeKey = Keypair.generate();
    
    // Debug: check locker state before proposing
    const lockerBeforePropose = await this.priceBasedUnlock.getLocker(locker);
    console.log("=== BEFORE PROPOSE CHANGE DEBUG ===");
    console.log("Locker token_recipient:", lockerBeforePropose.tokenRecipient.toString());
    console.log("Locker locker_authority:", lockerBeforePropose.lockerAuthority.toString());
    console.log("Proposer (should be recipient):", recipient.publicKey.toString());
    console.log("Match check: token_recipient == proposer:", lockerBeforePropose.tokenRecipient.toString() === recipient.publicKey.toString());
    console.log("Match check: locker_authority == proposer:", lockerBeforePropose.lockerAuthority.toString() === recipient.publicKey.toString());
    
    const tx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newRecipient.publicKey }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: recipient.publicKey,  // Recipient proposes
      payer: recipient.publicKey,
    }).transaction();

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(recipient);
    await this.banksClient.processTransaction(tx);

    // Verify locker state changed to PendingChange
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("Recipient proposal test - proposer:", recipient.publicKey.toString().slice(0, 8));
    console.log("State transition: Locked -> PendingChange");
    assert.equal(lockerAccount.state.pendingChange !== undefined, true);
    
    // Verify change request was created with correct proposer
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    const changeRequest = await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
    console.log("Proposer stored correctly:", changeRequest.proposer.toString() === recipient.publicKey.toString());
    
    assert.equal(changeRequest.proposer.toString(), recipient.publicKey.toString());
    assert.equal(changeRequest.locker.toString(), locker.toString());
    assert.equal(changeRequest.changeType.recipient.newRecipient.toString(), newRecipient.publicKey.toString());
  });

  it("should allow locker authority to propose a change (locker authority → recipient execution flow)", async function () {
    const changeKey = Keypair.generate();
    
    const tx = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          oracle: { 
            newOracleConfig: {
              oracleAccount: Keypair.generate().publicKey,
              byteOffset: 16,
            }
          }
        },
        createKey: changeKey.publicKey,
      },
      locker,
      proposer: squadsMultisigVault.publicKey,  // Locker authority proposes
      payer: squadsMultisigVault.publicKey,
    }).transaction();

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(squadsMultisigVault);
    await this.banksClient.processTransaction(tx);

    // Verify locker state changed to PendingChange
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    console.log("Authority proposal test - proposer:", squadsMultisigVault.publicKey.toString().slice(0, 8));
    console.log("State transition: Locked -> PendingChange");
    assert.equal(lockerAccount.state.pendingChange !== undefined, true);
    
    // Verify change request was created with correct proposer
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    const changeRequest = await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
    console.log("Authority proposer stored correctly:", changeRequest.proposer.toString() === squadsMultisigVault.publicKey.toString());
    
    assert.equal(changeRequest.proposer.toString(), squadsMultisigVault.publicKey.toString());
    assert.equal(changeRequest.locker.toString(), locker.toString());
  });

  it("should fail if unauthorized party tries to propose change", async function () {
    const changeKey = Keypair.generate();
    const unauthorizedWallet = Keypair.generate();
    
    // Fund the unauthorized wallet
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: unauthorizedWallet.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundTx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    console.log("Testing unauthorized proposer rejection - wallet:", unauthorizedWallet.publicKey.toString().slice(0, 8));

    try {
      const tx = await this.priceBasedUnlock.proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey }
          },
          createKey: changeKey.publicKey,
        },
        locker,
        proposer: unauthorizedWallet.publicKey, // Neither recipient nor authority
        payer: unauthorizedWallet.publicKey,
      }).transaction();

      tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
      tx.sign(unauthorizedWallet);
      await this.banksClient.processTransaction(tx);
      
      assert.fail("Should have failed with unauthorized proposer");
    } catch (error) {
      console.log("Unauthorized proposer correctly rejected");
      assert.include(error.message.toLowerCase(), "0x1775");
    }
  });

  it("should propose an oracle change successfully", async function () {
    const changeKey = Keypair.generate();
    const newOracleAccount = Keypair.generate();
    
    const tx = await this.priceBasedUnlock.proposeChangeIx({
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

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(recipient);
    await this.banksClient.processTransaction(tx);

    // Verify change request
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    const changeRequest = await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
    const lockerAccount = await this.priceBasedUnlock.getLocker(locker);
    
    console.log("=== ORACLE CHANGE PROPOSAL ===");
    console.log("Original oracle account:", lockerAccount.oracleConfig.oracleAccount.toString());
    console.log("Original byte offset:", lockerAccount.oracleConfig.byteOffset);
    console.log("Proposed new oracle account:", newOracleAccount.publicKey.toString());
    console.log("Proposed new byte offset:", 8);
    console.log("Change request oracle details:", JSON.stringify(changeRequest.changeType.oracle, null, 2));
    console.log("Change request stored oracle account:", changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString());
    console.log("Change request stored byte offset:", changeRequest.changeType.oracle.newOracleConfig.byteOffset);
    
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString(), newOracleAccount.publicKey.toString());
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.byteOffset, 8);
  });

  it("should overwrite existing change request with init_if_needed", async function () {
    const changeKey = Keypair.generate();
    
    // First proposal
    const tx1 = await this.priceBasedUnlock.proposeChangeIx({
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

    tx1.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx1.sign(recipient);
    await this.banksClient.processTransaction(tx1);

    // Second proposal with different recipient (should overwrite)
    const newerRecipient = Keypair.generate();
    const tx2 = await this.priceBasedUnlock.proposeChangeIx({
      params: {
        changeType: {
          recipient: { newRecipient: newerRecipient.publicKey }
        },
        createKey: changeKey.publicKey, // Same create key
      },
      locker,
      proposer: recipient.publicKey,
      payer: recipient.publicKey,
    }).transaction();

    tx2.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx2.sign(recipient);
    await this.banksClient.processTransaction(tx2);

    // Verify the change request has the newer recipient
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    const changeRequest = await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
    assert.equal(changeRequest.changeType.recipient.newRecipient.toString(), newerRecipient.publicKey.toString());
  });

  it("should store previous state correctly", async function () {
    // Verify locker starts in Locked state
    const lockerBefore = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(lockerBefore.state.locked !== undefined, true);

    // Propose change from Locked state
    const changeKey = Keypair.generate();
    const tx = await this.priceBasedUnlock.proposeChangeIx({
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

    tx.recentBlockhash = (await this.context.banksClient.getLatestBlockhash())[0];
    tx.sign(recipient);
    await this.banksClient.processTransaction(tx);

    // Verify change request stored the previous Locked state
    const changeRequestAddr = this.priceBasedUnlock.getChangeRequestAddress(locker, changeKey.publicKey);
    const changeRequest = await this.priceBasedUnlock.getChangeRequest(changeRequestAddr);
    assert.equal(changeRequest.previousState.locked !== undefined, true);
  });
}