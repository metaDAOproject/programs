import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  getPerformancePackageAddr,
  LAUNCHPAD_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import { initializeMintWithSeeds } from "../launchpad/utils.js";
import { createLookupTableForTransaction } from "../utils.js";
import * as token from "@solana/spl-token";
import * as multisig from "@sqds/multisig";

const { Permissions, Permission } = multisig.types;

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
      LAUNCHPAD_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(MAINNET_METEORA_CONFIG, dynamicConfig);
  });

  it("launch a DAO, have a multi-ix proposal pass, execute it, and have insiders vest their first 2 tranches", async function () {
    // Create multiple funders
    const funder1 = Keypair.generate();
    const funder2 = Keypair.generate();
    const funder3 = Keypair.generate();
    const spender = Keypair.generate();

    let META: PublicKey;
    let launch: PublicKey;
    let launchSigner: PublicKey;
    let dao: PublicKey;
    let daoTreasury: PublicKey;

    const minRaise = new BN(300_000 * 10 ** 6); // 300k USDC
    const launchPeriod = 60 * 60 * 24 * 2; // 2 days
    const monthlySpendingLimitAmount = new BN(25_000 * 10 ** 6); // 25k / month spending limit
    const performancePackageTokenAmount = new BN(10_000_000 * 10 ** 6); // 500k tokens premine

    // Initialize the launch
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad_v6,
      this.payer,
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    const createKey = Keypair.generate();

    const [insiderMultisigPda] = multisig.getMultisigPda({
      createKey: createKey.publicKey,
    });

    const [insiderMultisigVaultPda] = multisig.getVaultPda({
      multisigPda: insiderMultisigPda,
      index: 0,
    });

    const programConfigPda = multisig.getProgramConfigPda({})[0];

    const programConfig =
      await multisig.accounts.ProgramConfig.fromAccountAddress(
        this.squadsConnection,
        programConfigPda,
      );

    const cofounder0 = Keypair.generate();
    const cofounder1 = Keypair.generate();

    const insiderMultisigCreateIx = multisig.instructions.multisigCreateV2({
      treasury: programConfig.treasury,
      creator: this.payer.publicKey,
      multisigPda: insiderMultisigPda,
      configAuthority: null,
      createKey: createKey.publicKey,
      threshold: 1,
      members: [
        { key: cofounder0.publicKey, permissions: Permissions.all() },
        { key: cofounder1.publicKey, permissions: Permissions.all() },
      ],
      timeLock: 0,
      rentCollector: null,
    });

    const insiderMultisigCreateTx = new Transaction().add(
      insiderMultisigCreateIx,
    );
    insiderMultisigCreateTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    insiderMultisigCreateTx.feePayer = this.payer.publicKey;
    insiderMultisigCreateTx.sign(this.payer, createKey);
    await this.banksClient.processTransaction(insiderMultisigCreateTx);

    // Setup token accounts for funders
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);

    // Mint USDC to funders
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      500_000_000000,
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      400_000_000000,
    );

    // Initialize launch
    await this.launchpad_v6
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: launchPeriod,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers: [spender.publicKey],
        performancePackageGrantee: insiderMultisigVaultPda,
        performancePackageTokenAmount,
        // 2 years
        monthsUntilInsidersCanUnlock: 24,
        teamAddress: PublicKey.default,
      })
      .rpc();

    // Start launch
    await this.launchpad_v6.startLaunchIx({ launch }).rpc();

    // A total of 1M gets committed, entrepreneur caps at 500k

    // Fund from multiple sources
    await this.launchpad_v6
      .fundIx({
        launch,
        amount: new BN(500_000_000000),
        funder: funder1.publicKey,
        quoteMint: MAINNET_USDC,
      })
      .signers([funder1])
      .rpc();

    await this.launchpad_v6
      .fundIx({
        launch,
        amount: new BN(150_000_000000),
        quoteMint: MAINNET_USDC,
      })
      .rpc();

    await this.launchpad_v6
      .fundIx({
        launch,
        amount: new BN(350_000_000000),
        funder: funder3.publicKey,
        quoteMint: MAINNET_USDC,
      })
      .signers([funder3])
      .rpc();

    // Advance time and complete launch
    await this.advanceBySeconds(launchPeriod + 1);

    await this.launchpad_v6.closeLaunchIx({ launch }).rpc();

    const completeLaunchTx = await this.launchpad_v6
      .completeLaunchIx({
        launch,
        baseMint: META,
        finalRaiseAmount: new BN(500_000 * 1e6),
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
    const launchAccount = await this.launchpad_v6.fetchLaunch(launch);
    assert.exists(launchAccount.state.complete);
    assert.exists(launchAccount.dao);
    dao = launchAccount.dao;

    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    console.log(await this.getTokenBalance(META, launchSigner));
    console.log(await this.getTokenBalance(MAINNET_USDC, launchSigner));

    // Claim tokens for all funders
    await this.launchpad_v6.claimIx(launch, META, funder1.publicKey).rpc();
    await this.launchpad_v6.claimIx(launch, META).rpc();
    await this.launchpad_v6.claimIx(launch, META, funder3.publicKey).rpc();

    // Verify token distributions
    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    const payerBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);

    assert.equal(funder1Balance, 5_000_000_000000n); // 5M tokens
    assert.equal(payerBalance, 1_500_000_000000n); // 1.5M tokens
    assert.equal(funder3Balance, 3_500_000_000000n); // 3.5M tokens

    const preRefundFunder1QuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const preRefundPayerQuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const preRefundFunder3QuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );

    // Claim partial refunds
    await this.launchpad_v6
      .refundIx({ launch, funder: funder1.publicKey })
      .rpc();
    await this.launchpad_v6
      .refundIx({ launch, funder: this.payer.publicKey })
      .rpc();
    await this.launchpad_v6
      .refundIx({ launch, funder: funder3.publicKey })
      .rpc();

    const postRefundFunder1QuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      funder1.publicKey,
    );
    const postRefundPayerQuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      this.payer.publicKey,
    );
    const postRefundFunder3QuoteBalance = await this.getTokenBalance(
      MAINNET_USDC,
      funder3.publicKey,
    );

    assert.equal(
      postRefundFunder1QuoteBalance - preRefundFunder1QuoteBalance,
      250_000_000000n,
    );
    assert.equal(
      postRefundPayerQuoteBalance - preRefundPayerQuoteBalance,
      75_000_000000n,
    );
    assert.equal(
      postRefundFunder3QuoteBalance - preRefundFunder3QuoteBalance,
      175_000_000000n,
    );

    const performancePackage = getPerformancePackageAddr({
      createKey: launchSigner,
    })[0];

    const storedPerformancePackage =
      await this.priceBasedPerformancePackage.getPerformancePackage(
        performancePackage,
      );

    assert.equal(storedPerformancePackage.tranches.length, 5);

    assert.equal(
      storedPerformancePackage.tranches[0].priceThreshold.toNumber() / 10 ** 12,
      0.1,
    );
    assert.equal(
      storedPerformancePackage.tranches[1].priceThreshold.toNumber() / 10 ** 12,
      0.2,
    );
    assert.equal(
      storedPerformancePackage.tranches[2].priceThreshold.toNumber() / 10 ** 12,
      0.4,
    );
    assert.equal(
      storedPerformancePackage.tranches[3].priceThreshold.toNumber() / 10 ** 12,
      0.8,
    );
    assert.equal(
      storedPerformancePackage.tranches[4].priceThreshold.toNumber() / 10 ** 12,
      1.6,
    );

    assert.ok(storedPerformancePackage.oracleConfig.oracleAccount.equals(dao));
    assert.equal(storedPerformancePackage.oracleConfig.byteOffset, 8 + 1);
    assert.equal(
      storedPerformancePackage.totalTokenAmount.toNumber(),
      10_000_000 * 10 ** 6,
    );
    assert.ok(
      storedPerformancePackage.performancePackageAuthority.equals(vaultPda),
    );
    assert.ok(storedPerformancePackage.tokenMint.equals(META));
    assert.exists(storedPerformancePackage.state.locked);
    assert.equal(
      storedPerformancePackage.minUnlockTimestamp.toNumber(),
      Number((await this.banksClient.getClock()).unixTimestamp) +
        24 * 30 * 24 * 60 * 60,
    );
    assert.equal(
      storedPerformancePackage.twapLengthSeconds,
      3 * 30 * 24 * 60 * 60,
    );

    // Create proposal to mint tokens
    const mintAmount = new BN(1_000_000_000000); // 1M tokens
    const receiver = Keypair.generate();
    const receiverAccount = await this.createTokenAccount(
      META,
      receiver.publicKey,
    );

    // Two parts of the proposal: update DAO threshold to 5% and mint tokens to receiver
    const updateDaoIx = await this.futarchy
      .updateDaoIx({
        dao,
        params: {
          passThresholdBps: 500,
          secondsPerProposal: null,
          baseToStake: new BN(0),
          twapInitialObservation: null,
          twapStartDelaySeconds: null,
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
          teamSponsoredPassThresholdBps: null,
          teamAddress: null,
        },
      })
      .instruction();

    // Create a simple instruction for the proposal (mint tokens to receiver)
    const mintToReceiverIx = token.createMintToInstruction(
      META,
      receiverAccount,
      vaultPda,
      mintAmount.toNumber(),
    );

    const mintToReceiverMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [updateDaoIx, mintToReceiverIx],
    });

    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: mintToReceiverMessage,
    });

    const proposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
    });

    const [squadsProposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: 1n,
    });

    // Create the squads proposal first
    const squadsTx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    squadsTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    squadsTx.feePayer = this.payer.publicKey;
    squadsTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    await this.banksClient.processTransaction(squadsTx);

    // Now initialize the autocrat proposal with the proper squads proposal
    const proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposalPda,
    );

    const {
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      baseVault,
      quoteVault,
      question,
    } = this.futarchy.getProposalPdas(proposal, META, MAINNET_USDC, dao);

    // Stake tokens to meet the baseToStake requirement (100 billion = 100k META tokens)
    const stakeAmount = new BN(500_000 * 10 ** 6); // 100k META tokens
    await this.futarchy
      .stakeToProposalIx({
        proposal,
        dao,
        baseMint: META,
        amount: stakeAmount,
      })
      .rpc();

    // Launch the proposal first
    await this.futarchy
      .launchProposalIx({
        proposal,
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        squadsProposal: squadsProposalPda,
      })
      .rpc();

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(100 * 10 ** 6), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(
        question,
        quoteVault,
        MAINNET_USDC,
        new BN(100_000 * 1_000_000),
        2,
      )
      .rpc();

    // Make large buy in pass market to drive price up and make proposal pass
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(5_000 * 1_000_000), // 5k USDC
        minOutputAmount: new BN(0),
      })
      .rpc();

    for (let i = 0; i < 100; i++) {
      await this.advanceBySeconds(20_000); // Use seconds instead of slots

      // Continue buying in pass market to maintain high TWAP
      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: META,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(100 * 1_000_000), // 100 USDC
          minOutputAmount: new BN(0),
        })
        .rpc();
    }

    await this.futarchy.finalizeProposal(proposal);

    const storedProposal = await this.futarchy.getProposal(proposal);

    assert.exists(storedProposal.state.passed);

    const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda,
      transactionIndex: 1n,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    const txExecute = new Transaction().add(txExecuteIx.instruction);
    txExecute.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    txExecute.feePayer = this.payer.publicKey;
    txExecute.sign(this.payer, PERMISSIONLESS_ACCOUNT);

    console.log(txExecute);

    await this.banksClient.processTransaction(txExecute);

    const storedDao2 = await this.futarchy.getDao(dao);
    assert.equal(storedDao2.passThresholdBps, 500);

    const storedMeta = await this.getMint(META);

    assert.equal(storedMeta.supply, BigInt(23_900_000 * 10 ** 6)); // 10M ICO + 2M futarchy liquidity + 3M meteora liquidity + 10M package + 1M proposal

    const receiverBalance = await this.getTokenBalance(
      META,
      receiver.publicKey,
    );

    assert.equal(receiverBalance.toString(), "1000000000000");

    const spendingLimit = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    await this.createTokenAccount(MAINNET_USDC, spender.publicKey);

    const spendingLimitUseIx = multisig.instructions.spendingLimitUse({
      multisigPda,
      member: spender.publicKey,
      spendingLimit,
      mint: MAINNET_USDC,
      vaultIndex: 0,
      amount: 10_000 * 10 ** 6,
      decimals: 6,
      destination: spender.publicKey,
    });

    const spendingLimitUseTx = new Transaction().add(spendingLimitUseIx);
    spendingLimitUseTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    spendingLimitUseTx.feePayer = this.payer.publicKey;
    spendingLimitUseTx.sign(this.payer, spender);

    await this.banksClient.processTransaction(spendingLimitUseTx);

    const spendingLimitUse = await this.getTokenBalance(
      MAINNET_USDC,
      spender.publicKey,
    );

    assert.equal(spendingLimitUse.toString(), (10_000 * 10 ** 6).toString());

    const storedSpendingLimit =
      await multisig.accounts.SpendingLimit.fromAccountAddress(
        this.squadsConnection,
        spendingLimit,
      );
    assert.equal(
      storedSpendingLimit.amount.toString(),
      (25_000 * 10 ** 6).toString(),
    );
    assert.equal(
      storedSpendingLimit.remainingAmount.toString(),
      (15_000 * 10 ** 6).toString(),
    );

    this.advanceBySeconds(24 * 30 * 24 * 60 * 60);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        swapType: "buy",
        inputAmount: new BN(100_000 * 10 ** 6),
        minOutputAmount: new BN(0),
      })
      .rpc();

    this.advanceBySeconds(24 * 30 * 24 * 60 * 60);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        swapType: "buy",
        inputAmount: new BN(10_000 * 10 ** 6),
        minOutputAmount: new BN(0),
      })
      .rpc();

    // this is enough to move the price past $0.2

    let storedDao = await this.futarchy.getDao(dao);
    // should be around $0.22
    const rawLastPrice =
      storedDao.amm.state.spot.spot.oracle.lastPrice.toBuffer("le", 16);
    // console.log(storedDao.amm.state.spot.spot.oracle.lastPrice.toNumber() / 10 ** 12);

    let daoAccount = await this.banksClient.getAccount(dao);
    console.log(daoAccount.data.toString());
    daoAccount.data.set(rawLastPrice, 8 + 1 + 16 + 8 + 8 + 16);
    // we do this to speed up the test
    this.context.setAccount(dao, daoAccount);

    const startUnlockTx = await this.priceBasedPerformancePackage
      .startUnlockIx({
        performancePackage,
        oracleAccount: dao,
        recipient: insiderMultisigVaultPda,
      })
      .transaction();

    const squadsUnlockTx = new Transaction().add(
      multisig.instructions.vaultTransactionCreate({
        multisigPda: insiderMultisigPda,
        transactionIndex: 1n,
        creator: cofounder0.publicKey,
        rentPayer: this.payer.publicKey,
        vaultIndex: 0,
        ephemeralSigners: 0,
        transactionMessage: new TransactionMessage({
          payerKey: this.payer.publicKey,
          recentBlockhash: "",
          instructions: startUnlockTx.instructions,
        }),
      }),
      multisig.instructions.proposalCreate({
        multisigPda: insiderMultisigPda,
        creator: cofounder0.publicKey,
        rentPayer: this.payer.publicKey,
        transactionIndex: 1n,
        isDraft: false,
      }),
      multisig.instructions.proposalApprove({
        multisigPda: insiderMultisigPda,
        transactionIndex: 1n,
        member: cofounder0.publicKey,
      }),
    );

    squadsUnlockTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    squadsUnlockTx.feePayer = this.payer.publicKey;
    squadsUnlockTx.sign(this.payer, cofounder0);

    await this.banksClient.processTransaction(squadsUnlockTx);

    const txExecuteIx2 = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda: insiderMultisigPda,
      transactionIndex: 1n,
      member: cofounder1.publicKey,
    });
    // return;
    const txExecute2 = new Transaction().add(txExecuteIx2.instruction);
    txExecute2.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    txExecute2.feePayer = this.payer.publicKey;
    txExecute2.sign(this.payer, cofounder1);
    // txExecute2.sign(cofounder1);
    console.log(txExecute2);
    console.log(cofounder0.publicKey.toBase58());
    console.log(txExecute2.instructions[0].keys);
    console.log(insiderMultisigPda.toBase58());
    await this.banksClient.processTransaction(txExecute2);

    this.advanceBySeconds(3 * 30 * 24 * 60 * 60);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        swapType: "buy",
        inputAmount: new BN(100_000 * 10 ** 6),
        minOutputAmount: new BN(0),
      })
      .rpc();

    const daonow = await this.futarchy.getDao(dao);
    console.log(
      daonow.amm.state.spot.spot.oracle.lastPrice.toNumber() / 10 ** 12,
    );
    console.log(
      daonow.amm.state.spot.spot.oracle.lastObservation.toNumber() / 10 ** 12,
    );

    const preUnlockBalance = await this.getTokenBalance(
      META,
      insiderMultisigVaultPda,
    );

    await this.priceBasedPerformancePackage
      .completeUnlockIx({
        performancePackage,
        oracleAccount: dao,
        tokenMint: META,
        tokenRecipient: insiderMultisigVaultPda,
      })
      .rpc();

    const postUnlockBalance = await this.getTokenBalance(
      META,
      insiderMultisigVaultPda,
    );

    // should go through 2 tranches, or 40% of 10M = 4M tokens
    assert.equal(postUnlockBalance - preUnlockBalance, 4_000_000_000000n);
  });
}
