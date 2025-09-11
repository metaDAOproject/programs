import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getFundingRecordAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";
import { createLookupTableForTransaction } from "../../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let dao: PublicKey;
  let daoTreasury: PublicKey;
  let METAKP: Keypair;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let quoteVault: PublicKey;
  let funderUsdcAccount: PublicKey;
  let secondFunder: Keypair;

  const minRaise = new BN(100_000_000); // 1000 USDCC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(10_000_000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(600_000_000_000_0);

  before(async function () {
    futarchyClient = this.futarchy;
    launchpadClient = this.launchpad;
  });

  beforeEach(async function () {
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Create second funder
    secondFunder = Keypair.generate();
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true
    );
    funderUsdcAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey
    );

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        priceBasedUnlockAddress: recipientAddress,
        priceBasedPremineAmount: premineAmount,
        priceBasedUnlockThreshold: new BN("2000000000000"), // 2e12 price threshold
      })
      .rpc();

    await launchpadClient.startLaunchIx({ launch }).rpc();

    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000_000_000); // 100K USDC

    // Fund the launch
    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
  });

  it("successfully claims tokens after launch completion", async function () {
    // // Advance clock and complete launch
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 100);
    const completeLaunchTx = await launchpadClient
      .completeLaunchIx({ launch, quoteMint: MAINNET_USDC, baseMint: META })
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

    // Add logging to understand token distribution
    const launchAccount = await launchpadClient.fetchLaunch(launch);
    console.log("=== POST LAUNCH COMPLETION DEBUG ===");
    console.log(
      "Launch total committed amount:",
      launchAccount.totalCommittedAmount.toString()
    );
    console.log(
      "Launch minimum raise:",
      launchAccount.minimumRaiseAmount.toString()
    );

    // Check launch base vault balance
    console.log("=== LAUNCH BASE VAULT BALANCE CHECK ===");
    try {
      const accountInfo = await this.context.banksClient.getAccount(
        launchAccount.launchBaseVault
      );
      if (accountInfo && accountInfo.data && accountInfo.data.length >= 72) {
        const balanceBuffer = accountInfo.data.slice(64, 72);
        const balance = Buffer.from(balanceBuffer).readBigUInt64LE(0);
        console.log("Launch base vault balance:", balance.toString());
      } else {
        console.log("Launch base vault data invalid");
      }
    } catch (error) {
      console.log("Launch base vault account not found");
    }

    // Check total supply
    try {
      const mint = await this.getMint(META);
      console.log("Total META supply:", mint.supply.toString());
    } catch (error) {
      console.log("ERROR getting mint info:", error.message);
    }

    const initialTokenBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey
    );
    console.log("Initial payer token balance:", initialTokenBalance.toString());
    assert.equal(initialTokenBalance.toString(), "0");

    // Get funding record info before claiming
    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey
    );
    const fundingRecordAccount = await launchpadClient.fetchFundingRecord(
      fundingRecord
    );
    console.log(
      "Payer committed amount:",
      fundingRecordAccount.committedAmount.toString()
    );
    console.log(
      "Expected claim percentage:",
      (
        (fundingRecordAccount.committedAmount.toNumber() /
          launchAccount.totalCommittedAmount.toNumber()) *
        100
      ).toFixed(2) + "%"
    );

    // Claim tokens
    console.log("=== ATTEMPTING CLAIM ===");
    await launchpadClient.claimIx(launch, META).rpc();

    const finalTokenBalance = await this.getTokenBalance(
      META,
      this.payer.publicKey
    );
    const expectedTokens = new BN(10_000_000 * 1_000_000); // full supply

    assert.equal(finalTokenBalance.toString(), expectedTokens.toString());

    // Verify funding record is closed
    // fundingRecord already declared above

    try {
      await launchpadClient.fetchFundingRecord(fundingRecord);
      assert.fail("Funding record should be closed");
    } catch (e) {
      assert.include(e.message, "Could not find");
    }
  });

  it("fails when launch is not complete", async function () {
    try {
      await launchpadClient.claimIx(launch, META).rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });
}
