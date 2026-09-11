import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { expectError } from "../../utils.js";
import { writeOldLayoutPackage } from "../utils.js";

const OLD_SIZE = 520;
const NEW_SIZE = 582;

// Plain JSON view of a fetched package so two snapshots can be deep-compared.
const snapshot = (performancePackage: any) =>
  JSON.parse(JSON.stringify(performancePackage));

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let oracleAccount: Keypair;
  let rentPayer: Keypair;
  let performancePackage: PublicKey;

  beforeEach(async function () {
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    rentPayer = Keypair.generate();

    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: rentPayer.publicKey,
        lamports: 1_000_000_000,
      }),
    );
    fundTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundTx.sign(this.payer);
    await this.banksClient.processTransaction(fundTx);

    tokenMint = await this.createMint(this.payer.publicKey, 6);
    await this.createTokenAccount(tokenMint, this.payer.publicKey);
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
  });

  it("restores the current layout from an old-layout package", async function () {
    const before =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    await writeOldLayoutPackage(this, performancePackage);
    const truncated = await this.banksClient.getAccount(performancePackage);
    assert.equal(truncated.data.length, OLD_SIZE);

    const rent = await this.banksClient.getRent();
    const rentPayerBefore = await this.banksClient.getBalance(
      rentPayer.publicKey,
    );

    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage,
        payer: rentPayer.publicKey,
      })
      .signers([rentPayer])
      .rpc();

    const resized = await this.banksClient.getAccount(performancePackage);
    assert.equal(resized.data.length, NEW_SIZE);
    assert.equal(
      BigInt(resized.lamports),
      rent.minimumBalance(BigInt(NEW_SIZE)),
    );

    const rentPayerAfter = await this.banksClient.getBalance(
      rentPayer.publicKey,
    );
    assert.equal(
      rentPayerBefore - rentPayerAfter,
      rent.minimumBalance(BigInt(NEW_SIZE)) -
        rent.minimumBalance(BigInt(OLD_SIZE)),
    );

    const after =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isNull(after.withdrawalPolicy);
    assert.deepEqual(snapshot(after), snapshot(before));
  });

  it("is a no-op on a package that is already resized", async function () {
    await writeOldLayoutPackage(this, performancePackage);
    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage,
        payer: this.payer.publicKey,
      })
      .rpc();

    const before =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    const lamportsBefore = (
      await this.banksClient.getAccount(performancePackage)
    ).lamports;
    const rentPayerBefore = await this.banksClient.getBalance(
      rentPayer.publicKey,
    );

    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage,
        payer: rentPayer.publicKey,
      })
      .signers([rentPayer])
      .rpc();

    const account = await this.banksClient.getAccount(performancePackage);
    assert.equal(account.data.length, NEW_SIZE);
    assert.equal(account.lamports, lamportsBefore);
    assert.equal(
      await this.banksClient.getBalance(rentPayer.publicKey),
      rentPayerBefore,
    );

    const after =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.deepEqual(snapshot(after), snapshot(before));
  });

  it("rejects an account owned by another program", async function () {
    const vault = getAssociatedTokenAddressSync(
      tokenMint,
      performancePackage,
      true,
    );

    const callbacks = expectError(
      "AccountOwnedByWrongProgram",
      "resized an account owned by another program",
    );

    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage: vault,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects an account of this program with another discriminator", async function () {
    const pdaNonce = 1;
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        performancePackage,
        proposer: this.payer.publicKey,
        params: {
          changeType: {
            recipient: { newRecipient: Keypair.generate().publicKey },
          },
          pdaNonce,
        },
      })
      .rpc();
    const changeRequest =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey,
        pdaNonce,
      );

    const callbacks = expectError(
      "AccountDiscriminatorMismatch",
      "resized a change request",
    );

    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage: changeRequest,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a package whose size is neither the old nor the current layout", async function () {
    const account = await this.banksClient.getAccount(performancePackage);
    this.context.setAccount(performancePackage, {
      ...account,
      data: account.data.slice(0, 500),
    });

    const callbacks = expectError(
      "AccountDidNotDeserialize",
      "resized a package of unknown size",
    );

    await this.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("creates new packages at the current size", async function () {
    const account = await this.banksClient.getAccount(performancePackage);
    assert.equal(account.data.length, NEW_SIZE);

    const storedPerformancePackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isNull(storedPerformancePackage.withdrawalPolicy);
  });
}
