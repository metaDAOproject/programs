import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { getMetadataAddr, MAINNET_USDC } from "@metadaoproject/programs";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.8";
import BN from "bn.js";
import { deserializeMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Keypair;

  const minRaise = new BN(100_000 * 10 ** 6); // 100k USDC
  const secondsForLaunch = 60 * 60 * 24 * 4; // 4 days

  const funder1 = Keypair.generate();
  const funder2 = Keypair.generate();

  before(async function () {
    launchpadClient = this.launchpad_v8;

    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
  });

  async function settleViaLut(
    context: any,
    client: LaunchpadClient,
    params: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: PublicKey | null;
    },
    additionalSigners: Keypair[] = [],
  ) {
    const settleTx = await client
      .settleLaunchTxBuilder({
        launch: params.launch,
        baseMint: params.baseMint,
        launchAuthority: params.launchAuthority,
      })
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, context);

    const message = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const tx = new VersionedTransaction(message);
    tx.sign([context.payer, ...additionalSigners]);

    await context.banksClient.processTransaction(tx);
  }

  async function trySettleViaLut(
    context: any,
    client: LaunchpadClient,
    params: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: PublicKey | null;
    },
    additionalSigners: Keypair[] = [],
  ) {
    const settleTx = await client
      .settleLaunchTxBuilder({
        launch: params.launch,
        baseMint: params.baseMint,
        launchAuthority: params.launchAuthority,
      })
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, context);

    const message = new TransactionMessage({
      payerKey: context.payer.publicKey,
      recentBlockhash: (await context.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const tx = new VersionedTransaction(message);
    tx.sign([context.payer, ...additionalSigners]);

    return context.banksClient.tryProcessTransaction(tx);
  }

  async function setupFundCloseApprove(
    context: any,
    client: LaunchpadClient,
    opts: {
      launch: PublicKey;
      baseMint: PublicKey;
      launchAuthority: Keypair;
      fundAmount: BN;
      approveAmount?: BN;
      hasBidWall?: boolean;
    },
  ) {
    // Fund
    await client
      .fundIx({
        launch: opts.launch,
        amount: opts.fundAmount,
        payer: context.payer.publicKey,
      })
      .rpc();

    // Advance past launch period
    await context.advanceBySeconds(secondsForLaunch + 1);

    // Close
    await client.closeLaunchIx({ launch: opts.launch }).rpc();

    // Approve
    const approveAmount =
      opts.approveAmount !== undefined ? opts.approveAmount : opts.fundAmount;
    await client
      .setFundingRecordApprovalIx({
        launch: opts.launch,
        approvedAmount: approveAmount,
        funder: context.payer.publicKey,
        launchAuthority: opts.launchAuthority.publicKey,
      })
      .signers([opts.launchAuthority])
      .rpc();
  }

  describe("happy path", function () {
    beforeEach(async function () {
      const result = await initializeMintWithSeeds(
        this.banksClient,
        this.launchpad_v8,
        this.payer,
      );

      META = result.tokenMint;
      launch = result.launch;
      launchSigner = result.launchSigner;
      launchAuthority = new Keypair();

      await this.setupBasicLaunch({
        baseMint: META,
        founders: [this.payer.publicKey],
        launchAuthority: launchAuthority.publicKey,
      });

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();
    });

    it("settles launch with DAO creation, token minting, liquidity, metadata transfer, and USDC distribution", async function () {
      const fundAmount = new BN(150_000 * 10 ** 6); // 150k USDC

      const [tokenMetadata] = getMetadataAddr(META);

      // Verify metadata authority is launch_signer before settle
      let rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
      let storedMetadata = deserializeMetadata({
        ...rawStoredMetadata,
        publicKey: fromWeb3JsPublicKey(tokenMetadata),
        owner: fromWeb3JsPublicKey(rawStoredMetadata.owner),
        lamports: {
          basisPoints: BigInt(rawStoredMetadata.lamports),
          identifier: "SOL",
          decimals: 9,
        },
        rentEpoch: rawStoredMetadata.rentEpoch
          ? BigInt(rawStoredMetadata.rentEpoch)
          : undefined,
      });
      assert.ok(
        toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(launchSigner),
      );

      await setupFundCloseApprove(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority,
        fundAmount,
        approveAmount: fundAmount,
      });

      await settleViaLut(
        this,
        launchpadClient,
        {
          launch,
          baseMint: META,
          launchAuthority: launchAuthority.publicKey,
        },
        [launchAuthority],
      );

      // Verify launch state
      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { complete: {} });
      assert.isNotNull(launchAccount.dao);
      assert.isNotNull(launchAccount.daoVault);
      assert.isNotNull(launchAccount.unixTimestampCompleted);

      // Verify USDC distribution: 80% to treasury
      const treasuryUSDCBalance = await this.getTokenBalance(
        MAINNET_USDC,
        launchAccount.daoVault,
      );
      assert.equal(
        treasuryUSDCBalance.toString(),
        fundAmount.muln(8).divn(10).toString(),
      );

      // Verify token supply: 10M + 2M + 900k = 12,900,000
      // (performance package tokens are minted separately)
      const mint = await this.getMint(META);
      const expectedSupply = (10_000_000 + 2_000_000 + 900_000) * 10 ** 6;
      assert.equal(Number(mint.supply), expectedSupply);

      // Verify metadata authority transferred to dao_vault
      rawStoredMetadata = await this.banksClient.getAccount(tokenMetadata);
      storedMetadata = deserializeMetadata({
        ...rawStoredMetadata,
        publicKey: fromWeb3JsPublicKey(tokenMetadata),
        owner: fromWeb3JsPublicKey(rawStoredMetadata.owner),
        lamports: {
          basisPoints: BigInt(rawStoredMetadata.lamports),
          identifier: "SOL",
          decimals: 9,
        },
        rentEpoch: rawStoredMetadata.rentEpoch
          ? BigInt(rawStoredMetadata.rentEpoch)
          : undefined,
      });
      assert.ok(
        toWeb3JsPublicKey(storedMetadata.updateAuthority).equals(
          launchAccount.daoVault,
        ),
      );

      // Verify MintGovernor admin is still launch_signer (not yet transferred to DAO)
      const mintGovernorAddr = launchpadClient.getMintGovernorAddress({
        baseMint: META,
        launchSigner,
      });
      const mintGovernorAccount =
        await launchpadClient.mintGovernorClient.fetchMintGovernor(
          mintGovernorAddr,
        );
      assert.ok(mintGovernorAccount.admin.equals(launchSigner));
    });
  });

  describe("USDC allocation", function () {
    beforeEach(async function () {
      const result = await initializeMintWithSeeds(
        this.banksClient,
        this.launchpad_v8,
        this.payer,
      );

      META = result.tokenMint;
      launch = result.launch;
      launchSigner = result.launchSigner;
      launchAuthority = new Keypair();
    });

    it("sends all USDC to treasury when hasBidWall is false", async function () {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
          monthlySpendingLimitMembers: [this.payer.publicKey],
          performancePackageGrantee: this.payer.publicKey,
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
          monthsUntilInsidersCanUnlock: 24,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: false,
        })
        .rpc();

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();

      const fundAmount = new BN(200_000 * 10 ** 6); // 200k USDC (2x minimum)

      await setupFundCloseApprove(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority,
        fundAmount,
      });

      await settleViaLut(
        this,
        launchpadClient,
        {
          launch,
          baseMint: META,
          launchAuthority: launchAuthority.publicKey,
        },
        [launchAuthority],
      );

      const launchAccount = await launchpadClient.fetchLaunch(launch);

      // usdc_to_lp = 200k / 5 = 40k
      // usdc_to_dao = 200k - 40k = 160k (all goes to treasury, no bid wall)
      const treasuryUSDCBalance = await this.getTokenBalance(
        MAINNET_USDC,
        launchAccount.daoVault,
      );
      assert.equal(
        treasuryUSDCBalance.toString(),
        fundAmount.muln(4).divn(5).toString(),
      );
    });

    it("initializes bid wall when hasBidWall is true and funding exceeds 1.25x", async function () {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
          monthlySpendingLimitMembers: [this.payer.publicKey],
          performancePackageGrantee: this.payer.publicKey,
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
          monthsUntilInsidersCanUnlock: 24,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: true,
        })
        .rpc();

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();

      // Fund 200k (2x minimum of 100k, well above 1.25x threshold)
      const fundAmount = new BN(200_000 * 10 ** 6);

      await setupFundCloseApprove(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority,
        fundAmount,
      });

      await settleViaLut(
        this,
        launchpadClient,
        {
          launch,
          baseMint: META,
          launchAuthority: launchAuthority.publicKey,
        },
        [launchAuthority],
      );

      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { complete: {} });

      // usdc_to_lp = 200k / 5 = 40k
      // usdc_to_dao = 200k - 40k = 160k
      // usdc_to_dao_treasury = min(160k, 100k) = 100k
      // usdc_to_bid_wall = 160k - 100k = 60k
      const treasuryUSDCBalance = await this.getTokenBalance(
        MAINNET_USDC,
        launchAccount.daoVault,
      );
      assert.equal(treasuryUSDCBalance.toString(), minRaise.toString());

      // Verify bid wall was initialized with USDC
      const bidWallAddr = launchpadClient.bidWall.getBidWallAddress({
        baseMint: META,
        creator: launchSigner,
        nonce: new BN(0),
      });
      const bidWallAccount =
        await launchpadClient.bidWall.fetchBidWall(bidWallAddr);
      assert.isNotNull(bidWallAccount);
    });

    it("does not initialize bid wall when funding equals minimum raise", async function () {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
          monthlySpendingLimitMembers: [this.payer.publicKey],
          performancePackageGrantee: this.payer.publicKey,
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
          monthsUntilInsidersCanUnlock: 24,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: true,
        })
        .rpc();

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();

      // Fund exactly minimum raise
      await setupFundCloseApprove(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority,
        fundAmount: minRaise,
      });

      await settleViaLut(
        this,
        launchpadClient,
        {
          launch,
          baseMint: META,
          launchAuthority: launchAuthority.publicKey,
        },
        [launchAuthority],
      );

      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { complete: {} });

      // usdc_to_lp = 100k / 5 = 20k
      // usdc_to_dao = 100k - 20k = 80k
      // usdc_to_dao_treasury = min(80k, 100k) = 80k
      // usdc_to_bid_wall = 80k - 80k = 0 (no bid wall)
      const treasuryUSDCBalance = await this.getTokenBalance(
        MAINNET_USDC,
        launchAccount.daoVault,
      );
      assert.equal(
        treasuryUSDCBalance.toString(),
        minRaise.muln(4).divn(5).toString(),
      );

      // Bid wall should not be initialized
      const bidWallAddr = launchpadClient.bidWall.getBidWallAddress({
        baseMint: META,
        creator: launchSigner,
        nonce: new BN(0),
      });
      const bidWallRawAccount = await this.banksClient.getAccount(bidWallAddr);
      assert.isNull(bidWallRawAccount);
    });

    it("does not initialize bid wall at exactly 1.25x boundary", async function () {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6),
          monthlySpendingLimitMembers: [this.payer.publicKey],
          performancePackageGrantee: this.payer.publicKey,
          performancePackageTokenAmount: new BN(5_000_000 * 10 ** 6),
          monthsUntilInsidersCanUnlock: 24,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: true,
        })
        .rpc();

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();

      // Fund exactly 1.25x minimum = 125k
      const fundAmount = minRaise.muln(5).divn(4);

      await setupFundCloseApprove(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority,
        fundAmount,
      });

      await settleViaLut(
        this,
        launchpadClient,
        {
          launch,
          baseMint: META,
          launchAuthority: launchAuthority.publicKey,
        },
        [launchAuthority],
      );

      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { complete: {} });

      // usdc_to_lp = 125k / 5 = 25k
      // usdc_to_dao = 125k - 25k = 100k
      // usdc_to_dao_treasury = min(100k, 100k) = 100k
      // usdc_to_bid_wall = 100k - 100k = 0 (no bid wall)
      const treasuryUSDCBalance = await this.getTokenBalance(
        MAINNET_USDC,
        launchAccount.daoVault,
      );
      assert.equal(treasuryUSDCBalance.toString(), minRaise.toString());

      // Bid wall should not be initialized
      const bidWallAddr = launchpadClient.bidWall.getBidWallAddress({
        baseMint: META,
        creator: launchSigner,
        nonce: new BN(0),
      });
      const bidWallRawAccount = await this.banksClient.getAccount(bidWallAddr);
      assert.isNull(bidWallRawAccount);
    });
  });

  describe("refunding", function () {
    beforeEach(async function () {
      const result = await initializeMintWithSeeds(
        this.banksClient,
        this.launchpad_v8,
        this.payer,
      );

      META = result.tokenMint;
      launch = result.launch;
      launchSigner = result.launchSigner;
      launchAuthority = new Keypair();

      await this.setupBasicLaunch({
        baseMint: META,
        founders: [this.payer.publicKey],
        launchAuthority: launchAuthority.publicKey,
      });

      await launchpadClient
        .startLaunchIx({
          launch,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();
    });

    it("transitions to refunding when total approved amount is below minimum raise", async function () {
      // Fund enough to get past close_launch (>= minimum raise)
      const fundAmount = new BN(150_000 * 10 ** 6);
      await launchpadClient
        .fundIx({
          launch,
          amount: fundAmount,
          payer: this.payer.publicKey,
        })
        .rpc();

      await this.advanceBySeconds(secondsForLaunch + 1);
      await launchpadClient.closeLaunchIx({ launch }).rpc();

      // Approve only a small portion (below minimum raise)
      await launchpadClient
        .setFundingRecordApprovalIx({
          launch,
          approvedAmount: new BN(50_000 * 10 ** 6), // 50k, below 100k minimum
          funder: this.payer.publicKey,
          launchAuthority: launchAuthority.publicKey,
        })
        .signers([launchAuthority])
        .rpc();

      // Wait past 2-day approval window so launch authority doesn't need to sign
      await this.advanceBySeconds(60 * 60 * 24 * 2 + 1);

      await settleViaLut(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority: null,
      });

      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { refunding: {} });
      assert.isNull(launchAccount.dao);
      assert.isNull(launchAccount.daoVault);
      assert.isNull(launchAccount.unixTimestampCompleted);

      // Tokens were minted during initialize_launch, supply is 12.9M
      // (no additional tokens minted during settlement for refunding launches)
      const mint = await this.getMint(META);
      const expectedSupply = (10_000_000 + 2_000_000 + 900_000) * 10 ** 6;
      assert.equal(Number(mint.supply), expectedSupply);
    });

    it("fails when launch is in refunding state", async function () {
      // Fund below minimum so close_launch sets Refunding
      const fundAmount = new BN(100 * 10 ** 6); // 100 USDC, way below 100k minimum
      await launchpadClient
        .fundIx({
          launch,
          amount: fundAmount,
          payer: this.payer.publicKey,
        })
        .rpc();

      await this.advanceBySeconds(secondsForLaunch + 1);
      await launchpadClient.closeLaunchIx({ launch }).rpc();

      // Launch is now in Refunding state (set by close_launch)
      const launchAccount = await launchpadClient.fetchLaunch(launch);
      assert.deepEqual(launchAccount.state, { refunding: {} });

      // Try to settle — should fail
      const result = await trySettleViaLut(this, launchpadClient, {
        launch,
        baseMint: META,
        launchAuthority: null,
      });

      assert.isTrue(
        result.meta.logMessages.some((log: string) =>
          log.includes("InvalidLaunchState"),
        ),
      );
    });
  });
}
