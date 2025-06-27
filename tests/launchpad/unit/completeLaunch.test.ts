import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
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
        MAINNET_USDC
      )
      .rpc();

    await launchpadClient.startLaunchIx(launch).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);
  });

  it("completes launch successfully when minimum raise is met and time has passed", async function () {
    // Fund the launch with exactly minimum raise

    await launchpadClient.fundIx(launch, minRaise, undefined, MAINNET_USDC).rpc();

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

    await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    const [poolState] = getLiquidityPoolAddr(
      launchpadClient.getProgramId(),
      launchAccount.dao
    );
    const [lpMint] = getRaydiumCpmmLpMintAddr(poolState, false);

    const treasuryUSDCBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.daoTreasury
    );
    const treasuryLpBalance = await this.getTokenBalance(
      lpMint,
      launchAccount.daoTreasury
    );

    assert.exists(launchAccount.state.complete);
    assert.equal(
      treasuryUSDCBalance.toString(),
      minRaise.muln(9).divn(10).toString()
    );
    assert.isAbove(Number(treasuryLpBalance.toString()), 1000);
    const mint = await this.getMint(META);
    assert.isTrue(mint.mintAuthority.equals(launchAccount.daoTreasury));
    assert.exists(launchAccount.dao);

    rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
    storedMetadata = deserializeMetadata({
      publicKey: fromWeb3JsPublicKey(tokenMetadata),
      ...rawStoredMetadata,
    });
    assert.ok(
      toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(
        launchAccount.daoTreasury
      )
    );
  });

  it("fails when launch period has not passed", async function () {
    // Fund the launch with exactly minimum raise

    await launchpadClient.fundIx(launch, minRaise, undefined, MAINNET_USDC).rpc();

    // Try to complete immediately (should fail)
    try {
      await launchpadClient.completeLaunchIx(launch, MAINNET_USDC, META).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchPeriodNotOver");
    }

    // Advance by 9 days (still not enough)
    await this.advanceBySeconds(60 * 60 * 24 * 9);

    try {
      await launchpadClient
        .completeLaunchIx(launch, MAINNET_USDC, META)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "LaunchPeriodNotOver");
    }
  });

  it("moves to refunding state when minimum raise is not met after period", async function () {
    // Fund the launch with less than minimum raise
    const partialAmount = minRaise.divn(2);

    await launchpadClient.fundIx(launch, partialAmount, undefined, MAINNET_USDC).rpc();

    await this.advanceBySeconds(60 * 60 * 24 * 11);

    // Complete the launch
    // I'm only 5 bytes under the limit, so make sure we don't go over
    await launchpadClient
      .completeLaunchIx(launch, MAINNET_USDC, META)
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);

    assert.exists(launchAccount.state.refunding);
  });

  it("fails when launch is not in live state", async function () {
    // Advance clock past 7 days
    await this.advanceBySeconds(60 * 60 * 24 * 11);

    // Complete launch first time
    await launchpadClient.completeLaunchIx(launch, MAINNET_USDC, META).rpc();

    // Try to complete again
    try {
      // CU price so that the VM doesn't think it's a duplicate tx
      await launchpadClient
        .completeLaunchIx(launch, MAINNET_USDC, META)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });
}
