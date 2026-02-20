import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { expectError } from "../../utils.js";

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

    tokenMint = await this.createMint(tokenAuthority, 6);
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority);

    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      200 * 10 ** 6,
    ); // 1M tokens

    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: oracleAccount.publicKey,
      recipient: recipient.publicKey,
    });
  });

  it("should change performance package authority successfully", async function () {
    // Verify initial authority
    const initialPerformancePackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(
      initialPerformancePackage.performancePackageAuthority.toString(),
      this.payer.publicKey.toString(),
    );

    // Change the performancePackage authority
    await this.priceBasedPerformancePackage
      .changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: this.payer.publicKey,
        newPerformancePackageAuthority: newAuthority.publicKey,
      })
      .rpc();

    // Verify authority was changed
    const updatedPerformancePackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(
      updatedPerformancePackage.performancePackageAuthority.toString(),
      newAuthority.publicKey.toString(),
    );

    // verify new authority can propose a change
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        performancePackage,
        proposer: newAuthority.publicKey,
        params: {
          changeType: {
            recipient: { newRecipient: recipient.publicKey },
          },
          pdaNonce: Math.floor(Math.random() * 1000000),
        },
      })
      .signers([newAuthority])
      .rpc();
  });

  it("should fail if new authority equals current recipient", async function () {
    const callbacks = expectError(
      "RecipientAuthorityMustDiffer",
      "Recipient and performance package authority must be different keys",
    );

    await this.priceBasedPerformancePackage
      .changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: this.payer.publicKey,
        newPerformancePackageAuthority: recipient.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if unauthorized party tries to change authority", async function () {
    const unauthorizedWallet = Keypair.generate();

    // Fund the unauthorized wallet
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: unauthorizedWallet.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
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
}
