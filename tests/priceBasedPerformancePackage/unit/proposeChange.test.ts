import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { LimitsParams } from "@metadaoproject/programs";
import { expectError } from "../../utils.js";
import { setMockOracle } from "../utils.js";

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const ONE_YEAR = 365 * 24 * 60 * 60;
const INVALID_LIMITS_MESSAGE =
  "Withdrawal limits must have non-zero caps, a future end, and a window of at least one second";

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

    performancePackage = await this.setupBasicPerformancePackage({
      tokenMint,
      oracleAccount: oracleAccount.publicKey,
      recipient: recipient.publicKey,
    });
  });

  it("should allow recipient to propose a change (recipient → performancePackage authority execution flow)", async function () {
    // Fund the newRecipient with SOL
    const fundingTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: newRecipient.publicKey,
        lamports: 1000000000, // 1 SOL
      }),
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
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );
    const changeRequest =
      await this.priceBasedPerformancePackage.getChangeRequest(
        changeRequestAddr,
      );

    // Verify the change request was created correctly
    assert.exists(changeRequest.proposerType.recipient);
    assert.equal(
      changeRequest.performancePackage.toString(),
      performancePackage.toString(),
    );
    assert.equal(
      changeRequest.changeType.recipient.newRecipient.toString(),
      newRecipient.publicKey.toString(),
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
    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );
    // console.log("Authority proposal test - proposer:", squadsMultisigVault.publicKey.toString().slice(0, 8));
    // console.log("State remains: Locked (no PendingChange state)");
    assert.equal(performancePackageAccount.state.locked !== undefined, true);

    // Verify change request was created with correct proposer
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        this.payer.publicKey,
        pdaNonce,
      );
    const changeRequest =
      await this.priceBasedPerformancePackage.getChangeRequest(
        changeRequestAddr,
      );

    assert.exists(changeRequest.proposerType.authority);
    assert.equal(
      changeRequest.performancePackage.toString(),
      performancePackage.toString(),
    );
    assert.equal(
      changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString(),
    );
    assert.equal(
      changeRequest.changeType.oracle.newOracleConfig.byteOffset,
      16,
    );
  });

  it("should fail if unauthorized party tries to propose change", async function () {
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

    const callbacks = expectError(
      "UnauthorizedChangeRequest",
      "Unauthorized change request",
    );

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
      .rpc()
      .then(callbacks[0], callbacks[1]);
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
    const changeRequestAddr =
      this.priceBasedPerformancePackage.getChangeRequestAddress(
        performancePackage,
        recipient.publicKey,
        pdaNonce,
      );
    const changeRequest =
      await this.priceBasedPerformancePackage.getChangeRequest(
        changeRequestAddr,
      );
    const performancePackageAccount =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(
      changeRequest.changeType.oracle.newOracleConfig.oracleAccount.toString(),
      newOracleAccount.publicKey.toString(),
    );
    assert.equal(changeRequest.changeType.oracle.newOracleConfig.byteOffset, 8);
  });

  describe("with UnlockTerms", function () {
    type UnlockTerms = { minUnlockTimestamp: BN; limits: LimitsParams | null };
    let now: number;
    let limits: LimitsParams;

    beforeEach(async function () {
      now = Number((await this.banksClient.getClock()).unixTimestamp);
      limits = {
        endTimestamp: new BN(now + ONE_YEAR),
        windowSeconds: THIRTY_DAYS,
        maxTokensPerWindow: new BN(50 * 10 ** 6),
        maxQuotePerWindow: new BN(1_000 * 10 ** 6),
        withdrawalMode: { both: {} },
      };
    });

    // Builds the proposal under a fresh nonce. The authority (the payer)
    // proposes unless a signer is given.
    function proposeIx(
      ctx: Mocha.Context,
      terms: UnlockTerms,
      proposer: Keypair | null = null,
    ) {
      const proposerKey = proposer?.publicKey ?? ctx.payer.publicKey;
      const pdaNonce = Math.floor(Math.random() * 1_000_000);
      const builder = ctx.priceBasedPerformancePackage
        .proposeChangeIx({
          params: { changeType: { unlockTerms: terms }, pdaNonce },
          performancePackage,
          proposer: proposerKey,
        })
        .signers(proposer ? [proposer] : []);
      const changeRequest =
        ctx.priceBasedPerformancePackage.getChangeRequestAddress(
          performancePackage,
          proposerKey,
          pdaNonce,
        );
      return { builder, changeRequest };
    }

    // Plain JSON, so BNs and keys compare by value.
    function asJson(value: unknown) {
      return JSON.parse(JSON.stringify(value));
    }

    async function expectInvalidLimits(
      ctx: Mocha.Context,
      override: Partial<LimitsParams>,
    ) {
      const callbacks = expectError(
        "InvalidWithdrawalLimits",
        INVALID_LIMITS_MESSAGE,
      );

      await proposeIx(ctx, {
        minUnlockTimestamp: new BN(now),
        limits: { ...limits, ...override },
      })
        .builder.rpc()
        .then(callbacks[0], callbacks[1]);
    }

    it("stores the recipient's proposal", async function () {
      const terms = { minUnlockTimestamp: new BN(now), limits };
      const { builder, changeRequest } = proposeIx(this, terms, recipient);
      await builder.rpc();

      const stored =
        await this.priceBasedPerformancePackage.getChangeRequest(changeRequest);
      assert.isDefined(stored.proposerType.recipient);
      assert.equal(
        stored.performancePackage.toString(),
        performancePackage.toString(),
      );
      assert.deepEqual(
        asJson(stored.changeType),
        asJson({ unlockTerms: terms }),
      );
    });

    it("stores the authority's proposal", async function () {
      const terms = { minUnlockTimestamp: new BN(now + THIRTY_DAYS), limits };
      const { builder, changeRequest } = proposeIx(this, terms);
      await builder.rpc();

      const stored =
        await this.priceBasedPerformancePackage.getChangeRequest(changeRequest);
      assert.isDefined(stored.proposerType.authority);
      assert.deepEqual(
        asJson(stored.changeType),
        asJson({ unlockTerms: terms }),
      );
    });

    it("is allowed while the package is unlocking, unlike an oracle change", async function () {
      await this.advanceBySeconds(2);
      await setMockOracle(this, oracleAccount.publicKey, {
        aggregator: 1_000_000n,
      });
      await this.priceBasedPerformancePackage
        .startUnlockIx({
          performancePackage,
          oracleAccount: oracleAccount.publicKey,
          recipient: recipient.publicKey,
        })
        .signers([recipient])
        .rpc();

      const { builder, changeRequest } = proposeIx(
        this,
        { minUnlockTimestamp: new BN(now), limits },
        recipient,
      );
      await builder.rpc();

      const stored =
        await this.priceBasedPerformancePackage.getChangeRequest(changeRequest);
      assert.isDefined(stored.changeType.unlockTerms);

      const callbacks = expectError(
        "InvalidPerformancePackageState",
        "proposed an oracle change while unlocking",
      );
      await this.priceBasedPerformancePackage
        .proposeChangeIx({
          params: {
            changeType: {
              oracle: {
                newOracleConfig: {
                  oracleAccount: Keypair.generate().publicKey,
                  byteOffset: 0,
                },
              },
            },
            pdaNonce: Math.floor(Math.random() * 1_000_000),
          },
          performancePackage,
          proposer: recipient.publicKey,
        })
        .signers([recipient])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("rejects a zero token cap", async function () {
      await expectInvalidLimits(this, { maxTokensPerWindow: new BN(0) });
    });

    it("rejects a zero quote cap", async function () {
      await expectInvalidLimits(this, { maxQuotePerWindow: new BN(0) });
    });

    it("rejects an end timestamp at or before now", async function () {
      await expectInvalidLimits(this, { endTimestamp: new BN(now) });
    });

    it("rejects a window of zero seconds", async function () {
      await expectInvalidLimits(this, { windowSeconds: 0 });
    });

    it("allows no limits and a cliff in the past", async function () {
      const terms = {
        minUnlockTimestamp: new BN(now - ONE_YEAR),
        limits: null,
      };
      const { builder, changeRequest } = proposeIx(this, terms);
      await builder.rpc();

      const stored =
        await this.priceBasedPerformancePackage.getChangeRequest(changeRequest);
      assert.deepEqual(
        asJson(stored.changeType),
        asJson({ unlockTerms: terms }),
      );
    });

    it("rejects a third party", async function () {
      const callbacks = expectError(
        "UnauthorizedChangeRequest",
        "an outsider proposed unlock terms",
      );

      await proposeIx(
        this,
        { minUnlockTimestamp: new BN(now), limits },
        Keypair.generate(),
      )
        .builder.rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });
}
