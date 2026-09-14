import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { expectError } from "../../utils.js";
import { getChangeRequestAddr, LimitsParams } from "@metadaoproject/programs";
import {
  getActiveWithdrawalPolicy,
  getMaxTokenWithdrawal,
  getSellProceedsEstimate,
} from "@metadaoproject/programs/price_based_performance_package/v0.6/withdrawalLimits";
import {
  runUnlockCycle,
  setMockOracle,
  setupSellablePackage,
  uniqueTxIx,
} from "../utils.js";

const ONE_HOUR = 60 * 60;
const ONE_DAY = 24 * ONE_HOUR;
const THIRTY_DAYS = 30 * ONE_DAY;
const ONE_YEAR = 365 * ONE_DAY;
// At most 645,000 tokens per window; the quote cap is generous so the token cap binds
const TOKEN_CAP = 645_000 * 10 ** 6;
const QUOTE_CAP = 10_000_000 * 10 ** 6;
const PARTIAL_WITHDRAWAL = 300_000 * 10 ** 6;
const NO_USAGE = { windowIndex: "0", tokensUsed: "0", quoteUsed: "0" };

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
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: this.payer.publicKey, // DAO executes
      })
      .rpc();

    // Verify the change was applied
    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(
      performancePackageAccount.recipient.toString(),
      newRecipient.publicKey.toString(),
    );
    assert.equal(performancePackageAccount.state.locked !== undefined, true); // Should be back to Locked state

    // Verify change request account was closed
    try {
      await this.priceBasedPerformancePackage.getChangeRequest(
        changeRequestAddr,
      );
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
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey,
        pdaNonce2,
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
    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    // console.log("Authority proposed -> Recipient executed");
    // console.log("Oracle change applied correctly:", performancePackageAccount.oracleConfig.oracleAccount.toString() === newOracleAccount.publicKey.toString());
    // console.log("Byte offset applied correctly:", performancePackageAccount.oracleConfig.byteOffset === 16);

    assert.equal(
      performancePackageAccount.oracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString(),
    );
    assert.equal(performancePackageAccount.oracleConfig.byteOffset, 16);
    assert.equal(performancePackageAccount.state.locked !== undefined, true); // Should be back to Locked state
  });

  it("should work even if recipient is switched mid-proposal", async function () {
    const pdaNonce3 = Math.floor(Math.random() * 1000000);
    const newOracleAccount = Keypair.generate();
    const newRecipient2 = Keypair.generate();

    // First, current authority proposes an oracle change
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            oracle: {
              newOracleConfig: {
                oracleAccount: newOracleAccount.publicKey,
                byteOffset: 24,
              },
            },
          },
          pdaNonce: pdaNonce3,
        },
        performancePackage,
        proposer: this.payer.publicKey, // Current authority proposes
      })
      .rpc();

    // Now the current authority changes the recipient to a new recipient
    const recipientChangePdaNonce = Math.floor(Math.random() * 1000000);
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient2.publicKey },
          },
          pdaNonce: recipientChangePdaNonce,
        },
        performancePackage,
        proposer: this.payer.publicKey, // Current authority proposes recipient change
      })
      .rpc();

    // Execute the recipient change first
    const recipientChangeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey,
        recipientChangePdaNonce,
      );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: recipientChangeRequestAddr,
        executor: recipient.publicKey, // Original recipient executes recipient change
      })
      .signers([recipient])
      .rpc();

    // Verify recipient was changed
    let performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(
      performancePackageAccount.recipient.toString(),
      newRecipient2.publicKey.toString(),
    );

    // Now the NEW recipient should be able to execute the original oracle change
    // even though they weren't the recipient when it was proposed
    const originalChangeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey, // Original authority (this.payer)
        pdaNonce3,
      );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: originalChangeRequestAddr,
        executor: newRecipient2.publicKey, // NEW recipient executes original change
      })
      .signers([newRecipient2])
      .rpc();

    // Verify the original oracle change was applied
    performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    assert.equal(
      performancePackageAccount.oracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString(),
    );
    assert.equal(performancePackageAccount.oracleConfig.byteOffset, 24);
  });

  it("should work even if authority is switched mid-proposal", async function () {
    const pdaNonce = Math.floor(Math.random() * 1000000);
    const newAuthority = Keypair.generate();
    const newRecipient = Keypair.generate();

    // First, recipient proposes a recipient change
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey, // Recipient proposes
      })
      .signers([recipient])
      .rpc();

    const [changeRequest] = getChangeRequestAddr({
      performancePackage,
      proposer: recipient.publicKey,
      pdaNonce,
    });

    // Now the current authority changes the authority to a new authority
    await this.priceBasedPerformancePackage
      .changePerformancePackageAuthorityIx({
        performancePackage,
        currentAuthority: this.payer.publicKey,
        newPerformancePackageAuthority: newAuthority.publicKey,
      })
      .rpc();

    // Now the new authority should be able to execute the change

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: newAuthority.publicKey, // New authority executes
      })
      .signers([newAuthority])
      .rpc();
  });

  it("should fail if new recipient equals current authority", async function () {
    const pdaNonce = Math.floor(Math.random() * 1000000);

    // Recipient proposes changing recipient to authority's key (this.payer.publicKey)
    await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: this.payer.publicKey },
          },
          pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );

    const callbacks = expectError(
      "RecipientAuthorityMustDiffer",
      "Recipient and performance package authority must be different keys",
    );

    // Authority executes - should fail because new recipient == authority
    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if wrong vault tries to execute", async function () {
    // Recipient proposes change (correct pattern)
    const pdaNonce = Math.floor(Math.random() * 1000000);
    const proposeTx = await this.priceBasedPerformancePackage
      .proposeChangeIx({
        params: {
          changeType: {
            recipient: { newRecipient: newRecipient.publicKey },
          },
          pdaNonce,
        },
        performancePackage,
        proposer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );

    const callbacks = expectError(
      "UnauthorizedLockerAuthority",
      "Unauthorized locker authority",
    );

    const wrongVault = Keypair.generate();

    const executeTx = await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: wrongVault.publicKey,
      })
      .signers([wrongVault])
      .rpc()
      .then(callbacks[0], callbacks[1]);
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
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce7,
      );

    const callbacks = expectError(
      "UnauthorizedLockerAuthority",
      "Unauthorized change request",
    );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: recipient.publicKey, // Same as proposer - should fail
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail if authority tries to execute their own proposal", async function () {
    // Generate a fresh changeKey for this test
    const testChangeKey6 = Keypair.generate();
    const pdaNonce8 = Math.floor(Math.random() * 1000000);

    // First, authority proposes a change
    await this.priceBasedPerformancePackage
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

    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey,
        pdaNonce8,
      );

    const callbacks = expectError(
      "UnauthorizedChangeRequest",
      "Unauthorized change request",
    );

    await this.priceBasedPerformancePackage
      .executeChangeIx({
        performancePackage,
        changeRequest: changeRequestAddr,
        executor: this.payer.publicKey, // Same as proposer - should fail
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  describe("with UnlockTerms", function () {
    type UnlockTerms = { minUnlockTimestamp: BN; limits: LimitsParams | null };
    let quoteMint: PublicKey;
    let dao: PublicKey;

    function storedPackage(ctx: Mocha.Context) {
      return ctx.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    }

    async function clock(ctx: Mocha.Context): Promise<number> {
      return Number((await ctx.banksClient.getClock()).unixTimestamp);
    }

    // Plain JSON, so BNs and keys compare by value.
    function asJson(value: unknown) {
      return JSON.parse(JSON.stringify(value));
    }

    function cappedLimits(
      now: number,
      overrides: Partial<LimitsParams> = {},
    ): LimitsParams {
      return {
        endTimestamp: new BN(now + ONE_YEAR),
        windowSeconds: THIRTY_DAYS,
        maxTokensPerWindow: new BN(TOKEN_CAP),
        maxQuotePerWindow: new BN(QUOTE_CAP),
        withdrawalMode: { both: {} },
        ...overrides,
      };
    }

    // Proposes the terms under a fresh nonce and returns the request address.
    // The authority (the payer) proposes unless a signer is given.
    async function propose(
      ctx: Mocha.Context,
      terms: UnlockTerms,
      proposer: Keypair | null = null,
    ): Promise<PublicKey> {
      const proposerKey = proposer?.publicKey ?? ctx.payer.publicKey;
      const pdaNonce = Math.floor(Math.random() * 1_000_000);

      await ctx.priceBasedPerformancePackage
        .proposeChangeIx({
          params: { changeType: { unlockTerms: terms }, pdaNonce },
          performancePackage,
          proposer: proposerKey,
        })
        .signers(proposer ? [proposer] : [])
        .rpc();

      return getChangeRequestAddr({
        performancePackage,
        proposer: proposerKey,
        pdaNonce,
      })[0];
    }

    // The authority (the payer) executes unless a signer is given.
    function execute(
      ctx: Mocha.Context,
      changeRequest: PublicKey,
      executor: Keypair | null = null,
    ) {
      return ctx.priceBasedPerformancePackage
        .executeChangeIx({
          performancePackage,
          changeRequest,
          executor: executor?.publicKey ?? ctx.payer.publicKey,
        })
        .signers(executor ? [executor] : [])
        .rpc();
    }

    // The authority proposes and the recipient executes; returns the execution clock.
    async function proposeAndExecute(
      ctx: Mocha.Context,
      terms: UnlockTerms,
    ): Promise<number> {
      const changeRequest = await propose(ctx, terms);
      const executedAt = await clock(ctx);
      await execute(ctx, changeRequest, recipient);
      return executedAt;
    }

    async function usage(ctx: Mocha.Context) {
      const { usage } = (await storedPackage(ctx)).withdrawalPolicy;
      return {
        windowIndex: usage.windowIndex.toString(),
        tokensUsed: usage.tokensUsed.toString(),
        quoteUsed: usage.quoteUsed.toString(),
      };
    }

    function startUnlock(ctx: Mocha.Context) {
      return ctx.priceBasedPerformancePackage
        .startUnlockIx({
          performancePackage,
          oracleAccount: oracleAccount.publicKey,
          recipient: recipient.publicKey,
        })
        .preInstructions([uniqueTxIx()])
        .signers([recipient])
        .rpc();
    }

    function withdrawTokens(
      ctx: Mocha.Context,
      amount: number,
      oracle: PublicKey = dao,
    ) {
      return ctx.priceBasedPerformancePackage
        .withdrawTokensIx({
          performancePackage,
          oracleAccount: oracle,
          tokenMint,
          recipient: recipient.publicKey,
          amount: new BN(amount),
        })
        .preInstructions([uniqueTxIx()])
        .signers([recipient])
        .rpc();
    }

    function sell(ctx: Mocha.Context, amount: number) {
      return ctx.priceBasedPerformancePackage
        .withdrawViaSellIx({
          performancePackage,
          dao,
          tokenMint,
          quoteMint,
          recipient: recipient.publicKey,
          amount: new BN(amount),
          minQuoteOut: new BN(0),
        })
        .preInstructions([uniqueTxIx()])
        .signers([recipient])
        .rpc();
    }

    // The SDK's maximum token withdrawal at the current clock.
    async function maxWithdrawal(ctx: Mocha.Context): Promise<string> {
      const vaultAmount = new BN(
        (await ctx.getTokenBalance(tokenMint, performancePackage)).toString(),
      );
      return getMaxTokenWithdrawal({
        performancePackage: await storedPackage(ctx),
        vaultAmount,
        now: await clock(ctx),
        dao: await ctx.futarchy.getDao(dao),
      }).toString();
    }

    // Replaces the package from the outer setup with one on a Dao whose pool
    // is seeded, created with `limits` and its first tranche unlocked.
    async function setupCappedPackage(
      ctx: Mocha.Context,
      limits: LimitsParams,
    ) {
      ({ tokenMint, quoteMint, dao, performancePackage } =
        await setupSellablePackage(ctx, { recipient, limits }));
    }

    it("removes the cliff so an unlock can start at once", async function () {
      const now = await clock(this);
      tokenMint = await this.createMint(this.payer.publicKey, 6);
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
        minUnlockTimestamp: new BN(now + THIRTY_DAYS),
      });
      await setMockOracle(this, oracleAccount.publicKey, {
        aggregator: 1_000_000n,
      });

      const callbacks = expectError(
        "UnlockTimestampNotReached",
        "started an unlock before the cliff",
      );
      await startUnlock(this).then(callbacks[0], callbacks[1]);

      await proposeAndExecute(this, {
        minUnlockTimestamp: new BN(now),
        limits: null,
      });

      const stored = await storedPackage(this);
      assert.equal(stored.minUnlockTimestamp.toString(), now.toString());
      assert.isNull(stored.withdrawalPolicy);

      await startUnlock(this);
      assert.isDefined((await storedPackage(this)).state.unlocking);
    });

    it("stores limits on a package without any, anchored at the execution clock with zero usage", async function () {
      const now = await clock(this);
      const limits = cappedLimits(now);
      const changeRequest = await propose(this, {
        minUnlockTimestamp: new BN(now),
        limits,
      });
      await this.advanceBySeconds(ONE_HOUR);

      const executedAt = await clock(this);
      await execute(this, changeRequest, recipient);

      const stored = await storedPackage(this);
      assert.equal(stored.minUnlockTimestamp.toString(), now.toString());
      assert.deepEqual(
        asJson(stored.withdrawalPolicy.limits),
        asJson({ startTimestamp: new BN(executedAt), ...limits }),
      );
      assert.deepEqual(await usage(this), NO_USAGE);
    });

    it("keeps the window and its usage when the new limits share the window length", async function () {
      await setupCappedPackage(this, cappedLimits(await clock(this)));
      await withdrawTokens(this, PARTIAL_WITHDRAWAL);
      const { minUnlockTimestamp, withdrawalPolicy: before } =
        await storedPackage(this);
      const usageBefore = await usage(this);

      const newLimits = cappedLimits(await clock(this), {
        endTimestamp: before.limits.endTimestamp.addn(ONE_YEAR),
        maxTokensPerWindow: new BN(2 * TOKEN_CAP),
        maxQuotePerWindow: new BN(2 * QUOTE_CAP),
        withdrawalMode: { tokens: {} },
      });
      await this.advanceBySeconds(ONE_HOUR);
      await proposeAndExecute(this, { minUnlockTimestamp, limits: newLimits });

      const after = (await storedPackage(this)).withdrawalPolicy;
      assert.deepEqual(
        asJson(after.limits),
        asJson({ startTimestamp: before.limits.startTimestamp, ...newLimits }),
      );
      assert.deepEqual(await usage(this), usageBefore);

      const room = 2 * TOKEN_CAP - PARTIAL_WITHDRAWAL;
      assert.equal(await maxWithdrawal(this), room.toString());
      const callbacks = expectError(
        "TokenWindowLimitExceeded",
        "withdrew past the cap shared with the earlier withdrawal",
      );
      await withdrawTokens(this, room + 1).then(callbacks[0], callbacks[1]);
      await withdrawTokens(this, room);
      assert.equal((await usage(this)).tokensUsed, (2 * TOKEN_CAP).toString());
    });

    it("re-anchors at the execution clock and carries the counters into the first window when the window length changes", async function () {
      await setupCappedPackage(
        this,
        cappedLimits(await clock(this), { windowSeconds: ONE_DAY }),
      );
      await withdrawTokens(this, PARTIAL_WITHDRAWAL);
      const { minUnlockTimestamp } = await storedPackage(this);
      const usageBefore = await usage(this);
      assert.notEqual(usageBefore.windowIndex, "0");

      const newLimits = cappedLimits(await clock(this));
      const executedAt = await proposeAndExecute(this, {
        minUnlockTimestamp,
        limits: newLimits,
      });

      const after = (await storedPackage(this)).withdrawalPolicy;
      assert.deepEqual(
        asJson(after.limits),
        asJson({ startTimestamp: new BN(executedAt), ...newLimits }),
      );
      assert.deepEqual(await usage(this), { ...usageBefore, windowIndex: "0" });

      const room = TOKEN_CAP - PARTIAL_WITHDRAWAL;
      assert.equal(await maxWithdrawal(this), room.toString());
      const callbacks = expectError(
        "TokenWindowLimitExceeded",
        "withdrew past the cap carried into the new window",
      );
      await withdrawTokens(this, room + 1).then(callbacks[0], callbacks[1]);
      await withdrawTokens(this, room);
      const usageAfter = await usage(this);
      assert.equal(usageAfter.windowIndex, "0");
      assert.equal(usageAfter.tokensUsed, TOKEN_CAP.toString());
    });

    it("removes the limits, uncapping both routes", async function () {
      await setupCappedPackage(this, cappedLimits(await clock(this)));
      const { minUnlockTimestamp } = await storedPackage(this);

      await proposeAndExecute(this, { minUnlockTimestamp, limits: null });

      assert.isNull((await storedPackage(this)).withdrawalPolicy);
      await withdrawTokens(this, 2 * TOKEN_CAP);
      const estimate = getSellProceedsEstimate(
        await this.futarchy.getDao(dao),
        new BN(2 * TOKEN_CAP),
      );
      await sell(this, 2 * TOKEN_CAP);

      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(2 * TOKEN_CAP),
      );
      assert.equal(
        (await this.getTokenBalance(quoteMint, recipient.publicKey)).toString(),
        estimate.toString(),
      );
    });

    it("applies a mode change to the next withdrawal", async function () {
      const now = await clock(this);
      await setupCappedPackage(
        this,
        cappedLimits(now, { withdrawalMode: { tokens: {} } }),
      );
      const { minUnlockTimestamp } = await storedPackage(this);
      const sellDisabled = expectError(
        "WithdrawViaSellDisabled",
        "sold under mode Tokens",
      );
      await sell(this, TOKEN_CAP).then(sellDisabled[0], sellDisabled[1]);

      await proposeAndExecute(this, {
        minUnlockTimestamp,
        limits: cappedLimits(now, { withdrawalMode: { sell: {} } }),
      });

      const tokensDisabled = expectError(
        "WithdrawTokensDisabled",
        "withdrew tokens under mode Sell",
      );
      await withdrawTokens(this, TOKEN_CAP).then(
        tokensDisabled[0],
        tokensDisabled[1],
      );
      await sell(this, TOKEN_CAP);
      assert.equal((await usage(this)).tokensUsed, TOKEN_CAP.toString());
    });

    it("is allowed while the package is unlocking", async function () {
      const now = await clock(this);
      await this.advanceBySeconds(2);
      await setMockOracle(this, oracleAccount.publicKey, {
        aggregator: 1_000_000n,
      });
      await startUnlock(this);

      await proposeAndExecute(this, {
        minUnlockTimestamp: new BN(now),
        limits: cappedLimits(now),
      });

      const stored = await storedPackage(this);
      assert.isDefined(stored.state.unlocking);
      assert.equal(stored.minUnlockTimestamp.toString(), now.toString());
      assert.isNotNull(stored.withdrawalPolicy);
    });

    it("rejects execution by the proposing party", async function () {
      const changeRequest = await propose(
        this,
        { minUnlockTimestamp: new BN(await clock(this)), limits: null },
        recipient,
      );

      const callbacks = expectError(
        "UnauthorizedLockerAuthority",
        "the recipient executed their own proposal",
      );
      await execute(this, changeRequest, recipient).then(
        callbacks[0],
        callbacks[1],
      );
    });

    it("stores a request whose end passed before execution as an inert policy", async function () {
      await this.advanceBySeconds(2);
      await runUnlockCycle(this, {
        performancePackage,
        oracleAccount: oracleAccount.publicKey,
        recipient,
        twapPrice: BigInt(1e12),
      });
      const now = await clock(this);
      const limits = cappedLimits(now, {
        endTimestamp: new BN(now + ONE_HOUR),
        windowSeconds: ONE_HOUR,
        maxTokensPerWindow: new BN(1),
        maxQuotePerWindow: new BN(1),
        withdrawalMode: { sell: {} },
      });
      const changeRequest = await propose(this, {
        minUnlockTimestamp: new BN(now),
        limits,
      });
      await this.advanceBySeconds(2 * ONE_HOUR);

      const executedAt = await clock(this);
      await execute(this, changeRequest, recipient);

      const stored = await storedPackage(this);
      assert.deepEqual(
        asJson(stored.withdrawalPolicy.limits),
        asJson({ startTimestamp: new BN(executedAt), ...limits }),
      );
      assert.isNull(getActiveWithdrawalPolicy(stored, executedAt));

      await withdrawTokens(this, 100 * 10 ** 6, oracleAccount.publicKey);
      assert.equal(
        await this.getTokenBalance(tokenMint, recipient.publicKey),
        BigInt(100 * 10 ** 6),
      );
      assert.deepEqual(await usage(this), NO_USAGE);
    });

    it("closes the request and pays its rent to the executor", async function () {
      const changeRequest = await propose(this, {
        minUnlockTimestamp: new BN(await clock(this)),
        limits: null,
      });
      const rent = BigInt(
        (await this.banksClient.getAccount(changeRequest)).lamports,
      );
      const balanceBefore = await this.banksClient.getBalance(
        recipient.publicKey,
      );

      await execute(this, changeRequest, recipient);

      assert.isNull(await this.banksClient.getAccount(changeRequest));
      assert.equal(
        await this.banksClient.getBalance(recipient.publicKey),
        balanceBefore + rent,
      );
    });
  });
}
