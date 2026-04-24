import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  BidWallClient,
  MAINNET_USDC,
  getBidWallAddr,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/futarchy";
import BN from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let bidWallClient: BidWallClient;
  let dao: PublicKey;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;
  let secondFunder: Keypair;
  let ammBaseVaultReserves: BN;
  let ammQuoteVaultReserves: BN;
  let minRaiseAmount: BN;
  let fundAmount: BN;

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
    bidWallClient = this.bidWall;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v7,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Create second funder
    secondFunder = Keypair.generate();
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );
    funderUsdcAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    minRaiseAmount = new BN(100_000 * 10 ** 6); // 100k

    // Initialize launch
    await this.launchpad_v7
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaiseAmount, // 100k
        secondsForLaunch: 60 * 60 * 24 * 4, // 4 days
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: new BN(10_000 * 10 ** 6), // 15k burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount: new BN(10), // Effectively no premine
        monthsUntilInsidersCanUnlock: 24, // 2 years
        teamAddress: PublicKey.default,
        hasBidWall: false,
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();

    await this.createTokenAccount(META, this.payer.publicKey);

    fundAmount = new BN(200_000_000_000); // 200K USDC - double the initial raise amount

    // Fund the launch
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // Advance clock and complete launch
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 100);
    await launchpadClient.closeLaunchIx({ launch }).rpc();

    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: this.payer.publicKey,
        approvedAmount: fundAmount,
      })
      .rpc();

    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        launchAuthority: this.payer.publicKey,
      })
      .transaction();

    const completeLaunchLut = await createLookupTableForTransaction(
      completeLaunchTx,
      this,
    );

    const completeLaunchMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: completeLaunchTx.instructions,
    }).compileToV0Message([completeLaunchLut]);

    const tx = new VersionedTransaction(completeLaunchMessage);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    // Verify launch completion and DAO creation
    const launchAccount = await this.launchpad_v7.fetchLaunch(launch);
    assert.exists(launchAccount.state.complete);
    assert.exists(launchAccount.dao);
    dao = launchAccount.dao;

    ammBaseVaultReserves = new BN(await this.getTokenBalance(META, dao));
    ammQuoteVaultReserves = new BN(
      await this.getTokenBalance(MAINNET_USDC, dao),
    );
  });

  it("successfully initializes a bid wall", async function () {
    let durationSeconds = 100;

    let launchAccount = await this.launchpad_v7.fetchLaunch(launch);

    await bidWallClient
      .initializeBidWallIx({
        amount: fundAmount.sub(minRaiseAmount).toNumber(),
        durationSeconds,
        initialAmmQuoteReserves: ammQuoteVaultReserves.toNumber(),
        authority: this.payer.publicKey,
        creator: this.payer.publicKey,
        nonce: new BN(0),
        daoTreasury: launchAccount.daoVault,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        payer: this.payer.publicKey,
      })
      .rpc();

    const [bidWall, bump] = getBidWallAddr({
      creator: this.payer.publicKey,
      baseMint: META,
      nonce: new BN(0),
    });

    const bidWallAccount = await bidWallClient.fetchBidWall(bidWall);

    assert.isNotNull(bidWallAccount);

    assert.equal(bidWallAccount.nonce.toString(), new BN(0).toString());
    assert.equal(
      bidWallAccount.initialAmmQuoteReserves.toString(),
      ammQuoteVaultReserves.toString(),
    );
    assert.equal(bidWallAccount.feesCollected.toString(), "0");
    assert.equal(bidWallAccount.baseBoughtAmount.toString(), "0");
    assert.equal(bidWallAccount.seqNum.toString(), "0");
    assert.equal(
      bidWallAccount.creator.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(
      bidWallAccount.authority.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(
      bidWallAccount.daoTreasury.toBase58(),
      launchAccount.daoVault.toBase58(),
    );
    assert.equal(bidWallAccount.baseMint.toBase58(), META.toBase58());
    assert.equal(bidWallAccount.durationSeconds, durationSeconds);
    assert.equal(bidWallAccount.pdaBump, bump);
  });
}
