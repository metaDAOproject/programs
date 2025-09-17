import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
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
  let newRecipient: Keypair;
  let performancePackage: PublicKey;
  let performancePackageTokenAccount: PublicKey;
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

    tokenMint = await this.createMint(tokenAuthority, 6);

    await this.mintTo(tokenMint, this.payer.publicKey, this.payer, 200 * 10 ** 6);
    performancePackage = await this.setupBasicPerformancePackage({ tokenMint, oracleAccount: oracleAccount.publicKey, recipient: recipient.publicKey });
  });

  it("should execute change when recipient proposed and authority executes", async function () {
    // Generate a fresh pdaNonce for this test
    const pdaNonce = Math.floor(Math.random() * 1000000);


    // First, recipient proposes the change
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce: pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Now DAO executes the change after governance approval
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      recipient.publicKey,
      pdaNonce
    );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: this.payer.publicKey, // DAO executes
      })
      .rpc();

    // Verify the change was applied
    const performancePackageAccount = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);

    assert.equal(
      performancePackageAccount.recipient.toString(),
      newRecipient.publicKey.toString()
    );
    assert.equal(performancePackageAccount.state.locked !== undefined, true); // Should be back to Locked state

    // Verify change request account was closed
    try {
      await this.priceBasedPerformancePackage.getChangeRequest(changeRequestAddr);
      assert.fail("Change request should have been closed");
    } catch (error) {
      // console.log("Change request account properly closed");
      // Expected - account should be closed
    }
  });

  it("should execute change when authority proposed and recipient executes", async function () {
    const pdaNonce2 = Math.floor(Math.random() * 1000000);
    const newOracleAccount = Keypair.generate();

    // First, performancePackage authority proposes the change
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            oracle: {
              newOracleConfig: {
                oracleAccount: newOracleAccount.publicKey,
                byteOffset: 16,
              },
            },
          },
          pdaNonce: pdaNonce2,
        },
        performancePackage,
        proposer: this.payer.publicKey, // Authority proposes
      })
      .rpc();

    // Now recipient executes the change
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      this.payer.publicKey,
      pdaNonce2
    );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: recipient.publicKey, // Recipient executes
      })
      .signers([recipient])
      .rpc();

    // Verify the change was applied
    const performancePackageAccount = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
    // console.log("Authority proposed -> Recipient executed");
    // console.log("Oracle change applied correctly:", performancePackageAccount.oracleConfig.oracleAccount.toString() === newOracleAccount.publicKey.toString());
    // console.log("Byte offset applied correctly:", performancePackageAccount.oracleConfig.byteOffset === 16);

    assert.equal(
      performancePackageAccount.oracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString()
    );
    assert.equal(performancePackageAccount.oracleConfig.byteOffset, 16);
    assert.equal(performancePackageAccount.state.locked !== undefined, true); // Should be back to Locked state
  });

  it("should fail if wrong vault tries to execute", async function () {
    // Recipient proposes change (correct pattern)
    const pdaNonce4 = Math.floor(Math.random() * 1000000);
    const proposeTx = await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce: pdaNonce4,
        },
        performancePackage,
        proposer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      recipient.publicKey,
      pdaNonce4
    );

    const callbacks = expectError("UnauthorizedLockerAuthority", "Unauthorized locker authority");

    const wrongVault = Keypair.generate();

    const executeTx = await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: wrongVault.publicKey,
      })
      .signers([wrongVault])
      .rpc().then(callbacks[0], callbacks[1]);
  });

  it("should fail if recipient tries to execute their own proposal", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey5 = Keypair.generate();
    const pdaNonce7 = Math.floor(Math.random() * 1000000);

    // console.log("Self-execution rejection test");

    // First, recipient proposes a change
    const proposeTx = await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce: pdaNonce7,
        },
        performancePackage,
        proposer: recipient.publicKey, // Recipient proposes
      })
      .signers([recipient])
      .rpc();

    // console.log("Recipient proposal successful");

    // Now try to execute with same recipient (should fail)
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      recipient.publicKey,
      pdaNonce7
    );

    const callbacks = expectError("UnauthorizedLockerAuthority", "Unauthorized change request");

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: recipient.publicKey, // Same as proposer - should fail
      })
      .signers([recipient])
      .rpc().then(callbacks[0], callbacks[1]);
  });

  it("should fail if authority tries to execute their own proposal", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey6 = Keypair.generate();
    const pdaNonce8 = Math.floor(Math.random() * 1000000);

    // console.log("Authority self-execution rejection test");

    // First, authority proposes a change
    const proposeTx = await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            oracle: {
              newOracleConfig: {
                oracleAccount: Keypair.generate().publicKey,
                byteOffset: 32,
              },
            },
          },
          pdaNonce: pdaNonce8,
        },
        performancePackage,
        proposer: this.payer.publicKey, // Authority proposes
      })
      .rpc();

    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      this.payer.publicKey,
      pdaNonce8
    );

    const callbacks = expectError("UnauthorizedChangeRequest", "Unauthorized change request");

      await this.priceBasedPerformancePackage
        .executeChangeIx({
          performancePackage,
          changeRequest: changeRequestAddr,
          executor: this.payer.publicKey, // Same as proposer - should fail
        })
        .rpc().then(callbacks[0], callbacks[1]);
  });
}
