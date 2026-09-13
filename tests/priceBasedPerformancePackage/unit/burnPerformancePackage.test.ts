import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import BN from "bn.js";
import { getMint } from "spl-token-bankrun";
import { ACCOUNT_SIZE, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { expectError } from "../../utils.js";
import { runUnlockCycle, setDaoOracle, setupPackageOnDao } from "../utils.js";

const TRANCHE_AMOUNT = 100 * 10 ** 6;
const TOTAL_AMOUNT = 2 * TRANCHE_AMOUNT;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const ONE_YEAR = 365 * 24 * 60 * 60;

export default function () {
  let tokenMint: PublicKey;
  let recipient: Keypair;
  let admin: Keypair;
  let spillAccount: Keypair;
  let performancePackage: PublicKey;
  let oracle: PublicKey;

  beforeEach(async function () {
    recipient = Keypair.generate();
    admin = Keypair.generate();
    spillAccount = Keypair.generate();
    oracle = Keypair.generate().publicKey;

    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: admin.publicKey,
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
      oracleAccount: oracle,
      recipient: recipient.publicKey,
    });

    // Move past the one-second cliff
    await this.advanceBySeconds(2);
  });

  // Unlocks every tranche with a threshold at or below `twapPrice`.
  async function unlockTranches(
    ctx: Mocha.Context,
    twapPrice: bigint,
    writeOracle?: (values: { aggregator: bigint }) => Promise<void>,
  ) {
    await runUnlockCycle(ctx, {
      performancePackage,
      oracleAccount: oracle,
      recipient,
      twapPrice,
      writeOracle,
    });
  }

  function burnIx(ctx: Mocha.Context) {
    return ctx.priceBasedPerformancePackage.burnPerformancePackageIx({
      performancePackage,
      tokenMint,
      recipient: recipient.publicKey,
      admin: admin.publicKey,
      spillAccount: spillAccount.publicKey,
    });
  }

  function withdrawIx(ctx: Mocha.Context, amount: number) {
    return ctx.priceBasedPerformancePackage
      .withdrawTokensIx({
        performancePackage,
        oracleAccount: oracle,
        tokenMint,
        recipient: recipient.publicKey,
        amount: new BN(amount),
      })
      .signers([recipient]);
  }

  async function mintSupply(ctx: Mocha.Context): Promise<bigint> {
    return (await getMint(ctx.banksClient, tokenMint)).supply;
  }

  it("pays out the unlocked balance, burns the locked remainder and closes the package to the spill account", async function () {
    await unlockTranches(this, BigInt(1e12));

    const supplyBefore = await mintSupply(this);
    const packageLamports = (
      await this.banksClient.getAccount(performancePackage)
    ).lamports;

    await burnIx(this).signers([admin]).rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(await this.getTokenBalance(tokenMint, performancePackage), 0n);
    assert.equal(
      supplyBefore - (await mintSupply(this)),
      BigInt(TOTAL_AMOUNT - TRANCHE_AMOUNT),
    );

    assert.isNull(await this.banksClient.getAccount(performancePackage));
    assert.equal(
      await this.banksClient.getBalance(spillAccount.publicKey),
      BigInt(packageLamports),
    );
  });

  it("burns the whole vault when nothing is unlocked", async function () {
    const supplyBefore = await mintSupply(this);

    await burnIx(this).signers([admin]).rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      0n,
    );
    assert.equal(await this.getTokenBalance(tokenMint, performancePackage), 0n);
    assert.equal(supplyBefore - (await mintSupply(this)), BigInt(TOTAL_AMOUNT));
    assert.isNull(await this.banksClient.getAccount(performancePackage));
  });

  it("transfers and burns nothing when everything is unlocked and already withdrawn", async function () {
    await unlockTranches(this, BigInt(2e12));
    await withdrawIx(this, TOTAL_AMOUNT).rpc();
    assert.equal(await this.getTokenBalance(tokenMint, performancePackage), 0n);

    const supplyBefore = await mintSupply(this);

    await burnIx(this).signers([admin]).rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TOTAL_AMOUNT),
    );
    assert.equal(await mintSupply(this), supplyBefore);
    assert.isNull(await this.banksClient.getAccount(performancePackage));
  });

  it("pays the whole withdrawable balance when the window's token cap is used up", async function () {
    tokenMint = await this.createMint(this.payer.publicKey, 6);
    const quoteMint = await this.createMint(this.payer.publicKey, 6);
    await this.mintTo(
      tokenMint,
      this.payer.publicKey,
      this.payer,
      TOTAL_AMOUNT,
    );
    const now = Number((await this.banksClient.getClock()).unixTimestamp);
    ({ dao: oracle, performancePackage } = await setupPackageOnDao(this, {
      tokenMint,
      quoteMint,
      recipient: recipient.publicKey,
      limits: {
        endTimestamp: new BN(now + ONE_YEAR),
        windowSeconds: THIRTY_DAYS,
        maxTokensPerWindow: new BN(TRANCHE_AMOUNT / 2),
        maxQuotePerWindow: new BN(1_000 * 10 ** 6),
        withdrawalMode: { both: {} },
      },
    }));
    await this.advanceBySeconds(2);
    await unlockTranches(this, BigInt(1e12), (values) =>
      setDaoOracle(this, oracle, values),
    );
    await setDaoOracle(this, oracle, {
      lastObservation: BigInt(1e12),
      reserves: { base: 1_000_000n * 10n ** 6n, quote: 1_000_000n * 10n ** 6n },
    });

    await withdrawIx(this, TRANCHE_AMOUNT / 2).rpc();
    const callbacks = expectError(
      "TokenWindowLimitExceeded",
      "withdrew past the window's token cap",
    );
    await withdrawIx(this, 1).rpc().then(callbacks[0], callbacks[1]);

    const supplyBefore = await mintSupply(this);

    await burnIx(this).signers([admin]).rpc();

    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );
    assert.equal(await this.getTokenBalance(tokenMint, performancePackage), 0n);
    assert.equal(
      supplyBefore - (await mintSupply(this)),
      BigInt(TOTAL_AMOUNT - TRANCHE_AMOUNT),
    );
    assert.isNull(await this.banksClient.getAccount(performancePackage));
  });

  it("creates a missing recipient ATA at the admin's expense", async function () {
    await unlockTranches(this, BigInt(1e12));

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey,
    );
    assert.isNull(await this.banksClient.getAccount(recipientTokenAccount));
    const adminBefore = await this.banksClient.getBalance(admin.publicKey);

    await burnIx(this).signers([admin]).rpc();

    assert.isNotNull(await this.banksClient.getAccount(recipientTokenAccount));
    assert.equal(
      await this.getTokenBalance(tokenMint, recipient.publicKey),
      BigInt(TRANCHE_AMOUNT),
    );

    const rent = await this.banksClient.getRent();
    assert.equal(
      adminBefore - (await this.banksClient.getBalance(admin.publicKey)),
      rent.minimumBalance(BigInt(ACCOUNT_SIZE)),
    );
  });
}
