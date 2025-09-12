import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
} from "@solana/web3.js";
import { assert } from "chai";
import {
  FutarchyClient,
  LaunchpadClient,
  getDaoAddr,
  getProposalAddr,
  MAINNET_USDC,
  PriceMath,
  PERMISSIONLESS_ACCOUNT,
} from "@metadaoproject/futarchy/v0.6";
import { BN } from "bn.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccount,
  getAccount,
} from "@solana/spl-token";
import { initializeMintWithSeeds } from "../launchpad/utils.js";
import { createLookupTableForTransaction } from "../utils.js";
import * as token from "@solana/spl-token";
import * as multisig from "@sqds/multisig";

export default async function suite() {
  it("launch a DAO, have a multi-ix proposal pass, and execute it", async function () {
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
    const priceBasedUnlockAddress = Keypair.generate().publicKey;
    const priceBasedPremineAmount = new BN(500_000 * 10 ** 6); // 500k tokens premine

    // Initialize the launch
    const result = await initializeMintWithSeeds(
      this.banksClient,
      this.launchpad,
      this.payer
    );

    META = result.tokenMint;
    launch = result.launch;
    launchSigner = result.launchSigner;

    // Setup token accounts for funders
    await this.createTokenAccount(MAINNET_USDC, funder1.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder2.publicKey);
    await this.createTokenAccount(MAINNET_USDC, funder3.publicKey);

    // Mint USDC to funders
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder1.publicKey,
      500_000_000000
    );
    await this.transfer(
      MAINNET_USDC,
      this.payer,
      funder3.publicKey,
      400_000_000000
    );

    // Initialize launch
    await this.launchpad
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
        priceBasedUnlockAddress,
        priceBasedPremineAmount,
        priceBasedUnlockThreshold: new BN("120000000000"), // 2x minimum launch price
      })
      .rpc();

    // Start launch
    await this.launchpad.startLaunchIx({ launch }).rpc();

    // Fund from multiple sources
    await this.launchpad
      .fundIx({ launch, amount: new BN(500_000_000000), funder: funder1.publicKey, quoteMint: MAINNET_USDC })
      .signers([funder1])
      .rpc();

    await this.launchpad
      .fundIx({ launch, amount: new BN(150_000_000000), quoteMint: MAINNET_USDC })
      .rpc();

    await this.launchpad
      .fundIx({ launch, amount: new BN(350_000_000000), funder: funder3.publicKey, quoteMint: MAINNET_USDC })
      .signers([funder3])
      .rpc();

    // Advance time and complete launch
    await this.advanceBySeconds(launchPeriod + 3600);

    const completeLaunchTx = await this.launchpad
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

    // Verify launch completion and DAO creation
    const launchAccount = await this.launchpad.fetchLaunch(launch);
    assert.exists(launchAccount.state.complete);
    assert.exists(launchAccount.dao);
    dao = launchAccount.dao;

    // Claim tokens for all funders
    await this.launchpad.claimIx(launch, META, funder1.publicKey).rpc();

    await this.launchpad.claimIx(launch, META).rpc();

    await this.launchpad.claimIx(launch, META, funder3.publicKey).rpc();

    // Verify token distributions
    const funder1Balance = await this.getTokenBalance(META, funder1.publicKey);
    const payerBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const funder3Balance = await this.getTokenBalance(META, funder3.publicKey);

    assert.equal(funder1Balance.toString(), "5000000000000"); // 5M tokens
    assert.equal(payerBalance.toString(), "1500000000000"); // 1.5M tokens
    assert.equal(funder3Balance.toString(), "3500000000000"); // 3.5M tokens

    // Set up Squads multisig proposal following the pattern from fullProposal.test.ts
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    // Create proposal to mint tokens
    const mintAmount = new BN(1_000_000_000000); // 1M tokens
    const receiver = Keypair.generate();
    const receiverAccount = await this.createTokenAccount(
      META,
      receiver.publicKey
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
          twapMaxObservationChangePerUpdate: null,
          minQuoteFutarchicLiquidity: null,
          minBaseFutarchicLiquidity: null,
        },
      })
      .instruction();

    // Create a simple instruction for the proposal (mint tokens to receiver)
    const mintToReceiverIx = token.createMintToInstruction(
      META,
      receiverAccount,
      vaultPda,
      mintAmount.toNumber()
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
      squadsProposalPda
    );

    let {
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      baseVault,
      quoteVault,
      question,
    } = this.futarchy.getProposalPdas(proposal, META, MAINNET_USDC, dao);

    // Stake tokens to meet the baseToStake requirement (100 billion = 100k META tokens)
    const stakeAmount = new BN(100_000 * 10 ** 6); // 100k META tokens
    await this.futarchy.stakeToProposalIx({
      proposal,
      dao,
      baseMint: META,
      amount: stakeAmount,
    }).rpc();

    // Launch the proposal first
    await this.futarchy.launchProposalIx({
      proposal,
      dao,
      baseMint: META,
      quoteMint: MAINNET_USDC,
    }).rpc();

    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(100 * 10 ** 6), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(
        question,
        quoteVault,
        MAINNET_USDC,
        new BN(100_000 * 1_000_000),
        2
      )
      .rpc();

    // Make large buy in pass market to drive price up and make proposal pass
    await this.futarchy.conditionalSwapIx({
      dao,
      baseMint: META,
      quoteMint: MAINNET_USDC,
      proposal,
      market: "pass",
      swapType: "buy",
      inputAmount: new BN(5_000 * 1_000_000) // 5k USDC
    }).rpc();

    for (let i = 0; i < 100; i++) {
      await this.advanceBySeconds(20_000); // Use seconds instead of slots

      // Continue buying in pass market to maintain high TWAP
      await this.futarchy.conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: MAINNET_USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(100 * 1_000_000) // 100 USDC
      }).rpc();
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

    await this.banksClient.processTransaction(txExecute);

    const storedDao2 = await this.futarchy.getDao(dao);
    assert.equal(storedDao2.passThresholdBps, 500);

    const storedMeta = await this.getMint(META);

    assert.equal(storedMeta.supply, 13_500_000 * 10 ** 6); // 13M base + 500k premine

    const receiverBalance = await this.getTokenBalance(
      META,
      receiver.publicKey
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
      spender.publicKey
    );

    assert.equal(spendingLimitUse.toString(), (10_000 * 10 ** 6).toString());

    const storedSpendingLimit = await multisig.accounts.SpendingLimit.fromAccountAddress(this.squadsConnection, spendingLimit);
    assert.equal(storedSpendingLimit.amount.toString(), (25_000 * 10 ** 6).toString());
    assert.equal(storedSpendingLimit.remainingAmount.toString(), (15_000 * 10 ** 6).toString());
  });
}
