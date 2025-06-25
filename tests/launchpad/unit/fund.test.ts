import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  AutocratClient,
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.5";
import { createMint, mintTo, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import {
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let autocratClient: AutocratClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let baseVault: PublicKey;
  let quoteVault: PublicKey;
  let funderBaseAccount: PublicKey;
  let funderQuoteAccount: PublicKey;

  const minRaise = new BN(1000_000000); // 1000 USDC

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

    baseVault = getAssociatedTokenAddressSync(META, launchSigner, true);
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true
    );
    funderBaseAccount = getAssociatedTokenAddressSync(
      META,
      this.payer.publicKey
    );
    funderQuoteAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey
    );

    // Initialize launch
    await launchpadClient
      .initializeLaunchIx(
        "MTN",
        "MTN",
        "https://example.com",
        minRaise,
        60 * 60,
        META,
        MAINNET_USDC
      )
      .rpc();
  });

  it("fails to fund the launch before it's started", async function () {
    await this.createTokenAccount(META, this.payer.publicKey);
    const fundAmount = new BN(100_000000); // 100 USDC

    try {
      await launchpadClient
        .fundIx(launch, fundAmount, undefined, MAINNET_USDC)
        .rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });

  it("successfully funds the launch", async function () {
    await launchpadClient.startLaunchIx(launch).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    await launchpadClient
      .fundIx(launch, fundAmount, undefined, MAINNET_USDC)
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      fundAmount.toString()
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), fundAmount.toString());

    const [fundingRecord, pdaBump] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey
    );

    const fundingRecordAccount = await launchpadClient.fetchFundingRecord(
      fundingRecord
    );
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      fundAmount.toString()
    );
    assert.equal(fundingRecordAccount.pdaBump, pdaBump);
    assert.ok(fundingRecordAccount.funder.equals(this.payer.publicKey));
    assert.ok(fundingRecordAccount.seqNum.eqn(0));
  });

  it("successfully funds the launch multiple times", async function () {
    await launchpadClient.startLaunchIx(launch).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount1 = new BN(100_000000); // 100 USDC
    const fundAmount2 = new BN(200_000000); // 200 USDC
    const totalAmount = fundAmount1.add(fundAmount2);

    // First funding
    await launchpadClient
      .fundIx(launch, fundAmount1, undefined, MAINNET_USDC)
      .rpc();

    // Second funding
    await launchpadClient
      .fundIx(launch, fundAmount2, undefined, MAINNET_USDC)
      .rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      totalAmount.toString()
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), totalAmount.toString());

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey
    );

    const fundingRecordAccount = await launchpadClient.fetchFundingRecord(
      fundingRecord
    );
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      totalAmount.toString()
    );
    assert.ok(fundingRecordAccount.seqNum.eqn(1));
  });

  it("fails to fund the launch after time expires", async function () {
    await launchpadClient.startLaunchIx(launch).rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    // Fast forward time past the launch period (60 * 60 seconds)
    await this.advanceBySeconds(60 * 60 * 2);

    try {
      await launchpadClient
        .fundIx(launch, fundAmount, undefined, MAINNET_USDC)
        .rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "LaunchExpired");
    }
  });
}
