import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  MAINNET_USDC,
  LAUNCHPAD_V0_8_PROGRAM_ID,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
} from "@metadaoproject/programs";
import {
  LaunchpadClient,
  getFundingRecordAddr,
} from "@metadaoproject/programs/launchpad/v0.8";
import * as multisig from "@sqds/multisig";
import BN from "bn.js";
import { initializeMintWithSeeds } from "../launchpad_v8/utils.js";
import { createLookupTableForTransaction } from "../utils.js";

export default async function suite() {
  before(async function () {
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    // discriminator + vault config authority
    const poolCreatorAuthorityOffset = 8 + 32;
    // discriminator + vault config authority + pool creator authority + pool fees config + activation type + collect fee mode
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_8_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );
  });

  it("full lifecycle: init → start → fund → close → approve → settle → finalize → claim → refund → claim_additional", async function () {
    const launchpadClient: LaunchpadClient = this.launchpad_v8;

    // Create funders and authorities
    const funder1 = Keypair.generate();
    const funder2 = Keypair.generate();
    const funder3 = Keypair.generate();
    const launchAuthority = Keypair.generate();
    const additionalTokensRecipient = Keypair.generate();

    const minRaise = new BN(300_000 * 10 ** 6); // 300k USDC
    const launchPeriod = 60 * 60 * 24 * 2; // 2 days
    const monthlySpendingLimitAmount = new BN(25_000 * 10 ** 6);
    const performancePackageTokenAmount = new BN(5_000_000 * 10 ** 6); // 5M tokens
    const additionalTokensAmount = new BN(1_000_000 * 10 ** 6); // 1M tokens

    // =====================
    // Setup: Create mint and derive addresses
    // =====================
    const result = await initializeMintWithSeeds(
      this.banksClient,
      launchpadClient,
      this.payer,
    );

    const META = result.tokenMint;
    const launch = result.launch;
    const launchSigner = result.launchSigner;

    // Setup USDC accounts for funders
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);

    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      500_000_000000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder2.publicKey,
      200_000_000000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      400_000_000000,
    );

    // =====================
    // 1. initialize_launch
    // =====================
    await launchpadClient
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: launchPeriod,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers: [this.payer.publicKey],
        performancePackageGrantee: this.payer.publicKey,
        performancePackageTokenAmount,
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
        launchAuthority: launchAuthority.publicKey,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
        additionalTokensAmount,
        hasBidWall: false,
      })
      .rpc();

    // Verify: tokens minted at init, MintGovernor setup
    // Supply = TOKENS_TO_PARTICIPANTS + TOKENS_TO_FUTARCHY_LIQUIDITY + TOKENS_TO_DAMM_V2_LIQUIDITY + additional_tokens
    // = 10M + 2M + 900k + 1M = 13.9M
    let mint = await this.getMint(META);
    const expectedInitSupply =
      (10_000_000 + 2_000_000 + 900_000 + 1_000_000) * 10 ** 6;
    assert.equal(Number(mint.supply), expectedInitSupply);

    let launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { initialized: {} });

    const mintGovernorAddr = launchpadClient.getMintGovernorAddress({
      baseMint: META,
      launchSigner,
    });
    const mintGovernorAccount =
      await launchpadClient.mintGovernorClient.fetchMintGovernor(
        mintGovernorAddr,
      );
    assert.ok(mintGovernorAccount.admin.equals(launchSigner));

    // =====================
    // 2. start_launch
    // =====================
    await launchpadClient
      .startLaunchIx({
        launch,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { live: {} });

    // =====================
    // 3. fund (multiple funders)
    // =====================
    // Funder1: 500k USDC
    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(500_000_000000),
        funder: funder1.publicKey,
      })
      .signers([funder1])
      .rpc();

    // Funder2 (payer): 200k USDC
    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(200_000_000000),
        funder: funder2.publicKey,
      })
      .signers([funder2])
      .rpc();

    // Funder3: 400k USDC
    await launchpadClient
      .fundIx({
        launch,
        amount: new BN(400_000_000000),
        funder: funder3.publicKey,
      })
      .signers([funder3])
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(
      launchAccount.totalCommittedAmount.toString(),
      new BN(1_100_000_000000).toString(),
    );

    // =====================
    // 4. close_launch
    // =====================
    await this.advanceBySeconds(launchPeriod + 1);

    await launchpadClient.closeLaunchIx({ launch }).rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { closed: {} });

    // =====================
    // 5. set_funding_record_approval (each funder, partial approvals)
    // =====================
    // Approve 250k of funder1's 500k
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder1.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(250_000_000000),
      })
      .signers([launchAuthority])
      .rpc();

    // Approve 100k of funder2's 200k
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder2.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(100_000_000000),
      })
      .signers([launchAuthority])
      .rpc();

    // Approve 150k of funder3's 400k
    await launchpadClient
      .setFundingRecordApprovalIx({
        launch,
        funder: funder3.publicKey,
        launchAuthority: launchAuthority.publicKey,
        approvedAmount: new BN(150_000_000000),
      })
      .signers([launchAuthority])
      .rpc();

    // Total approved: 250k + 100k + 150k = 500k (above 300k minimum)

    // =====================
    // 6. settle_launch → verify minting, DAO creation
    // =====================
    const settleTx = await launchpadClient
      .settleLaunchIx({
        launch,
        baseMint: META,
        launchAuthority: launchAuthority.publicKey,
      })
      .signers([launchAuthority])
      .transaction();

    const lut = await createLookupTableForTransaction(settleTx, this);

    const settleMessage = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: settleTx.instructions,
    }).compileToV0Message([lut]);

    const settleVersionedTx = new VersionedTransaction(settleMessage);
    settleVersionedTx.sign([this.payer, launchAuthority]);

    await this.banksClient.processTransaction(settleVersionedTx);

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.deepEqual(launchAccount.state, { complete: {} });
    assert.isNotNull(launchAccount.dao);
    assert.isNotNull(launchAccount.daoVault);
    assert.isNotNull(launchAccount.unixTimestampCompleted);

    // Supply unchanged from init (tokens were minted at initialize_launch)
    mint = await this.getMint(META);
    assert.equal(Number(mint.supply), expectedInitSupply);

    // Verify USDC distribution: 80% to treasury (no bid wall)
    // Total approved = 500k, usdc_to_lp = 500k / 5 = 100k, usdc_to_dao = 400k
    const treasuryUSDCBalance = await this.getTokenBalance(
      MAINNET_USDC,
      launchAccount.daoVault,
    );
    assert.equal(
      treasuryUSDCBalance.toString(),
      new BN(400_000_000000).toString(),
    );

    // =====================
    // 7. finalize_launch → verify PP v2 setup, MintGovernor admin transfer
    // =====================
    assert.equal(launchAccount.isFinalized, false);

    await launchpadClient
      .finalizeLaunchIx({
        launch,
        baseMint: META,
        performancePackageGrantee: launchAccount.performancePackageGrantee,
      })
      .rpc();

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.equal(launchAccount.isFinalized, true);

    // Verify MintGovernor admin transferred to DAO squads vault
    const daoAddr = launchpadClient.getLaunchDaoAddress({ launch });
    const [squadsMultisig] = multisig.getMultisigPda({ createKey: daoAddr });
    const [squadsMultisigVault] = multisig.getVaultPda({
      multisigPda: squadsMultisig,
      index: 0,
    });

    const updatedMintGovernor =
      await launchpadClient.mintGovernorClient.fetchMintGovernor(
        mintGovernorAddr,
      );
    assert.ok(updatedMintGovernor.admin.equals(squadsMultisigVault));

    // Verify PP v2 was initialized
    const performancePackageAddr =
      launchpadClient.getLaunchPerformancePackageAddress({ launch });
    const ppAccount =
      await launchpadClient.performancePackageV2.fetchPerformancePackage(
        performancePackageAddr,
      );
    assert.isNotNull(ppAccount);
    assert.ok(ppAccount.authority.equals(squadsMultisigVault));
    assert.ok(
      ppAccount.recipient.equals(launchAccount.performancePackageGrantee),
    );

    // Verify DAO MintAuthority was created for the squads_multisig_vault
    const daoMintAuthorityAddr = launchpadClient.getMintAuthorityAddress({
      mintGovernor: mintGovernorAddr,
      authorizedMinter: squadsMultisigVault,
    });
    const daoMintAuthorityAccount =
      await launchpadClient.mintGovernorClient.fetchMintAuthority(
        daoMintAuthorityAddr,
      );
    assert.ok(
      daoMintAuthorityAccount.authorizedMinter.equals(squadsMultisigVault),
    );
    assert.isNull(daoMintAuthorityAccount.maxTotal);

    // =====================
    // 8. claim (each funder)
    // =====================
    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder1.publicKey })
      .rpc();
    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder2.publicKey })
      .rpc();
    await launchpadClient
      .claimIx({ launch, baseMint: META, funder: funder3.publicKey })
      .rpc();

    // Verify token distributions proportional to approved amounts
    // Total approved = 500k, TOKENS_TO_PARTICIPANTS = 10M
    // Funder1: 250k/500k * 10M = 5M tokens
    // Funder2: 100k/500k * 10M = 2M tokens
    // Funder3: 150k/500k * 10M = 3M tokens
    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    const funder2Balance = await this.getTokenBalance(META, funder2.publicKey);
    const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);

    assert.equal(funder1Balance, 5_000_000_000000n);
    assert.equal(funder2Balance, 2_000_000_000000n);
    assert.equal(funder3Balance, 3_000_000_000000n);

    // =====================
    // 9. refund (over-committed funders get back excess USDC)
    // =====================
    const preRefundFunder1Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const preRefundFunder2Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder2.publicKey,
    );
    const preRefundFunder3Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );

    await launchpadClient.refundIx({ launch, funder: funder1.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder2.publicKey }).rpc();
    await launchpadClient.refundIx({ launch, funder: funder3.publicKey }).rpc();

    const postRefundFunder1Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const postRefundFunder2Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder2.publicKey,
    );
    const postRefundFunder3Quote = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );

    // Funder1: committed 500k, approved 250k → refund 250k
    assert.equal(
      postRefundFunder1Quote - preRefundFunder1Quote,
      250_000_000000n,
    );
    // Funder2: committed 200k, approved 100k → refund 100k
    assert.equal(
      postRefundFunder2Quote - preRefundFunder2Quote,
      100_000_000000n,
    );
    // Funder3: committed 400k, approved 150k → refund 250k
    assert.equal(
      postRefundFunder3Quote - preRefundFunder3Quote,
      250_000_000000n,
    );

    // =====================
    // 10. claim_additional_token_allocation
    // =====================
    await launchpadClient
      .claimAdditionalTokenAllocationIx({
        launch,
        baseMint: META,
        additionalTokensRecipient: additionalTokensRecipient.publicKey,
      })
      .rpc();

    const additionalRecipientBalance = await this.getTokenBalance(
      META,
      additionalTokensRecipient.publicKey,
    );
    assert.equal(
      additionalRecipientBalance.toString(),
      additionalTokensAmount.toString(),
    );

    launchAccount = await launchpadClient.fetchLaunch(launch);
    assert.isTrue(launchAccount.additionalTokensClaimed);
  });
}
