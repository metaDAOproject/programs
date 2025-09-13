import { 
  Keypair, 
  Transaction, 
  SystemProgram,
  TransactionMessage,
  ComputeBudgetProgram,
  PublicKey
} from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import * as token from "@solana/spl-token";
import { getDaoAddr, MAINNET_USDC, PERMISSIONLESS_ACCOUNT, PriceMath } from "@metadaoproject/futarchy/v0.6";
import * as multisig from "@sqds/multisig";

const DAY_IN_SECONDS = 60 * 60 * 24;

export default function () {
  it("should enable price-based unlocks of a premine", async function () {
    const minRaise = new BN(1000_000000); // 1000 USDC
    const secondsForLaunch = 60 * 60 * 24 * 7; // 1 week
    const monthlySpend = new BN(100_000000);
    // Create a multisig for the recipient with 3 arbitrary members
    const recipientMember1 = Keypair.generate();
    const recipientMember2 = Keypair.generate();
    const recipientMember3 = Keypair.generate();
    const recipientCreateKey = Keypair.generate();
    
    // Calculate PDAs correctly
    const [recipientMultisigPda] = multisig.getMultisigPda({ 
      createKey: recipientCreateKey.publicKey 
    });
    const [recipientVaultPda] = multisig.getVaultPda({
      multisigPda: recipientMultisigPda,
      index: 0,
    });
    
    const recipientAddress = recipientVaultPda; // Use vault PDA as the recipient address
    
    // Get program config for treasury
    const programConfigPda = multisig.getProgramConfigPda({})[0];
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(
      this.squadsConnection,
      programConfigPda
    );

    // Initialize the recipient multisig with 3/3 threshold
    const createMultisigIx = multisig.instructions.multisigCreateV2({
      createKey: recipientCreateKey.publicKey,
      creator: this.payer.publicKey,
      multisigPda: recipientMultisigPda,
      configAuthority: null,
      treasury: programConfig.treasury,
      rentCollector: null,
      members: [
        { key: recipientMember1.publicKey, permissions: multisig.types.Permissions.all() },
        { key: recipientMember2.publicKey, permissions: multisig.types.Permissions.all() },
        { key: recipientMember3.publicKey, permissions: multisig.types.Permissions.all() },
      ],
      threshold: 3, // Require all 3 members to approve
      timeLock: 0,
    });
    
    const createMultisigTx = new Transaction().add(createMultisigIx);
    createMultisigTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    createMultisigTx.feePayer = this.payer.publicKey;
    createMultisigTx.sign(this.payer, recipientCreateKey);
    
    
    await this.banksClient.processTransaction(createMultisigTx);
    const premineAmount = new BN(500_000_000);

    const tokenMint = await this.createMint(this.payer.publicKey, 6);

    // Fund each multisig member with SOL
    const fundMember1Tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: recipientMember1.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundMember1Tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundMember1Tx.feePayer = this.payer.publicKey;
    fundMember1Tx.sign(this.payer);
    await this.banksClient.processTransaction(fundMember1Tx);

    const fundMember2Tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: recipientMember2.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundMember2Tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundMember2Tx.feePayer = this.payer.publicKey;
    fundMember2Tx.sign(this.payer);
    await this.banksClient.processTransaction(fundMember2Tx);

    const fundMember3Tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: recipientMember3.publicKey,
        lamports: 1000000000, // 1 SOL
      })
    );
    fundMember3Tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundMember3Tx.feePayer = this.payer.publicKey;
    fundMember3Tx.sign(this.payer);
    await this.banksClient.processTransaction(fundMember3Tx);

    // Do the premine - create token account and mint tokens for testing
    const fromTokenAccount = await this.createTokenAccount(
      tokenMint,
      this.payer.publicKey
    );
    const launch = this.launchpad.getLaunchAddress({ baseMint: tokenMint });
    const launchSigner = this.launchpad.getLaunchSignerAddress({ launch });
    
    // Calculate the DAO address that will be created after launch completion
    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner });

    const tx = new Transaction().add(
      token.createSetAuthorityInstruction(
        tokenMint,
        this.payer.publicKey,
        token.AuthorityType.MintTokens,
        launchSigner
      )
    );

    tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    tx.feePayer = this.payer.publicKey;
    tx.sign(this.payer);

    await this.banksClient.processTransaction(tx);

    await this.launchpad
      .initializeLaunchIx({
        tokenName: "META",
        tokenSymbol: "META",
        tokenUri: "https://example.com",
        minimumRaiseAmount: minRaise,
        secondsForLaunch: secondsForLaunch,
        baseMint: tokenMint,
        quoteMint: MAINNET_USDC,
        monthlySpendingLimitAmount: monthlySpend, // 100 USDC burn
        monthlySpendingLimitMembers: [this.payer.publicKey],
        priceBasedUnlockAddress: recipientAddress,
        priceBasedPremineAmount: premineAmount,
        priceBasedUnlockThreshold: minRaise.mul(new BN(2)), // 2x minimum raise
      })
      .rpc();

    await this.launchpad.startLaunchIx({ launch }).rpc();

    await this.launchpad.fundIx({ launch, amount: minRaise }).rpc(); // Fund with full minimum raise

    await this.advanceBySeconds(DAY_IN_SECONDS * 7 + 100); // Advance past the 7-day launch period

    await this.launchpad
      .completeLaunchIx({ launch, baseMint: tokenMint })
      .rpc();

    // Claim tokens from the launch participation
    await this.launchpad.claimIx(launch, tokenMint).rpc();

    await this.advanceBySeconds(DAY_IN_SECONDS * 365);

    const clock = await this.banksClient.getClock();

    // await this.advanceBySlots(clock.unixTimestamp);

    await this.advanceBySeconds(10);

    const locker = this.priceBasedUnlock.getLockerAddress(launchSigner);

    // Create a new DAO with governance capabilities after launch
    const newDaoNonce = new BN(Math.random() * 2 ** 50);
    const [newDao] = getDaoAddr({
      nonce: newDaoNonce,
      daoCreator: this.payer.publicKey,
    });

    // Set up proper price values for the second DAO
    const thousandBuckPrice = PriceMath.getAmmPrice(1000, 6, 6);

    // Initialize the new DAO with futarchy governance
    await this.futarchy
      .initializeDaoIx({
        baseMint: tokenMint,
        quoteMint: MAINNET_USDC,
        params: {
          nonce: newDaoNonce,
          secondsPerProposal: 60 * 60 * 24 * 3, // 3 days
          twapStartDelaySeconds: 60 * 60 * 24, // 1 day
          twapInitialObservation: thousandBuckPrice,
          twapMaxObservationChangePerUpdate: thousandBuckPrice.divn(100),
          minQuoteFutarchicLiquidity: new BN(10_000),
          minBaseFutarchicLiquidity: new BN(10_000),
          passThresholdBps: 300,
          baseToStake: new BN(0),
          initialSpendingLimit: null,
        },
      })
      .rpc();

    // Set up multisig for the original DAO (the one that needs to make the proposal)
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    // Fund the vault
    const fundVaultTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.payer.publicKey,
        toPubkey: vaultPda,
        lamports: 1_000_000_000,
      })
    );
    fundVaultTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    fundVaultTx.feePayer = this.payer.publicKey;
    fundVaultTx.sign(this.payer);
    await this.banksClient.processTransaction(fundVaultTx);

    // The oracle reads from the actual DAO account at byte offset 8+1=9
    // The DAO should have TWAP data from the futarchy AMM trading

    // The DAO already has real TWAP data from the futarchy trading, no need to mock

    // Create the instruction to change locker authority
    // The current authority is the vault PDA, not the dao (as set in complete_launch.rs line 338)
    const changeAuthorityIx = await this.priceBasedUnlock
      .changeLockerAuthorityIx({
        locker,
        currentAuthority: vaultPda,
        newLockerAuthority: newDao,
      })
      .instruction();
      

    // Create multisig transaction message
    // The vaultPda should act as the payer and signer for the dao
    const changeAuthorityMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [changeAuthorityIx],
    });

    // Create vault transaction and proposal
    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex: 1n,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: changeAuthorityMessage,
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

    const createProposalTx = new Transaction().add(vaultTxCreate, proposalCreateIx);
    createProposalTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    createProposalTx.feePayer = this.payer.publicKey;
    createProposalTx.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(createProposalTx);

    // Initialize futarchy proposal on the original DAO (from launch)
    const proposal = await this.futarchy.initializeProposal(
      dao,
      squadsProposalPda
    );

    const {
      question,
      baseVault,
      quoteVault,
    } = this.futarchy.getProposalPdas(proposal, tokenMint, MAINNET_USDC, dao);

    // Split tokens for voting - need much more USDC for the large trades
    await this.conditionalVault
      .splitTokensIx(question, baseVault, tokenMint, new BN(10 * 10 ** 6), 2)
      .rpc();
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, MAINNET_USDC, new BN(100_000 * 1_000_000), 2) // 100k USDC
      .rpc();

    // Provide liquidity to the DAO AMM so there's something to trade against
    await this.futarchy
      .provideLiquidityIx({
        dao: dao,
        baseMint: tokenMint,
        quoteMint: MAINNET_USDC,
        quoteAmount: new BN(100 * 10 ** 6), // 100 USDC  
        maxBaseAmount: new BN(10_000_000 * 10 ** 6), // 10M tokens
        minLiquidity: new BN(1),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    // Stake tokens to the proposal to meet the minimum requirement  
    await this.futarchy.stakeToProposalIx({
      proposal,
      dao,
      baseMint: tokenMint,
      amount: new BN(100_000 * 10 ** 6), // Stake 100,000 tokens
    }).rpc();

    // Launch the proposal to set up the AMM markets
    await this.futarchy.launchProposalIx({
      proposal,
      dao,
      baseMint: tokenMint,
      quoteMint: MAINNET_USDC,
    }).rpc();

    // Vote to pass the proposal by trading in the conditional pass market
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: tokenMint,
        quoteMint: MAINNET_USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10_000 * 1_000_000), // Buy with 10,000 USDC to ensure it passes
        trader: this.payer.publicKey,
      })
      .rpc();

    // Advance time over multiple iterations and crank TWAP to establish price trend
    for (let i = 0; i < 100; i++) {
      await this.advanceBySeconds(60 * 60 * 24 * 3 / 100); // Spread time advancement

      await this.futarchy
        .conditionalSwapIx({
          dao,
          baseMint: tokenMint,
          quoteMint: MAINNET_USDC,
          proposal,
          market: "pass",
          swapType: "buy",
          inputAmount: new BN(10),
          trader: this.payer.publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i }),
        ])
        .rpc();
    }

    // Finalize the proposal (this automatically approves the multisig proposal if it passes)
    await this.futarchy.finalizeProposal(proposal);
    
    // Check the proposal and multisig status before executing
    const finalizedProposal = await this.futarchy.getProposal(proposal);
    console.log("Finalized proposal state:", finalizedProposal.state);
    console.log("Proposal passed:", finalizedProposal.state.passed !== undefined);
    
    // Check multisig proposal status
    const multisigProposal = await this.squadsConnection.getAccountInfo(squadsProposalPda);
    console.log("Multisig proposal exists:", multisigProposal !== null);
    
    if (multisigProposal) {
      try {
        const proposalAccount = multisig.accounts.Proposal.fromAccountInfo(multisigProposal)[0];
        console.log("Multisig proposal status:", proposalAccount.status);
        console.log("Multisig proposal approved:", proposalAccount.approved);
        console.log("Multisig proposal rejected:", proposalAccount.rejected);
      } catch (e) {
        console.log("Could not decode multisig proposal:", e.message);
      }
    }

    // Execute the multisig transaction
    const txExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda,
      transactionIndex: 1n,
      member: PERMISSIONLESS_ACCOUNT.publicKey,
    });
    

    const txExecute = new Transaction().add(txExecuteIx.instruction);
    txExecute.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    txExecute.feePayer = this.payer.publicKey;
    
    
    txExecute.sign(this.payer, PERMISSIONLESS_ACCOUNT);
    await this.banksClient.processTransaction(txExecute);

    console.log("squads tx executed");

    // Recipient multisig votes to start the unlock process
    const startUnlockIx = await this.priceBasedUnlock
      .startUnlockIx({ locker, oracleAccount: dao, recipient: recipientAddress })
      .instruction();

    // Create multisig transaction message for starting unlock
    const startUnlockMessage = new TransactionMessage({
      payerKey: recipientVaultPda,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [startUnlockIx],
    });

    // Create vault transaction for the unlock start
    const unlockVaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      creator: recipientMember1.publicKey,
      rentPayer: this.payer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: startUnlockMessage,
    });

    const unlockProposalCreateIx = multisig.instructions.proposalCreate({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      creator: recipientMember1.publicKey,
      rentPayer: this.payer.publicKey,
    });

    // Member 1 creates the proposal
    const createUnlockProposalTx = new Transaction().add(unlockVaultTxCreate, unlockProposalCreateIx);
    createUnlockProposalTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    createUnlockProposalTx.feePayer = this.payer.publicKey;
    createUnlockProposalTx.sign(this.payer, recipientMember1);
    await this.banksClient.processTransaction(createUnlockProposalTx);

    // All 3 members vote to approve (3/3 threshold)
    const [unlockProposalPda] = multisig.getProposalPda({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
    });

    // Member 1 approves
    const member1ApproveIx = multisig.instructions.proposalApprove({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      member: recipientMember1.publicKey,
    });
    const member1ApproveTx = new Transaction().add(member1ApproveIx);
    member1ApproveTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    member1ApproveTx.feePayer = this.payer.publicKey;
    member1ApproveTx.sign(this.payer, recipientMember1);
    await this.banksClient.processTransaction(member1ApproveTx);

    // Member 2 approves
    const member2ApproveIx = multisig.instructions.proposalApprove({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      member: recipientMember2.publicKey,
    });
    const member2ApproveTx = new Transaction().add(member2ApproveIx);
    member2ApproveTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    member2ApproveTx.feePayer = this.payer.publicKey;
    member2ApproveTx.sign(this.payer, recipientMember2);
    await this.banksClient.processTransaction(member2ApproveTx);

    // Member 3 approves (this should reach the 3/3 threshold)
    const member3ApproveIx = multisig.instructions.proposalApprove({
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      member: recipientMember3.publicKey,
    });
    const member3ApproveTx = new Transaction().add(member3ApproveIx);
    member3ApproveTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    member3ApproveTx.feePayer = this.payer.publicKey;
    member3ApproveTx.sign(this.payer, recipientMember3);
    await this.banksClient.processTransaction(member3ApproveTx);

    // Execute the approved multisig transaction to start unlock
    const unlockTxExecuteIx = await multisig.instructions.vaultTransactionExecute({
      connection: this.squadsConnection,
      multisigPda: recipientMultisigPda,
      transactionIndex: 1n,
      member: recipientMember1.publicKey,
    });

    const unlockTxExecute = new Transaction().add(unlockTxExecuteIx.instruction);
    unlockTxExecute.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    unlockTxExecute.feePayer = this.payer.publicKey;
    unlockTxExecute.sign(this.payer, recipientMember1);
    await this.banksClient.processTransaction(unlockTxExecute);

    await this.advanceBySeconds(600); // Wait longer than TWAP period (300s) for calculation

    // Do additional spot swaps to ensure TWAP is above the threshold
    for (let i = 0; i < 10; i++) {
      await this.futarchy
        .spotSwapIx({
          dao: dao,
          baseMint: tokenMint,
          quoteMint: MAINNET_USDC,
          swapType: "buy",
          inputAmount: new BN(1 * 10 ** 6), // Small swaps to build TWAP
          minOutputAmount: new BN(0),
          trader: this.payer.publicKey,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: i + 1 }),
        ])
        .rpc();
      
      await this.advanceBySeconds(30); // Space out the swaps
    }

    // Create token account for the recipient vault PDA to receive the unlocked tokens
    const recipientTokenAccount = await this.createTokenAccount(tokenMint, recipientAddress);
    console.log("Created recipient token account:", recipientTokenAccount.toString());
    console.log("Recipient address (vault PDA):", recipientAddress.toString());

    // Use raw program methods to override the recipient token account
    await this.priceBasedUnlock.program.methods
      .completeUnlock()
      .accounts({
        locker,
        oracleAccount: dao,
        lockerTokenAccount: this.priceBasedUnlock.getLockerTokenAccountAddress(locker),
        tokenMint,
        recipientTokenAccount: recipientTokenAccount, // Use our manually created token account
        tokenRecipient: recipientAddress,
        payer: this.payer.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("Complete unlock executed successfully");

    // Verify the unlock was successful and locker authority was changed
    const finalLocker = await this.priceBasedUnlock.getLocker(locker);
    assert.equal(finalLocker.lockerAuthority.toString(), newDao.toString(), "Locker authority is transferred to newDao");
    
    // Verify tokens were unlocked to the multisig vault  
    // Check balance using the manually created token account directly
    console.log("Checking balance for token account:", recipientTokenAccount.toString());
    
    try {
      // Use the spl-token method to get balance directly from the token account
      const accountInfo = await this.banksClient.getAccount(recipientTokenAccount);
      if (accountInfo) {
        const tokenAccountData = token.unpackAccount(recipientTokenAccount, {
          ...accountInfo,
          data: Buffer.from(accountInfo.data)
        });
        const recipientBalance = tokenAccountData.amount;
        console.log("Recipient balance:", recipientBalance.toString());
        assert.isTrue(recipientBalance > 0n, "Multisig vault should have received unlocked tokens");
      } else {
        assert.fail("Recipient token account does not exist");
      }
    } catch (error) {
      console.log("Error getting token balance:", error.message);
      throw error;
    }
  });
}
