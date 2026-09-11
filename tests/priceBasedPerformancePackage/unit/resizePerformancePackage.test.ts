import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
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

  // Writes a 24-byte mock oracle: aggregator u128 at 0, last updated timestamp i64 at 16.
  async function setOracle(ctx: Mocha.Context, aggregator: bigint) {
    const data = Buffer.alloc(24);
    data.writeBigUInt64LE(aggregator, 0);
    data.writeBigInt64LE(
      BigInt((await ctx.banksClient.getClock()).unixTimestamp),
      16,
    );
    ctx.context.setAccount(oracleAccount.publicKey, {
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1_000_000_000,
      data,
    });
  }

  // Runs the instruction against a truncated package, expects AccountNotMigrated,
  // then resizes the package and runs the same instruction again.
  async function assertGatedUntilResized(
    ctx: Mocha.Context,
    buildIx: () => any,
    signers: Keypair[] = [],
  ) {
    await writeOldLayoutPackage(ctx, performancePackage);

    const callbacks = expectError(
      "AccountNotMigrated",
      "ran an instruction against a truncated package",
    );
    await buildIx().signers(signers).rpc().then(callbacks[0], callbacks[1]);

    await ctx.priceBasedPerformancePackage
      .resizePerformancePackageIx({
        performancePackage,
        payer: ctx.payer.publicKey,
      })
      .rpc();

    await buildIx()
      .preInstructions([
        // A different compute-unit price makes the transaction hash unique so the
        // retry is not rejected as already processed.
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers(signers)
      .rpc();
  }

  it("gates start_unlock until the package is resized", async function () {
    await this.advanceBySeconds(2);
    await setOracle(this, BigInt(1e12));

    await assertGatedUntilResized(
      this,
      () =>
        this.priceBasedPerformancePackage.startUnlockIx({
          performancePackage,
          oracleAccount: oracleAccount.publicKey,
          recipient: recipient.publicKey,
        }),
      [recipient],
    );

    const after =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isDefined(after.state.unlocking);
  });

  it("gates complete_unlock until the package is resized", async function () {
    await this.advanceBySeconds(2);
    await setOracle(this, BigInt(1e12));
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await this.advanceBySeconds(86_400);
    await setOracle(this, BigInt(2 * 86_400 + 1) * BigInt(1e12));

    await assertGatedUntilResized(this, () =>
      this.priceBasedPerformancePackage.completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        tokenRecipient: recipient.publicKey,
      }),
    );

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(200 * 10 ** 6),
    );
  });

  it("gates propose_change until the package is resized", async function () {
    const newRecipient = Keypair.generate();
    const pdaNonce = 1;

    await assertGatedUntilResized(
      this,
      () =>
        this.priceBasedPerformancePackage.proposeChangeIx({
          performancePackage,
          proposer: recipient.publicKey,
          params: {
            changeType: {
              recipient: { newRecipient: newRecipient.publicKey },
            },
            pdaNonce,
          },
        }),
      [recipient],
    );

    const changeRequest =
      await this.priceBasedPerformancePackage.getChangeRequest(
        this.priceBasedPerformancePackage.getChangeRequestAddress(
          performancePackage,
          recipient.publicKey,
          pdaNonce,
        ),
      );
    assert.equal(
      changeRequest.performancePackage.toString(),
      performancePackage.toString(),
    );
  });

  it("gates execute_change until the package is resized", async function () {
    const newRecipient = Keypair.generate();
    const pdaNonce = 1;
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        performancePackage,
        proposer: recipient.publicKey,
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce,
        },
      })
      .signers([recipient])
      .rpc();
    const changeRequest =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );

    await assertGatedUntilResized(this, () =>
      this.priceBasedPerformancePackage.executeChangeIx({
        performancePackage,
        changeRequest,
        executor: this.payer.publicKey,
      }),
    );

    const after =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(after.recipient.toString(), newRecipient.publicKey.toString());
    assert.isNull(await this.banksClient.getAccount(changeRequest));
  });

  it("gates change_performance_package_authority until the package is resized", async function () {
    const newAuthority = Keypair.generate();

    await assertGatedUntilResized(this, () =>
      this.priceBasedPerformancePackage.changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: this.payer.publicKey,
        newPerformancePackageAuthority: newAuthority.publicKey,
      }),
    );

    const after =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(
      after.performancePackageAuthority.toString(),
      newAuthority.publicKey.toString(),
    );
  });

  it("gates burn_performance_package until the package is resized", async function () {
    await assertGatedUntilResized(this, () =>
      this.priceBasedPerformancePackage.program.methods
        .burnPerformancePackage()
        .accounts({
          performancePackage,
          performancePackageTokenVault: getAssociatedTokenAddressSync(
            tokenMint,
            performancePackage,
            true,
          ),
          tokenMint,
          spillAccount: this.payer.publicKey,
          admin: this.payer.publicKey,
        }),
    );

    assert.isNull(await this.banksClient.getAccount(performancePackage));
  });
}
