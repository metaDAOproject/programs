import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: PublicKey;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let currentAuthority: Keypair;
  let newAuthority: Keypair;
  let performancePackage: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = this.payer.publicKey;
    recipient = Keypair.generate();
    currentAuthority = Keypair.generate();
    newAuthority = Keypair.generate();
    oracleAccount = Keypair.generate();

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
        toPubkey: currentAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: newAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);

    // Create token mint and accounts
    tokenMint = await this.createMint(tokenAuthority, 6);
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority);

    // Mint tokens to the authority's account
    await this.mintTo(tokenMint, tokenAuthority, this.payer, 1000000); // 1M tokens

    // Initialize a performancePackage
    const params = {
      priceThreshold: new BN(1000000),
      tokenAmount: new BN(100000),
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
      performancePackageAuthority: currentAuthority.publicKey,
    };

    const tx = await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        fromTokenAccount: tokenAccount,
        tokenAuthority: tokenAuthority,
        payer: this.payer.publicKey,
      })
      .transaction();

    tx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    tx.sign(createKey, this.payer);
    await this.banksClient.processTransaction(tx);

    // Get performancePackage address
    performancePackage = this.priceBasedPerformancePackage.getPerformancePackageAddress(createKey.publicKey);
  });

  it("should change performancePackage authority successfully", async function () {
    // Verify initial authority
    const initialPerformancePackage = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
    assert.equal(
      initialPerformancePackage.performancePackageAuthority.toString(),
      currentAuthority.publicKey.toString()
    );

    // Change the performancePackage authority
    const tx = await this.priceBasedPerformancePackage
      .changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: currentAuthority.publicKey,
        newPerformancePackageAuthority: newAuthority.publicKey,
      })
      .transaction();

    tx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    tx.feePayer = currentAuthority.publicKey;
    tx.sign(currentAuthority);
    await this.banksClient.processTransaction(tx);

    // Verify authority was changed
    const updatedPerformancePackage = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
    assert.equal(
      updatedPerformancePackage.performancePackageAuthority.toString(),
      newAuthority.publicKey.toString()
    );
  });

  it("should fail if unauthorized party tries to change authority", async function () {
    const unauthorizedWallet = Keypair.generate();

    // Fund the unauthorized wallet
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: unauthorizedWallet.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    try {
      const tx = await this.priceBasedPerformancePackage
        .changePerformancePackageAuthorityIx({
          performancePackage,
          currentAuthority: unauthorizedWallet.publicKey,
          newPerformancePackageAuthority: newAuthority.publicKey,
        })
        .transaction();

      tx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      tx.feePayer = unauthorizedWallet.publicKey;
      tx.sign(unauthorizedWallet);
      await this.banksClient.processTransaction(tx);

      assert.fail("Should have failed with unauthorized authority change");
    } catch (error) {
      assert.include(error.message.toLowerCase(), "0x1778"); 
    }
  });

  it("should fail if current authority doesn't match performancePackage authority", async function () {
    const wrongAuthority = Keypair.generate();

    // Fund the wrong authority
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: wrongAuthority.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    try {
      const tx = await this.priceBasedPerformancePackage
        .changePerformancePackageAuthorityIx({
          performancePackage,
          currentAuthority: wrongAuthority.publicKey,
          newPerformancePackageAuthority: newAuthority.publicKey,
        })
        .transaction();

      tx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      tx.feePayer = wrongAuthority.publicKey;
      tx.sign(wrongAuthority);
      await this.banksClient.processTransaction(tx);

      assert.fail("Should have failed with wrong current authority");
    } catch (error) {
      assert.include(error.message.toLowerCase(), "0x1778"); 
    }
  });

  it("should allow new authority to perform authority actions", async function () {
    // First change the authority
    const changeTx = await this.priceBasedPerformancePackage
      .changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: currentAuthority.publicKey,
        newPerformancePackageAuthority: newAuthority.publicKey,
      })
      .transaction();

    changeTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    changeTx.feePayer = currentAuthority.publicKey;
    changeTx.sign(currentAuthority);
    await this.banksClient.processTransaction(changeTx);

    // Now try to propose a change using the new authority
    const pdaNonce = Math.floor(Math.random() * 1000000);
    const proposeTx = await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            oracle: {
              newOracleConfig: {
                oracleAccount: Keypair.generate().publicKey,
                byteOffset: 8,
              },
            },
          },
          pdaNonce: pdaNonce,
        },
        performancePackage,
        proposer: newAuthority.publicKey, // New authority proposes
        payer: newAuthority.publicKey,
      })
      .transaction();

    proposeTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    proposeTx.feePayer = newAuthority.publicKey;
    proposeTx.sign(newAuthority);
    await this.banksClient.processTransaction(proposeTx);

    // Verify the change request was created successfully
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      newAuthority.publicKey,
      pdaNonce
    );
    const changeRequest = await this.priceBasedPerformancePackage.getChangeRequest(
      changeRequestAddr
    );
    assert.equal(
      changeRequest.proposer.toString(),
      newAuthority.publicKey.toString()
    );
  });
}