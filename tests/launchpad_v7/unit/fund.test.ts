import { Keypair, PublicKey, Signer } from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getFundingRecordAddr,
  LaunchpadClient,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.7";
import { getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let autocratClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let baseVault: PublicKey;
  let quoteVault: PublicKey;
  let funderBaseAccount: PublicKey;
  let funderQuoteAccount: PublicKey;
  let launchAuthority: Signer;

  const minRaise = new BN(1000_000000); // 1000 USDC
  const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
  const monthlySpend = new BN(100_000000);
  const recipientAddress = Keypair.generate().publicKey;
  const premineAmount = new BN(500_000_000);
  const unlockThreshold = new BN(2000_000000);

  before(async function () {
    autocratClient = this.futarchy;
    launchpadClient = this.launchpad_v7;
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
    launchAuthority = new Keypair();

    baseVault = getAssociatedTokenAddressSync(META, launchSigner, true);
    quoteVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      launchSigner,
      true,
    );
    funderBaseAccount = getAssociatedTokenAddressSync(
      META,
      this.payer.publicKey,
    );
    funderQuoteAccount = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      this.payer.publicKey,
    );

    // TODO: put this in main test
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
        performancePackageGrantee: recipientAddress,
        performancePackageTokenAmount: premineAmount,
        monthsUntilInsidersCanUnlock: 18,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
      })
      .rpc();
  });

  it("fails to fund the launch before it's started", async function () {
    await this.createTokenAccount(META, this.payer.publicKey);
    const fundAmount = new BN(100_000000); // 100 USDC

    try {
      await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "InvalidLaunchState");
    }
  });

  it("successfully funds the launch", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      fundAmount.toString(),
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), fundAmount.toString());

    const [fundingRecord, pdaBump] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      fundAmount.toString(),
    );
    assert.equal(fundingRecordAccount.pdaBump, pdaBump);
    assert.ok(fundingRecordAccount.funder.equals(this.payer.publicKey));
  });

  it("successfully funds the launch multiple times", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount1 = new BN(100_000000); // 100 USDC
    const fundAmount2 = new BN(200_000000); // 200 USDC
    const totalAmount = fundAmount1.add(fundAmount2);

    // First funding
    await launchpadClient.fundIx({ launch, amount: fundAmount1 }).rpc();

    // Second funding
    await launchpadClient.fundIx({ launch, amount: fundAmount2 }).rpc();

    const launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      totalAmount.toString(),
    );

    const usdcVaultAccount = await getAccount(this.banksClient, quoteVault);
    assert.equal(usdcVaultAccount.amount.toString(), totalAmount.toString());

    const [fundingRecord] = getFundingRecordAddr(
      launchpadClient.getProgramId(),
      launch,
      this.payer.publicKey,
    );

    const fundingRecordAccount =
      await launchpadClient.fetchFundingRecord(fundingRecord);
    assert.equal(
      fundingRecordAccount.committedAmount.toString(),
      totalAmount.toString(),
    );
  });

  it("fails to fund the launch after time expires", async function () {
    await launchpadClient
      .startLaunchIx({ launch, launchAuthority: launchAuthority.publicKey })
      .signers([launchAuthority])
      .rpc();
    await this.createTokenAccount(META, this.payer.publicKey);

    const fundAmount = new BN(100_000000); // 100 USDC

    // Fast forward time past the launch period (60 * 60 seconds)
    await this.advanceBySeconds(60 * 60 * 24 * 7 + 10);

    try {
      await launchpadClient.fundIx({ launch, amount: fundAmount }).rpc();
      assert.fail("Expected fund instruction to fail");
    } catch (e) {
      assert.include(e.message, "LaunchExpired");
    }
  });
}
