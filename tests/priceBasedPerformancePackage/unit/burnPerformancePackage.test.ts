import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import { mintTo, getAccount } from "spl-token-bankrun";
import BN from "bn.js";
import {
  getPerformancePackageAddr,
  Tranche,
} from "@metadaoproject/futarchy/v0.6";
import { expectError } from "../../utils.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

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
      }),
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
      tokenAuthority.publicKey,
    );

    // Mint some tokens to the token account
    await mintTo(
      this.context.banksClient,
      this.payer,
      tokenMint,
      tokenAccount,
      tokenAuthority,
      1000000,
    );

    performancePackage = getPerformancePackageAddr({
      createKey: createKey.publicKey,
    })[0];

    let tranches: Tranche[] = [
      {
        priceThreshold: new BN(1000000),
        tokenAmount: new BN(100000),
      },
      {
        priceThreshold: new BN(2000000),
        tokenAmount: new BN(200000),
      },
    ];
    const params = {
      tranches,
      grantee: recipient.publicKey,
      performancePackageAuthority: this.payer.publicKey,
      minUnlockTimestamp: new BN(
        Number((await this.context.banksClient.getClock()).unixTimestamp) +
          3600,
      ), // 1 hour from now
      oracleConfig: {
        oracleAccount: oracleAccount.publicKey,
        byteOffset: 0,
      },
      twapLengthSeconds: 86_400, // 1 day
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
  });

  it.only("should burn a performance package successfully", async function () {
    const performancePackageTokenVault = await getAssociatedTokenAddress(
      tokenMint,
      performancePackage,
      true,
    );

    // Confirm that the performance package and token vault accounts are not closed... yet
    let performancePackageAccount =
      await this.banksClient.getAccount(performancePackage);
    assert.isNotNull(performancePackageAccount);

    let performancePackageTokenVaultAccount = await this.banksClient.getAccount(
      performancePackageTokenVault,
    );
    assert.isNotNull(performancePackageTokenVaultAccount);

    // Burn the performance package
    await this.priceBasedPerformancePackage.program.methods
      .burnPerformancePackage()
      .accounts({
        performancePackage,
        performancePackageTokenVault,
        tokenMint,
        spillAccount: this.payer.publicKey,
        admin: this.payer.publicKey, // This should be the MetaDAO operational multisig vault in production
      })
      .rpc();

    // Confirm that the performance package and token vault accounts are closed
    performancePackageAccount =
      await this.banksClient.getAccount(performancePackage);
    assert.isNull(performancePackageAccount);

    performancePackageTokenVaultAccount = await this.banksClient.getAccount(
      performancePackageTokenVault,
    );
    assert.isNull(performancePackageTokenVaultAccount);
  });
}
