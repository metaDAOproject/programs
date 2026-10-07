import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { runUnlockCycle, setMockOracle } from "../utils.js";

const TRANCHE_AMOUNT = 100 * 10 ** 6;
const TOTAL_AMOUNT = 2 * TRANCHE_AMOUNT;

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let performancePackage: PublicKey;
  let oracleAccount: Keypair;

  beforeEach(async function () {
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();

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

  it("unlocks every tranche the TWAP clears and leaves the tokens in the vault", async function () {
    await runUnlockCycle(this, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(2e12),
    });

    const storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    for (const tranche of storedPackage.tranches) {
      assert.isTrue(tranche.isUnlocked);
    }
    assert.equal(
      storedPackage.alreadyUnlockedAmount.toString(),
      TOTAL_AMOUNT.toString(),
    );
    assert.equal(storedPackage.seqNum.toNumber(), 2);
    assert.exists(storedPackage.state.locked);

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      0n,
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TOTAL_AMOUNT),
    );
  });

  it("leaves a withdrawable balance equal to the unlocked amount", async function () {
    await runUnlockCycle(this, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(1e12),
    });

    const storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    const vaultBalance = await this.getTokenBalance(
      tokenMint,
      performancePackage,
    );
    const locked =
      BigInt(storedPackage.totalTokenAmount.toString()) -
      BigInt(storedPackage.alreadyUnlockedAmount.toString());
    assert.equal(vaultBalance - locked, BigInt(TRANCHE_AMOUNT));

    await this.priceBasedPerformancePackage
      .withdrawTokensIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        recipient: recipient.publicKey,
        amount: new BN(TRANCHE_AMOUNT),
      })
      .signers([recipient])
      .rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TRANCHE_AMOUNT),
    );
  });

  it("unlocks the first tranche, then the second in a later cycle", async function () {
    await runUnlockCycle(this, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(1e12),
    });

    let storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isTrue(storedPackage.tranches[0].isUnlocked);
    assert.isFalse(storedPackage.tranches[1].isUnlocked);
    assert.equal(
      storedPackage.alreadyUnlockedAmount.toString(),
      TRANCHE_AMOUNT.toString(),
    );
    assert.exists(storedPackage.state.locked);

    await this.priceBasedPerformancePackage
      .withdrawTokensIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        recipient: recipient.publicKey,
        amount: new BN(TRANCHE_AMOUNT),
      })
      .signers([recipient])
      .rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TRANCHE_AMOUNT),
    );

    await this.advanceBySeconds(1000);
    await runUnlockCycle(this, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(2e12),
    });

    storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isTrue(storedPackage.tranches[0].isUnlocked);
    assert.isTrue(storedPackage.tranches[1].isUnlocked);
    assert.equal(
      storedPackage.alreadyUnlockedAmount.toString(),
      TOTAL_AMOUNT.toString(),
    );
    assert.exists(storedPackage.state.locked);

    await this.priceBasedPerformancePackage
      .withdrawTokensIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        tokenMint,
        recipient: recipient.publicKey,
        amount: new BN(TRANCHE_AMOUNT),
      })
      .signers([recipient])
      .rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TOTAL_AMOUNT),
    );
    assert.equal(await this.getTokenBalance(tokenMint, performancePackage), 0n);
  });

  it("changes only the state and sequence number when the TWAP clears nothing", async function () {
    await runUnlockCycle(this, {
      performancePackage,
      oracleAccount: oracleAccount.publicKey,
      recipient,
      twapPrice: BigInt(0.5e12),
    });

    const storedPackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isFalse(storedPackage.tranches[0].isUnlocked);
    assert.isFalse(storedPackage.tranches[1].isUnlocked);
    assert.equal(storedPackage.alreadyUnlockedAmount.toNumber(), 0);
    assert.equal(storedPackage.seqNum.toNumber(), 2);
    assert.exists(storedPackage.state.locked);
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(TOTAL_AMOUNT),
    );
  });

  it("should fail if performancePackage is not in Unlocking state", async function () {
    const callbacks = expectError(
      "InvalidPerformancePackageState",
      "PerformancePackage is not in Unlocking state",
    );

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if TWAP calculation period has not elapsed", async function () {
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

    await this.advanceBySeconds(5);

    const callbacks = expectError(
      "TwapPeriodNotElapsed",
      "TWAP calculation period has not elapsed",
    );

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
