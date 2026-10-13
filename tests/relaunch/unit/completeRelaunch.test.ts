import {
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";
import BN from "bn.js";
import { BanksClient } from "solana-bankrun";
import {
  FutarchyClient,
  getDaoAddr,
  getMetadataAddr,
  MAINNET_USDC,
  RelaunchClient,
} from "@metadaoproject/programs";
import { deserializeMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { setupRelaunch, DEFAULT_OLD_SUPPLY } from "../utils.js";
import { writePumpPool } from "../pumpAmm.js";

const POOL_BASE_RESERVE = 1_000_000n * 10n ** 6n; // 1M old tokens
const WSOL_POOL_QUOTE_RESERVE = 100n * 10n ** 9n; // 100 SOL
const USDC_POOL_QUOTE_RESERVE = 100_000n * 10n ** 6n; // 100k USDC

const TOKENS_TO_DEPOSITORS = 12_500_000n * 10n ** 6n;
const TOKENS_TO_FUTARCHY_LIQUIDITY = 12_500_000n * 10n ** 6n;
const PROPOSAL_MIN_STAKE_TOKENS = 1_500_000n * 10n ** 6n;
const PRICE_SCALE = 10n ** 12n;

const ONE_WEEK = 60 * 60 * 24 * 7;
const ONE_DAY = 60 * 60 * 24;

const DEFAULT_THRESHOLD_BPS = 1000;
// 10% of the 1B-token default supply = 100M tokens.
const DEPOSIT_AMOUNT = DEFAULT_OLD_SUPPLY / 10n;

async function tokenBalance(
  banksClient: BanksClient,
  address: PublicKey,
): Promise<bigint> {
  const raw = await banksClient.getAccount(address);
  if (!raw) return 0n;
  return token.unpackAccount(address, {
    ...raw,
    data: Buffer.from(raw.data),
  } as any).amount;
}

async function metadataUpdateAuthority(
  banksClient: BanksClient,
  mint: PublicKey,
): Promise<PublicKey> {
  const [tokenMetadata] = getMetadataAddr(mint);
  const raw = await banksClient.getAccount(tokenMetadata);
  const metadata = deserializeMetadata({
    ...raw,
    publicKey: fromWeb3JsPublicKey(tokenMetadata),
    owner: fromWeb3JsPublicKey(raw.owner),
    lamports: {
      basisPoints: BigInt(raw.lamports),
      identifier: "SOL",
      decimals: 9,
    },
    rentEpoch: raw.rentEpoch ? BigInt(raw.rentEpoch) : undefined,
  } as any);
  return toWeb3JsPublicKey(metadata.updateAuthority);
}

export default function suite() {
  let client: RelaunchClient;
  let futarchyClient: FutarchyClient;

  before(function () {
    client = this.relaunch;
    futarchyClient = this.futarchy;
  });

  const setupSwappedRelaunch = async function (
    this: Mocha.Context,
    {
      quoteMint = MAINNET_USDC,
      depositAmount = DEPOSIT_AMOUNT,
      thresholdBps = DEFAULT_THRESHOLD_BPS,
      monthlySpendingLimitAmount,
      monthlySpendingLimitMembers,
      sell = true,
    }: {
      quoteMint?: PublicKey;
      depositAmount?: bigint;
      thresholdBps?: number;
      monthlySpendingLimitAmount?: BN;
      monthlySpendingLimitMembers?: PublicKey[];
      sell?: boolean;
    } = {},
  ): Promise<{ relaunch: PublicKey; newMint: PublicKey }> {
    const setup = await setupRelaunch({
      banksClient: this.banksClient,
      payer: this.payer,
    });
    const pool = await writePumpPool({
      context: this.context,
      baseMint: setup.oldMint,
      quoteMint,
      baseReserve: POOL_BASE_RESERVE,
      quoteReserve: quoteMint.equals(token.NATIVE_MINT)
        ? WSOL_POOL_QUOTE_RESERVE
        : USDC_POOL_QUOTE_RESERVE,
      baseTokenProgram: setup.oldTokenProgram,
    });

    const { relaunch, newMint } = await client.initializeRelaunch({
      oldMint: setup.oldMint,
      sourcePool: pool.pool,
      sourceQuoteMint: quoteMint,
      tokenName: "Relaunched",
      tokenSymbol: "RLNCH",
      tokenUri: "https://example.com/rlnch.json",
      secondsForDeposits: ONE_WEEK,
      gracePeriodSeconds: ONE_DAY,
      thresholdBps,
      monthlySpendingLimitAmount,
      monthlySpendingLimitMembers,
      teamAddress: this.payer.publicKey,
    });

    await client.startDepositsIx({ relaunch }).rpc();
    await client
      .depositIx({
        relaunch,
        oldMint: setup.oldMint,
        oldTokenProgram: setup.oldTokenProgram,
        amount: new BN(depositAmount.toString()),
      })
      .rpc();
    await this.advanceBySeconds(ONE_WEEK);
    await client.closeDepositsIx({ relaunch }).rpc();
    if (sell) {
      await client.executeSell({ relaunch });
    }

    return { relaunch, newMint };
  };

  // The happy path runs relaunch → futarchy → squads in one transaction, so
  // it doubles as the reentrancy-shape check: no program twice in the stack.
  it("completes into a DAO with launchpad-parity params in a single transaction", async function () {
    const monthlySpend = new BN(100_000_000); // 100 USDC
    const { relaunch, newMint } = await setupSwappedRelaunch.call(this, {
      monthlySpendingLimitAmount: monthlySpend,
      monthlySpendingLimitMembers: [this.payer.publicKey],
    });

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    const usdcRecovered = BigInt(storedRelaunch.usdcRecovered.toString());

    await client.completeRelaunch({ relaunch });

    storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.complete);
    assert.isNotNull(storedRelaunch.unixTimestampCompleted);
    assert.equal(storedRelaunch.seqNum.toString(), "5");

    const relaunchSigner = client.getRelaunchSignerAddress({ relaunch });
    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: relaunchSigner });
    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [multisigVault] = multisig.getVaultPda({ multisigPda, index: 0 });
    assert.ok(storedRelaunch.dao.equals(dao));
    assert.ok(storedRelaunch.daoVault.equals(multisigVault));

    const storedDao = await futarchyClient.getDao(dao);
    assert.ok(storedDao.daoCreator.equals(relaunchSigner));
    assert.equal(storedDao.nonce.toString(), "0");
    assert.ok(storedDao.baseMint.equals(newMint));
    assert.ok(storedDao.quoteMint.equals(MAINNET_USDC));
    assert.ok(storedDao.squadsMultisig.equals(multisigPda));
    assert.ok(storedDao.squadsMultisigVault.equals(multisigVault));

    const expectedTwap =
      (usdcRecovered * PRICE_SCALE) / TOKENS_TO_FUTARCHY_LIQUIDITY;
    assert.equal(
      storedDao.twapInitialObservation.toString(),
      expectedTwap.toString(),
    );
    assert.equal(
      storedDao.twapMaxObservationChangePerUpdate.toString(),
      (expectedTwap / 20n).toString(),
    );
    assert.equal(storedDao.twapStartDelaySeconds, 24 * 60 * 60);
    assert.equal(storedDao.passThresholdBps, 300);
    assert.equal(storedDao.secondsPerProposal, 3 * 24 * 60 * 60);
    assert.equal(
      storedDao.baseToStake.toString(),
      PROPOSAL_MIN_STAKE_TOKENS.toString(),
    );
    assert.equal(storedDao.minBaseFutarchicLiquidity.toString(), "1");
    assert.equal(storedDao.minQuoteFutarchicLiquidity.toString(), "1");
    assert.equal(storedDao.teamSponsoredPassThresholdBps, -300);
    assert.ok(storedDao.teamAddress.equals(this.payer.publicKey));
    assert.equal(
      storedDao.initialSpendingLimit.amountPerMonth.toString(),
      monthlySpend.toString(),
    );
    assert.deepEqual(
      storedDao.initialSpendingLimit.members.map((member) => member.toBase58()),
      [this.payer.publicKey.toBase58()],
    );

    const [spendingLimit] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    });
    assert.isNotNull(await this.banksClient.getAccount(spendingLimit));

    // The AMM holds the full 12.5M bucket against the whole raise, so its
    // open ratio is exactly the TWAP's initial observation.
    const spot = storedDao.amm.state.spot.spot;
    const baseReserves = BigInt(spot.baseReserves.toString());
    const quoteReserves = BigInt(spot.quoteReserves.toString());
    assert.equal(
      baseReserves.toString(),
      TOKENS_TO_FUTARCHY_LIQUIDITY.toString(),
    );
    assert.equal(quoteReserves.toString(), usdcRecovered.toString());
    assert.equal(
      ((quoteReserves * PRICE_SCALE) / baseReserves).toString(),
      expectedTwap.toString(),
    );

    const ammBaseVaultBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(newMint, dao, true),
    );
    assert.equal(
      ammBaseVaultBalance.toString(),
      TOKENS_TO_FUTARCHY_LIQUIDITY.toString(),
    );
    const ammQuoteVaultBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(MAINNET_USDC, dao, true),
    );
    assert.equal(ammQuoteVaultBalance.toString(), usdcRecovered.toString());

    const [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), multisigVault.toBuffer()],
      futarchyClient.getProgramId(),
    );
    const storedPosition =
      await futarchyClient.futarchy.account.ammPosition.fetch(ammPosition);
    assert.ok(storedPosition.positionAuthority.equals(multisigVault));
    assert.ok(storedPosition.dao.equals(dao));

    const treasuryBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(MAINNET_USDC, multisigVault, true),
    );
    assert.equal(treasuryBalance.toString(), "0");

    const usdcVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.usdcVault,
    );
    assert.equal(usdcVaultBalance.toString(), "0");

    const newTokenVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.newTokenVault,
    );
    assert.equal(
      newTokenVaultBalance.toString(),
      TOKENS_TO_DEPOSITORS.toString(),
    );

    const mint = await this.getMint(newMint);
    assert.ok(mint.mintAuthority.equals(multisigVault));
    assert.ok(
      (await metadataUpdateAuthority(this.banksClient, newMint)).equals(
        multisigVault,
      ),
    );
  });

  it("completes without a Squads spending limit when none is configured", async function () {
    const { relaunch } = await setupSwappedRelaunch.call(this);

    await client.completeRelaunch({ relaunch });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.complete);

    const storedDao = await futarchyClient.getDao(storedRelaunch.dao);
    assert.isNull(storedDao.initialSpendingLimit);

    const [multisigPda] = multisig.getMultisigPda({
      createKey: storedRelaunch.dao,
    });
    const [spendingLimit] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: storedRelaunch.dao,
    });
    assert.isNull(await this.banksClient.getAccount(spendingLimit));
  });

  it("lets any keypair crank the completion", async function () {
    const { relaunch, newMint } = await setupSwappedRelaunch.call(this);

    const cranker = Keypair.generate();
    const fund = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: cranker.publicKey,
        lamports: LAMPORTS_PER_SOL,
      }),
    );
    fund.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fund.feePayer = this.payer.publicKey;
    fund.sign(this.payer);
    await this.banksClient.processTransaction(fund);

    const tx = await client
      .completeRelaunchIx({
        relaunch,
        newMint,
        payer: cranker.publicKey,
      })
      .transaction();
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = cranker.publicKey;
    tx.sign(cranker);
    await this.banksClient.processTransaction(tx);

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.complete);
  });

  it("sends every recovered USDC raw unit to the AMM", async function () {
    // 7% of the supply at a 5% threshold, so a different recovered amount
    // than the happy path's.
    const { relaunch } = await setupSwappedRelaunch.call(this, {
      depositAmount: (DEFAULT_OLD_SUPPLY * 7n) / 100n,
      thresholdBps: 500,
    });

    let storedRelaunch = await client.fetchRelaunch(relaunch);
    const usdcRecovered = BigInt(storedRelaunch.usdcRecovered.toString());

    await client.completeRelaunch({ relaunch });

    storedRelaunch = await client.fetchRelaunch(relaunch);
    const storedDao = await futarchyClient.getDao(storedRelaunch.dao);
    const quoteReserves = BigInt(
      storedDao.amm.state.spot.spot.quoteReserves.toString(),
    );
    assert.equal(quoteReserves.toString(), usdcRecovered.toString());

    const treasuryBalance = await tokenBalance(
      this.banksClient,
      token.getAssociatedTokenAddressSync(
        MAINNET_USDC,
        storedRelaunch.daoVault,
        true,
      ),
    );
    assert.equal(treasuryBalance.toString(), "0");

    const usdcVaultBalance = await tokenBalance(
      this.banksClient,
      storedRelaunch.usdcVault,
    );
    assert.equal(usdcVaultBalance.toString(), "0");
  });

  it("fails before the USDC swap for a WSOL-quoted source", async function () {
    const { relaunch } = await setupSwappedRelaunch.call(this, {
      quoteMint: token.NATIVE_MINT,
    });

    try {
      await client.completeRelaunch({ relaunch });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSwapped");
    }

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.sold);
  });

  it("fails for a failed relaunch", async function () {
    // Half the threshold, so closing lands in Failed.
    const { relaunch } = await setupSwappedRelaunch.call(this, {
      depositAmount: DEPOSIT_AMOUNT / 2n,
      sell: false,
    });

    const storedRelaunch = await client.fetchRelaunch(relaunch);
    assert.isDefined(storedRelaunch.state.failed);

    try {
      await client.completeRelaunch({ relaunch });
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSwapped");
    }
  });

  it("fails when the relaunch has already been completed", async function () {
    const { relaunch, newMint } = await setupSwappedRelaunch.call(this);

    await client.completeRelaunch({ relaunch });

    try {
      // The compute-unit-price instruction makes the transaction hash unique
      // so the retry isn't rejected as a duplicate of the first completion.
      await client
        .completeRelaunchIx({ relaunch, newMint })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "RelaunchNotSwapped");
    }
  });
}
