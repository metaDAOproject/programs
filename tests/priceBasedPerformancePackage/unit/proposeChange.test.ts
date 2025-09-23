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
    const currentSlot = await this.context.banksClient
      .getClock()
      .then((c) => c.slot);
    mockOracleData.writeBigUInt64LE(BigInt(currentSlot), 16);

    // Set oracle account data
    await this.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1000000000,
      data: mockOracleData,
    });

    // Create token mint and accounts
    tokenMint = await this.createMint(tokenAuthority, 6);
    tokenAccount = await this.createTokenAccount(tokenMint, tokenAuthority);

    await this.mintTo(tokenMint, tokenAuthority, this.payer, 200 * 10 ** 6); // 1M tokens

    performancePackage = await this.setupBasicPerformancePackage({ tokenMint, oracleAccount: oracleAccount.publicKey, recipient: recipient.publicKey });
  });

  it("should allow recipient to propose a change (recipient → performancePackage authority execution flow)", async function () {
    // Fund the newRecipient with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: newRecipient.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundingTx.recentBlockhash = (
      await this.context.banksClient.getLatestBlockhash()
    )[0];
    fundingTx.sign(this.payer);
    await this.banksClient.processTransaction(fundingTx);

    const pdaNonce = Math.floor(Math.random() * 1000000);

    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce: pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey, // Recipient proposes
      })
      .signers([recipient])
      .rpc();


    // Verify change request was created with correct proposer
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      recipient.publicKey,
      pdaNonce
    );
    const changeRequest = await this.priceBasedPerformancePackage.getChangeRequest(
      changeRequestAddr
    );
    
    // Verify the change request was created correctly
    assert.exists(changeRequest.proposerType.recipient);
    assert.equal(changeRequest.performancePackage.toString(), performancePackage.toString());
    assert.equal(
      changeRequest.changeType.recipient.newRecipient.toString(),
      newRecipient.publicKey.toString()
    );
  });

  it("should allow performancePackage authority to propose a change (performancePackage authority → recipient execution flow)", async function () {
    const pdaNonce = Math.floor(Math.random() * 1000000);

    const newOracleAccount = Keypair.generate();

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
          pdaNonce: pdaNonce,
        },
        performancePackage,
        proposer: this.payer.publicKey,
      })
      .rpc();

    // Verify performancePackage state remains Locked (no more PendingChange state)
    const performancePackageAccount = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);
    // console.log("Authority proposal test - proposer:", squadsMultisigVault.publicKey.toString().slice(0, 8));
    // console.log("State remains: Locked (no PendingChange state)");
    assert.equal(performancePackageAccount.state.locked !== undefined, true);

    // Verify change request was created with correct proposer
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      this.payer.publicKey,
      pdaNonce
    );
    const changeRequest = await this.priceBasedPerformancePackage.getChangeRequest(
      changeRequestAddr
    );

    assert.exists(changeRequest.proposerType.authority);
    assert.equal(changeRequest.performancePackage.toString(), performancePackage.toString());
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString(), newOracleAccount.publicKey.toString());
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.byteOffset, 16);
  });

  it("should fail if unauthorized party tries to propose change", async function () {
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


    const callbacks = expectError("UnauthorizedChangeRequest", "Unauthorized change request");

    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce: Math.floor(Math.random() * 1000000),
        },
        performancePackage,
        proposer: unauthorizedWallet.publicKey, // Neither recipient nor authority
      })
      .signers([unauthorizedWallet])
      .rpc().then(callbacks[0], callbacks[1]);
  });

  it("should propose an oracle change successfully", async function () {
    const newOracleAccount = Keypair.generate();
    const pdaNonce = Math.floor(Math.random() * 1000000);

    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            oracle: {
              newOracleConfig: {
                oracleAccount: newOracleAccount.publicKey,
                byteOffset: 8,
              },
            },
          },
          pdaNonce: pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify change request
    const changeRequestAddr = this.priceBasedPerformancePackage.getChangeRequestAddress(
      performancePackage,
      recipient.publicKey,
      pdaNonce
    );
    const changeRequest = await this.priceBasedPerformancePackage.getChangeRequest(
      changeRequestAddr
    );
    const performancePackageAccount = await this.priceBasedPerformancePackage.getPerformancePackage(performancePackage);

    assert.equal(
      changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString()
    );
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.byteOffset, 8);
  });
}
