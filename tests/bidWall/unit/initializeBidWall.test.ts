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
  MAINNET_METEORA_CONFIG,
  getBidWallAddr,
  getMeteoraPoolAddr,
  getLaunchpadMeteoraPoolPositionAddr,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let bidWallClient: BidWallClient;
  let dao: PublicKey;
  let daoTreasury: PublicKey;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;
  let secondFunder: Keypair;

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad;
    bidWallClient = this.bidWall;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
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

    // Initialize launch
    await this.setupBasicLaunch({
      baseMint: META,
      founders: [this.payer.publicKey],
    });

    await launchpadClient.startLaunchIx({ launch }).rpc();

    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000_000_000); // 100K USDC

    // Fund the launch
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    // // Advance clock and complete launch
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 100);
    await launchpadClient.closeLaunchIx({ launch }).rpc();
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({
        launch,
        quoteMint: MAINNET_USDC,
        baseMint: META,
        finalRaiseAmount: null,
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
    const launchAccount = await this.launchpad.fetchLaunch(launch);
    assert.exists(launchAccount.state.complete);
    assert.exists(launchAccount.dao);
    dao = launchAccount.dao;
  });

  it.only("successfully initializes a bid wall", async function () {
    let minDuration = 100;

    await bidWallClient
      .initializeBidWallIx({
        amount: 100_000_000000,
        minDuration,
        dao: dao,
        authority: this.payer.publicKey,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        payer: this.payer.publicKey,
        meteoraConfig: MAINNET_METEORA_CONFIG,
      })
      .rpc();

    const [bidWall] = getBidWallAddr({
      authority: this.payer.publicKey,
      baseMint: META,
    });

    const bidWallAccount = await bidWallClient.fetchBidWall(bidWall);

    const [pool] = getMeteoraPoolAddr({
      baseMint: META,
      quoteMint: MAINNET_USDC,
      meteoraConfig: MAINNET_METEORA_CONFIG,
    });

    const [position] = getLaunchpadMeteoraPoolPositionAddr({ baseMint: META });

    assert.isNotNull(bidWallAccount);

    assert.equal(
      bidWallAccount.authority.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(bidWallAccount.baseMint.toBase58(), META.toBase58());
    assert.equal(bidWallAccount.dao.toBase58(), dao.toBase58());
    assert.equal(bidWallAccount.pool.toBase58(), pool.toString());
    assert.equal(bidWallAccount.position.toBase58(), position.toString());
    assert.equal(bidWallAccount.minDuration, minDuration);
  });

  it.skip("fails when launch is not complete", async function () {
    try {
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });
}
