import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  getLiquidityPoolAddr,
  getMetadataAddr,
  getRaydiumCpmmLpMintAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.5";
import { BN } from "bn.js";
import {
  deserializeMetadata,
  Metadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";
import { Clock } from "solana-bankrun";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const SLOTS_PER_DAY = 216_000; // (24 * 60 * 60 * 1000) / 400

  before(async function () {
    autocratClient = this.autocratClient;
    launchpadClient = this.launchpadClient;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpadClient,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx(
        "MTN",
        "MTN",
        "https://example.com",
        minRaise,
        60 * 60 * 24 * 10,
        META,
        MAINNET_USDC,
        new BN(100_000000), // 100 USDC burn
        [this.payer.publicKey]
      )
      .rpc();

    await launchpadClient.startLaunchIx(launch).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("completes launch successfully when minimum raise is met and time has passed", async function () {
    // Fund the launch with exactly minimum raise

    await launchpadClient
      .fundIx(launch, minRaise, undefined, MAINNET_USDC)
      .rpc();

    const [tokenMetadata] = getMetadataAddr(META);

    let rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    let storedMetadata = deserializeMetadata({
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      ...rawStoredMetadata,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(launchSigner)
    );

    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const [poolState] = getLiquidityPoolAddr(
      launchpadClient.getProgramId(),
      launchAccount.dao
    );
    const [lpMint] = getRaydiumCpmmLpMintAddr(poolState, false);

    const treasuryUSDCBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.daoVault
    );
    const treasuryLpBalance = await this.getTokenBalance(
      lpMint,
      launchAccount.daoVault
    );

    assert.exists(launchAccount.state.complete);
    assert.equal(
      treasuryUSDCBalance.toString(),
      minRaise.muln(8).divn(10).toString()
    );
    assert.isAbove(Number(treasuryLpBalance.toString()), 1000);
    const mint = await this.getMint(META);
    assert.isTrue(mint.mintAuthority.equals(launchAccount.daoVault));
    assert.exists(launchAccount.dao);
    assert.equal(mint.supply, 12_000_000 * 10 ** 6);

    rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    storedMetadata = deserializeMetadata({
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      ...rawStoredMetadata,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(
        launchAccount.daoVault
      )
    );
  });

  it("fails when launch period has not passed", async function () {
    // Fund the launch with exactly minimum raise

    await launchpadClient
      .fundIx(launch, minRaise, undefined, MAINNET_USDC)
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    // await this.banksClient.processTransaction(tx).then(callbacks
    let result = await this.banksClient.tryProcessTransaction(tx);
    console.log(result.meta.logMessages);
    assert.isTrue(
      result.meta.logMessages.some((log: string) =>
        log.includes("LaunchPeriodNotOver")
      )
    );

    // Advance by 9 days (still not enough)
    await this.advanceBySeconds(60 * 60 * 24 * 9);

    const completeLaunchMessage2 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions.concat(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 })
      ),
    }).compileToV0Message([completeLaunchLut]);

    const tx2 = new VersionedTransaction(completeLaunchMessage2);

    tx2.sign([this.payer]);

    result = await this.banksClient.tryProcessTransaction(tx2);
    assert.isTrue(
      result.meta.logMessages.some((log: string) =>
        log.includes("LaunchPeriodNotOver")
      )
    );
  });

  it("moves to refunding state when minimum raise is not met after period", async function () {
    // Fund the launch with less than minimum raise
    const partialAmount = minRaise.divn(2);

    await launchpadClient
      .fundIx(launch, partialAmount, undefined, MAINNET_USDC)
      .rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 11);

    // Complete the launch
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    const launchAccount = await launchpadClient.fetchLaunch(launch);

    assert.exists(launchAccount.state.refunding);
  });

  it("fails when launch is not in live state", async function () {
    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    // Complete launch first time
    const completeLaunchTx1 = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .transaction();

    const completeLaunchLut1 = await createLookupTableForTransaction(
      completeLaunchTx1,
      this
    );

    const completeLaunchMessage1 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx1.instructions,
    }).compileToV0Message([completeLaunchLut1]);

    const tx1 = new VersionedTransaction(completeLaunchMessage1);
    tx1.sign([this.payer]);

    await this.banksClient.processTransaction(tx1);

    // Try to complete again
    const completeLaunchTx2 = await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ])
      .transaction();

    const completeLaunchLut2 = await createLookupTableForTransaction(
      completeLaunchTx2,
      this
    );

    const completeLaunchMessage2 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx2.instructions,
    }).compileToV0Message([completeLaunchLut2]);

    const tx2 = new VersionedTransaction(completeLaunchMessage2);
    tx2.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx2);
    assert.isTrue(
      result.meta.logMessages.some((log) => log.includes("InvalidLaunchState"))
    );
  });
}
