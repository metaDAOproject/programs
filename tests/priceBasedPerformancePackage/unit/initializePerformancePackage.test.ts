import { PublicKey, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { mintTo, getAccount } from "spl-token-bankrun";
import BN from "bn.js";
import { getPerformancePackageAddr, Tranche } from "@metadaoproject/futarchy/v0.6";
import { expectError } from "../../utils.js";

export default function () {
  let createKey: Keypair;
  let tokenMint: PublicKey;
  let tokenAuthority: Keypair;
  let tokenAccount: PublicKey;
  let recipient: Keypair;
  let performancePackage: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    // Create test accounts
    createKey = Keypair.generate();
    tokenAuthority = Keypair.generate();
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();

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
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);

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

    performancePackage = getPerformancePackageAddr({
      createKey: createKey.publicKey,
    })[0];
  });

  it("should initialize a performance package successfully", async function () {
    let tranches: Tranche[] = [
      {
        priceThreshold: new BN(1000000),
        tokenAmount: new BN(100000),
      },
      {
        priceThreshold: new BN(2000000),
        tokenAmount: new BN(200000),
      }
    ]
    const params = {
      tranches,
      grantee: recipient.publicKey,
      performancePackageAuthority: this.payer.publicKey,
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ), // 1 hour from now
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300), // 5 minutes
      tokenRecipient: recipient.publicKey,
    };

    const tx = await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        grantorTokenAccount: tokenAccount,
        grantor: tokenAuthority.publicKey,
      })
      .transaction();

    tx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    tx.sign(createKey, this.payer, tokenAuthority);
    await this.banksClient.processTransaction(tx);

    // Verify performance package was created
    const storedPerformancePackage = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
    assert.equal(storedPerformancePackage.tranches[0].priceThreshold.toString(), "1000000");
    assert.equal(storedPerformancePackage.tranches[0].tokenAmount.toString(), "100000");
    assert.equal(storedPerformancePackage.tranches[1].priceThreshold.toString(), "2000000");
    assert.equal(storedPerformancePackage.tranches[1].tokenAmount.toString(), "200000");
    assert.equal(
      storedPerformancePackage.unlockTimestamp.toString(),
      params.unlockTimestamp.toString()
    );
    assert.equal(
      storedPerformancePackage.oracleConfig.oracleAccount.toString(),
      oracleAccount.publicKey.toString()
    );
    assert.equal(storedPerformancePackage.oracleConfig.byteOffset, 0);
    assert.equal(storedPerformancePackage.twapLengthSeconds.toString(), "300");
    assert.equal(
      storedPerformancePackage.recipient.toString(),
      recipient.publicKey.toString()
    );
    assert.equal(
      storedPerformancePackage.performancePackageAuthority.toString(),
      this.payer.publicKey.toString()
    );
    assert.equal(
      storedPerformancePackage.tokenMint.toString(),
      tokenMint.toString()
    );
    assert.exists(storedPerformancePackage.state.locked);

    // Verify tokens were transferred
    const storedPerformancePackageTokenAccount = await getAccount(this.banksClient, storedPerformancePackage.performancePackageTokenVault);
    assert.equal(storedPerformancePackageTokenAccount.amount.toString(), "300000");

    const authorityBalance = await this.getTokenBalance(
      tokenMint,
      tokenAuthority.publicKey
    );
    assert.equal(authorityBalance.toString(), "700000"); // 1000000 - 100000 - 200000
  });

  it("should fail if unlock timestamp is in the past", async function () {
    const pastCreateKey = Keypair.generate();
    
    // Fund the pastCreateKey with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: pastCreateKey.publicKey,
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
      performancePackageAuthority: this.payer.publicKey,
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) - 3600
      ), // 1 hour ago
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    try {
      const tx = await this.priceBasedPerformancePackage
        .initializePerformancePackageIx({
          params,
          createKey: pastCreateKey.publicKey,
          tokenMint,
          grantor: tokenAuthority.publicKey,
        })
        .transaction();

      tx.recentBlockhash = (
        await this.context.banksClient.getLatestBlockhash()
      )[0];
      tx.sign(pastCreateKey, this.payer, tokenAuthority);
      await this.banksClient.processTransaction(tx);
      assert.fail("Expected transaction to fail");
    } catch (error) {
      assert.include(error.message.toLowerCase(), "0x1771");
    }
  });

  it("should fail if token amount is zero", async function () {
    const zeroCreateKey = Keypair.generate();
    
    // Fund the zeroCreateKey with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: zeroCreateKey.publicKey,
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
          tokenAmount: new BN(0),
        }
      ],
      grantee: recipient.publicKey,
      performancePackageAuthority: this.payer.publicKey,
      unlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) + 3600
      ),
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: new BN(300),
      tokenRecipient: recipient.publicKey,
    };

    const callbacks = expectError("TrancheTokenAmountZero", "Tranche token amount must be greater than 0");

    await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params,
        createKey: zeroCreateKey.publicKey,
        tokenMint,
        grantor: tokenAuthority.publicKey,
      })
      .signers([zeroCreateKey, tokenAuthority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
