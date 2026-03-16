import {
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  Signer,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  getMetadataAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.7";
import { BN } from "bn.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as token from "@solana/spl-token";
import {
  MAINNET_USDC,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.7";
import { initializeMintWithSeeds } from "../utils.js";

export default function suite() {
  let futarchyClient: FutarchyClient;
  let launchpadClient: LaunchpadClient;
  let META: PublicKey;
  let launch: PublicKey;
  let launchSigner: PublicKey;
  let launchAuthority: Signer;

  before(async function () {
    futarchyClient = this.futarchy;
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
  });

  it("initializes a launch with valid parameters", async function () {
    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    const [, pdaBump] = getLaunchAddr(launchpadClient.getProgramId(), META);
    const [, launchSignerPdaBump] = getLaunchSignerAddr(
      launchpadClient.getProgramId(),
      launch,
    );

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
        hasBidWall: false,
      })
      .rpc();

    const storedLaunch = await launchpadClient.fetchLaunch(launch);

    assert.equal(
      storedLaunch.minimumRaiseAmount.toString(),
      minRaise.toString(),
    );
    assert.ok(storedLaunch.launchAuthority.equals(launchAuthority.publicKey));
    assert.ok(storedLaunch.launchSigner.equals(launchSigner));
    assert.equal(storedLaunch.launchSignerPdaBump, launchSignerPdaBump);
    assert.ok(
      storedLaunch.launchQuoteVault.equals(
        token.getAssociatedTokenAddressSync(MAINNET_USDC, launchSigner, true),
      ),
    );
    assert.ok(
      storedLaunch.launchBaseVault.equals(
        token.getAssociatedTokenAddressSync(META, launchSigner, true),
      ),
    );
    assert.ok(storedLaunch.baseMint.equals(META));
    assert.equal(storedLaunch.pdaBump, pdaBump);
    assert.equal(storedLaunch.totalCommittedAmount.toString(), "0");
    assert.equal(storedLaunch.seqNum.toString(), "0");
    assert.exists(storedLaunch.state.initialized);
    assert.isNull(storedLaunch.unixTimestampStarted);
    assert.isNull(storedLaunch.dao);
    assert.equal(storedLaunch.accumulatorActivationDelaySeconds, 0);
  });

  it("fails when monthly spending limit members contains duplicates", async function () {
    const minRaise = new BN(1000_000000);
    const secondsForLaunch = 60 * 60 * 24 * 7;
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    try {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch: secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: monthlySpend,
          monthlySpendingLimitMembers: [
            this.payer.publicKey,
            this.payer.publicKey,
          ],
          performancePackageGrantee: recipientAddress,
          performancePackageTokenAmount: premineAmount,
          monthsUntilInsidersCanUnlock: 18,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: false,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidMonthlySpendingLimitMembers");
    }
  });

  it("fails when monthly spending limit members is empty", async function () {
    const minRaise = new BN(1000_000000);
    const secondsForLaunch = 60 * 60 * 24 * 7;
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    try {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch: secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: monthlySpend,
          monthlySpendingLimitMembers: [],
          performancePackageGrantee: recipientAddress,
          performancePackageTokenAmount: premineAmount,
          monthsUntilInsidersCanUnlock: 18,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          hasBidWall: false,
        })
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "InvalidMonthlySpendingLimitMembers");
    }
  });

  it("rejects accumulator activation delay >= seconds_for_launch", async function () {
    const minRaise = new BN(1000_000000);
    const secondsForLaunch = 60 * 60 * 24 * 7;
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    try {
      await launchpadClient
        .initializeLaunchIx({
          tokenName: "META",
          tokenSymbol: "META",
          tokenUri: "https://example.com",
          minimumRaiseAmount: minRaise,
          secondsForLaunch: secondsForLaunch,
          baseMint: META,
          quoteMint: MAINNET_USDC,
          monthlySpendingLimitAmount: monthlySpend,
          monthlySpendingLimitMembers: [this.payer.publicKey],
          performancePackageGrantee: recipientAddress,
          performancePackageTokenAmount: premineAmount,
          monthsUntilInsidersCanUnlock: 18,
          teamAddress: PublicKey.default,
          launchAuthority: launchAuthority.publicKey,
          accumulatorActivationDelaySeconds: secondsForLaunch,
          hasBidWall: false,
        })
        .rpc();
      assert.fail("Expected initialize_launch to fail");
    } catch (e) {
      assert.include(e.message, "InvalidAccumulatorActivationDelaySeconds");
    }
  });

  it("fails when launch signer is faked", async function () {
    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const fakeLaunchSigner = Keypair.generate();
    const monthlySpend = new BN(100_000000);
    const recipientAddress = Keypair.generate().publicKey;
    const premineAmount = new BN(500_000_000);

    const fakeSignerFrom = Keypair.generate();
    const fakeSignerFromPubkey = fakeSignerFrom.publicKey;

    META = await PublicKey.createWithSeed(
      fakeSignerFrom.publicKey,
      "fake-launch-signer",
      token.TOKEN_PROGRAM_ID,
    );

    const rent = await this.banksClient.getRent();

    const lamports = Number(await rent.minimumBalance(BigInt(token.MINT_SIZE)));

    const tx = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: META,
        basePubkey: fakeSignerFromPubkey,
        seed: "fake-launch-signer",
        lamports: lamports,
        space: token.MINT_SIZE,
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(
        META,
        6,
        fakeLaunchSigner.publicKey,
        null,
      ),
    );
    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer, fakeSignerFrom);

    await this.banksClient.processTransaction(tx);

    const [tokenMetadata] = getMetadataAddr(META);

    try {
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
          hasBidWall: false,
        })
        .accounts({
          launch,
          launchSigner: fakeLaunchSigner.publicKey,
          quoteVault: token.getAssociatedTokenAddressSync(
            MAINNET_USDC,
            fakeLaunchSigner.publicKey,
            true,
          ),
          baseVault: token.getAssociatedTokenAddressSync(
            META,
            fakeLaunchSigner.publicKey,
            true,
          ),
          launchAuthority: launchAuthority.publicKey,
          quoteMint: MAINNET_USDC,
          baseMint: META,
          tokenMetadata,
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        })
        .preInstructions([
          token.createAssociatedTokenAccountIdempotentInstruction(
            this.payer.publicKey,
            getAssociatedTokenAddressSync(
              MAINNET_USDC,
              fakeLaunchSigner.publicKey,
              true,
            ),
            fakeLaunchSigner.publicKey,
            MAINNET_USDC,
          ),
        ])
        .remainingAccounts([
          {
            pubkey: fakeLaunchSigner.publicKey,
            isWritable: false,
            isSigner: true,
          },
        ])
        .signers([fakeLaunchSigner])
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      assert.include(e.message, "ConstraintSeeds");
    }
  });
}
