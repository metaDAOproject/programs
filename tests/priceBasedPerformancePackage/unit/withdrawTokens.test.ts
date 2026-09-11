import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { ACCOUNT_SIZE, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { expectError } from "../../utils.js";
import { runUnlockCycle, setMockOracle } from "../utils.js";

const TRANCHE_AMOUNT = 100 * 10 ** 6;
const TOTAL_AMOUNT = 2 * TRANCHE_AMOUNT;

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let rentPayer: Keypair;
  let performancePackage: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    recipient = Keypair.generate();
    rentPayer = Keypair.generate();
    oracleAccount = Keypair.generate();

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
    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      TOTAL_AMOUNT,
    );

    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: oracleAccount.publicKey,
      recipient: recipient.publicKey,
    });

    // Move past the one-second cliff
    await this.advanceBySeconds(2);
  });

  // Unlocks the first tranche, leaving TRANCHE_AMOUNT withdrawable.
  async function unlockFirstTranche(ctx: Mocha.Context) {
    await runUnlockCycle(ctx, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(1e12),
    });
  }

  function withdrawTokensIx(
    ctx: Mocha.Context,
    amount: number,
    overrides: { recipient?: PublicKey; payer?: PublicKey } = {},
  ) {
    return ctx.priceBasedPerformancePackage.withdrawTokensIx({
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      tokenMint,
      recipient: overrides.recipient ?? recipient.publicKey,
      payer: overrides.payer,
      amount: new BN(amount),
    });
  }

  it("delivers the whole withdrawable balance and creates the recipient's ATA at the payer's expense", async function () {
    await unlockFirstTranche(this);

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey,
    );
    assert.isNull(await this.banksClient.getAccount(recipientTokenAccount));

    const seqNumBefore = (
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      )
    ).seqNum.toNumber();
    const rentPayerBefore = await this.banksClient.getBalance(
      rentPayer.publicKey,
    );

    await withdrawTokensIx(this, TRANCHE_AMOUNT, {
      payer: rentPayer.publicKey,
    })
      .signers([recipient, rentPayer])
      .rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TRANCHE_AMOUNT),
    );

    const storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(storedPackage.seqNum.toNumber(), seqNumBefore + 1);
    assert.equal(
      storedPackage.alreadyUnlockedAmount.toString(),
      TRANCHE_AMOUNT.toString(),
    );

    const rent = await this.banksClient.getRent();
    assert.equal(
      rentPayerBefore -
        (await this.banksClient.getBalance(rentPayer.publicKey)),
      rent.minimumBalance(BigInt(ACCOUNT_SIZE)),
    );
  });

  it("delivers part of the balance and then the rest", async function () {
    await unlockFirstTranche(this);

    await withdrawTokensIx(this, 40 * 10 ** 6)
      .signers([recipient])
      .rpc();
    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(40 * 10 ** 6),
    );

    await withdrawTokensIx(this, 60 * 10 ** 6)
      .signers([recipient])
      .rpc();
    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TOTAL_AMOUNT - TRANCHE_AMOUNT),
    );
  });

  it("rejects one atom more than the withdrawable balance", async function () {
    await unlockFirstTranche(this);

    const callbacks = expectError(
      "InsufficientWithdrawableBalance",
      "withdrew more than the unlocked amount",
    );

    await withdrawTokensIx(this, TRANCHE_AMOUNT + 1)
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);

    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TOTAL_AMOUNT),
    );
  });

  it("rejects any amount while nothing is unlocked", async function () {
    const callbacks = expectError(
      "InsufficientWithdrawableBalance",
      "withdrew from a package with nothing unlocked",
    );

    await withdrawTokensIx(this, 1)
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a zero amount", async function () {
    await unlockFirstTranche(this);

    const callbacks = expectError("RequireGtViolated", "withdrew zero tokens");

    await withdrawTokensIx(this, 0)
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a signer other than the recipient", async function () {
    await unlockFirstTranche(this);
    const other = Keypair.generate();

    const callbacks = expectError(
      "ConstraintHasOne",
      "a non-recipient withdrew tokens",
    );

    await withdrawTokensIx(this, TRANCHE_AMOUNT, { recipient: other.publicKey })
      .signers([other])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("is allowed while the package is unlocking", async function () {
    await unlockFirstTranche(this);

    await setMockOracle(this, oracleAccount.publicKey, {
      aggregator: BigInt(1e12),
    });
    await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await withdrawTokensIx(this, TRANCHE_AMOUNT).signers([recipient]).rpc();

    const storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isDefined(storedPackage.state.unlocking);
    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
  });
}
