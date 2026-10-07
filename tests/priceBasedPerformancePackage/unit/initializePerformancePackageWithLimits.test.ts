import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import {
  getPerformancePackageAddr,
  InitializePerformancePackageParams,
  InitializePerformancePackageWithLimitsParams,
  LimitsParams,
  PriceBasedPerformancePackageClient,
} from "@metadaoproject/programs";
import { expectError } from "../../utils.js";

const TRANCHE_AMOUNT = 100 * 10 ** 6;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const ONE_YEAR = 365 * 24 * 60 * 60;
const INVALID_LIMITS_MESSAGE =
  "Withdrawal limits must have non-zero caps, a future end, and a window of at least one second";

type StoredPackage = Awaited<
  ReturnType<PriceBasedPerformancePackageClient["getPerformancePackage"]>
>;

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let oracleAccount: Keypair;
  let now: number;
  let base: InitializePerformancePackageParams;
  let limits: LimitsParams;

  beforeEach(async function () {
    recipient = Keypair.generate();
    oracleAccount = Keypair.generate();
    tokenMint = await this.createMint(this.payer.publicKey, 6);
    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      10 * TRANCHE_AMOUNT,
    );

    now = Number((await this.banksClient.getClock()).unixTimestamp);
    base = {
      tranches: [
        { priceThreshold: new BN(1e12), tokenAmount: new BN(TRANCHE_AMOUNT) },
        { priceThreshold: new BN(2e12), tokenAmount: new BN(TRANCHE_AMOUNT) },
      ],
      grantee: recipient.publicKey,
      performancePackageAuthority: this.payer.publicKey,
      minUnlockTimestamp: new BN(now + THIRTY_DAYS),
      oracleConfig: { oracleAccount: oracleAccount.publicKey, byteOffset: 0 },
      twapLengthSeconds: 24 * 60 * 60,
    };
    limits = {
      endTimestamp: new BN(now + ONE_YEAR),
      windowSeconds: THIRTY_DAYS,
      maxTokensPerWindow: new BN(50 * 10 ** 6),
      maxQuotePerWindow: new BN(1_000 * 10 ** 6),
      withdrawalMode: { both: {} },
    };
  });

  // Builds the instruction under a fresh create key and returns the package it creates.
  function initializeWithLimitsIx(
    ctx: Mocha.Context,
    params: InitializePerformancePackageWithLimitsParams,
  ) {
    const createKey = Keypair.generate();
    const builder = ctx.priceBasedPerformancePackage
      .initializePerformancePackageWithLimitsIx({
        params,
        createKey: createKey.publicKey,
        tokenMint,
        grantor: ctx.payer.publicKey,
      })
      .signers([createKey]);

    return {
      builder,
      performancePackage: getPerformancePackageAddr({
        createKey: createKey.publicKey,
      })[0],
    };
  }

  // Everything the two initialisers must agree on, as plain JSON so BNs and keys compare by value.
  function sharedFields(pkg: StoredPackage) {
    const { createKey, pdaBump, performancePackageTokenVault, ...rest } = pkg;
    return JSON.parse(JSON.stringify(rest));
  }

  it("stores the limits anchored at the creation clock with zero usage", async function () {
    const { builder, performancePackage } = initializeWithLimitsIx(this, {
      base,
      limits,
    });
    await builder.rpc();

    const stored =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    const policy = stored.withdrawalPolicy;
    assert.equal(policy.limits.startTimestamp.toString(), now.toString());
    assert.equal(
      policy.limits.endTimestamp.toString(),
      limits.endTimestamp.toString(),
    );
    assert.equal(policy.limits.windowSeconds, THIRTY_DAYS);
    assert.equal(policy.limits.maxTokensPerWindow.toString(), "50000000");
    assert.equal(policy.limits.maxQuotePerWindow.toString(), "1000000000");
    assert.isDefined(policy.limits.withdrawalMode.both);
    assert.equal(policy.usage.windowIndex.toString(), "0");
    assert.equal(policy.usage.tokensUsed.toString(), "0");
    assert.equal(policy.usage.quoteUsed.toString(), "0");

    assert.equal(stored.recipient.toString(), recipient.publicKey.toString());
    assert.equal(
      stored.performancePackageAuthority.toString(),
      this.payer.publicKey.toString(),
    );
    assert.equal(
      stored.minUnlockTimestamp.toString(),
      base.minUnlockTimestamp.toString(),
    );
    assert.equal(
      stored.totalTokenAmount.toString(),
      (2 * TRANCHE_AMOUNT).toString(),
    );
    assert.equal(stored.alreadyUnlockedAmount.toString(), "0");
    assert.equal(stored.seqNum.toString(), "0");
    assert.isDefined(stored.state.locked);
    assert.equal(
      await this.getTokenBalance(tokenMint, performancePackage),
      BigInt(2 * TRANCHE_AMOUNT),
    );

    const raw = await this.banksClient.getAccount(performancePackage);
    assert.equal(raw.data.length, 582);
  });

  it("stores no policy without limits and otherwise matches the original instruction", async function () {
    const { builder, performancePackage } = initializeWithLimitsIx(this, {
      base,
      limits: null,
    });
    await builder.rpc();

    const legacyCreateKey = Keypair.generate();
    await this.priceBasedPerformancePackage
      .initializePerformancePackageIx({
        params: base,
        createKey: legacyCreateKey.publicKey,
        tokenMint,
        grantor: this.payer.publicKey,
      })
      .signers([legacyCreateKey])
      .rpc();
    const legacyPackage = getPerformancePackageAddr({
      createKey: legacyCreateKey.publicKey,
    })[0];

    const stored =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.isNull(stored.withdrawalPolicy);
    assert.deepEqual(
      sharedFields(stored),
      sharedFields(
        await this.priceBasedPerformancePackage.getPerformancePackage(
          legacyPackage,
        ),
      ),
    );

    const raw = await this.banksClient.getAccount(performancePackage);
    assert.equal(raw.data.length, 582);
  });

  it("rejects a zero token cap", async function () {
    const callbacks = expectError(
      "InvalidWithdrawalLimits",
      INVALID_LIMITS_MESSAGE,
    );

    await initializeWithLimitsIx(this, {
      base,
      limits: { ...limits, maxTokensPerWindow: new BN(0) },
    })
      .builder.rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a zero quote cap", async function () {
    const callbacks = expectError(
      "InvalidWithdrawalLimits",
      INVALID_LIMITS_MESSAGE,
    );

    await initializeWithLimitsIx(this, {
      base,
      limits: { ...limits, maxQuotePerWindow: new BN(0) },
    })
      .builder.rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects an end timestamp at or before now", async function () {
    const callbacks = expectError(
      "InvalidWithdrawalLimits",
      INVALID_LIMITS_MESSAGE,
    );

    await initializeWithLimitsIx(this, {
      base,
      limits: { ...limits, endTimestamp: new BN(now) },
    })
      .builder.rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("rejects a window of zero seconds", async function () {
    const callbacks = expectError(
      "InvalidWithdrawalLimits",
      INVALID_LIMITS_MESSAGE,
    );

    await initializeWithLimitsIx(this, {
      base,
      limits: { ...limits, windowSeconds: 0 },
    })
      .builder.rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("still rejects a grantee equal to the authority", async function () {
    const callbacks = expectError(
      "RecipientAuthorityMustDiffer",
      "Recipient and performance package authority must be different keys",
    );

    await initializeWithLimitsIx(this, {
      base: { ...base, grantee: this.payer.publicKey },
      limits,
    })
      .builder.rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
