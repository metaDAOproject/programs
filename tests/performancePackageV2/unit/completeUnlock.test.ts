import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
  getPerformancePackageV2Addr,
} from "@metadaoproject/programs";
import {
  setupPerformancePackageV2,
  setupMintGovernorWithAuthority,
  createCliffLinearReward,
  createThresholdReward,
  createFutarchyTwapOracle,
  setupDaoForTwapTests,
} from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let ppClient: PerformancePackageV2Client;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
    ppClient = this.performancePackageV2;
  });

  /**
   * Helper to create ATA for recipient
   */
  async function createRecipientAta(
    context: any,
    mint: PublicKey,
    recipient: PublicKey,
  ): Promise<PublicKey> {
    const ata = token.getAssociatedTokenAddressSync(mint, recipient, true);
    const tx = new Transaction().add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        context.payer.publicKey,
        ata,
        recipient,
        mint,
      ),
    );
    tx.recentBlockhash = (await context.banksClient.getLatestBlockhash())[0];
    tx.feePayer = context.payer.publicKey;
    tx.sign(context.payer);
    await context.banksClient.processTransaction(tx);
    return ata;
  }

  it("successfully completes unlock and mints tokens (CliffLinear)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp to set up time-based reward function
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Setup reward function where cliff is at current time (immediately earns cliff_amount)
    // and end is far in future
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(currentTimestamp), // Cliff at current time
      endValue: new BN(currentTimestamp + 1000), // End 1000 seconds from now
      cliffAmount: new BN(100_000_000), // 100 tokens
      totalAmount: new BN(1_000_000_000), // 1000 tokens
    });

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Advance time by 500 seconds (halfway between cliff and end)
    await this.advanceBySeconds(500);

    // Complete unlock
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify status is back to Locked
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);

    // Verify tokens were minted to recipient
    // Expected: cliff_amount + linear_portion = 100M + (500/1000 * 900M) = 100M + 450M = 550M
    const expectedReward = 550_000_000;
    const recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), expectedReward.toString());
    assert.equal(
      ppAccount.totalRewardsPaidOut.toString(),
      expectedReward.toString(),
    );
  });

  it("successfully completes unlock and mints tokens (Threshold)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp to set up time-based thresholds
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Setup threshold reward function with time-based thresholds
    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      }, // 100 tokens at current time
      {
        threshold: new BN(currentTimestamp + 100),
        cumulativeAmount: new BN(500_000_000),
      }, // 500 tokens at +100s
      {
        threshold: new BN(currentTimestamp + 200),
        cumulativeAmount: new BN(1_000_000_000),
      }, // 1000 tokens at +200s
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Advance time by 150 seconds (should hit second threshold)
    await this.advanceBySeconds(150);

    // Complete unlock
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify tokens were minted to recipient (should be 500 tokens = 500_000_000)
    const recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "500000000");

    // Verify status is back to Locked
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
  });

  it("mints correct amount to recipient (cumulative - already_paid)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Setup threshold reward function
    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
      {
        threshold: new BN(currentTimestamp + 100),
        cumulativeAmount: new BN(500_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // First unlock cycle - should mint 100 tokens (first threshold)
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    let recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "100000000");

    // Advance time past second threshold
    await this.advanceBySeconds(150);

    // Second unlock cycle - should mint only the difference (500 - 100 = 400 tokens)
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([authority])
      .rpc();

    // Total should be 500 tokens now
    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "500000000");
  });

  it("updates total_rewards_paid_out", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Verify initial total_rewards_paid_out is 0
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "0");

    // Start and complete unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify total_rewards_paid_out is updated
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "100000000");
  });

  it("resets oracle state (for Time: no state to reset)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start and complete unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // For Time oracle, there's no state to reset - just verify the instruction succeeded
    // and the package is back to Locked status
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
    assert.isDefined(ppAccount.oracleReader.time);
  });

  it("rewards only increase (never decrease)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Setup CliffLinear with a time range that spans past and future
    // cliff at current time, end 1000 seconds in the future
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(currentTimestamp), // Cliff at current time
      endValue: new BN(currentTimestamp + 1000), // End 1000 seconds from now
      cliffAmount: new BN(100_000_000), // 100 tokens at cliff
      totalAmount: new BN(500_000_000), // Max 500 tokens
    });

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Advance time to 500 seconds after cliff (halfway through linear period)
    // This should give us cliff (100) + 50% of linear portion (200) = 300 tokens
    await this.advanceBySeconds(500);

    // First unlock - should get 300 tokens
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    let recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "300000000");

    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "300000000");

    // Now set the clock BACKWARDS to just after cliff (100 seconds after cliff).
    // Normally physics doesn't allow travelling backwards in time,
    // but here we do it to test the invariant that rewards only increase.
    // This would calculate only 100 + 10% of 400 = 140 tokens
    // But since we've already paid 300, no new tokens should be minted
    const clockAfterFirstUnlock = await this.banksClient.getClock();
    const { Clock } = await import("solana-bankrun");
    this.context.setClock(
      new Clock(
        clockAfterFirstUnlock.slot,
        clockAfterFirstUnlock.epochStartTimestamp,
        clockAfterFirstUnlock.epoch,
        clockAfterFirstUnlock.leaderScheduleEpoch,
        // Set time to 100 seconds after cliff (earlier than the 500 seconds we were at)
        BigInt(currentTimestamp + 100),
      ),
    );

    // Second unlock - reward function would calculate 140 tokens
    // but total_rewards_paid_out is 300, so mint amount should be 0
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Balance should remain the same - no decrease
    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "300000000");

    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "300000000");
  });

  it("rewards only increase (never decrease) with FutarchyTwap and CliffLinear", async function () {
    // Setup DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    // FutarchyTwap oracle with short min_duration
    const minDuration = 10;
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });

    // CliffLinear reward function based on TWAP thresholds
    // The DAO's twapInitialObservation is ~1000 (from setupDaoForTwapTests)
    // TWAP of 1000 is 50% into the 500-1500 range → earns ~300 tokens
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(500), // Cliff at TWAP = 500
      endValue: new BN(1500), // End at TWAP = 1500
      cliffAmount: new BN(100_000_000), // 100 tokens at cliff
      totalAmount: new BN(500_000_000), // 500 tokens at end
    });

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    await createRecipientAta(this, mint, recipient.publicKey);

    // === FIRST UNLOCK CYCLE ===
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
        dao,
      })
      .signers([recipient])
      .rpc();

    // Record the start snapshot for later manipulation
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);

    await this.advanceBySeconds(minDuration + 5);

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
        dao,
      })
      .signers([authority])
      .rpc();

    // Verify first cycle rewards (should earn based on TWAP ~1000)
    let recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    const firstCycleReward = Number(recipientBalance);
    assert.isTrue(firstCycleReward > 0);

    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.totalRewardsPaidOut.toString(),
      recipientBalance.toString(),
    );

    // === SECOND UNLOCK CYCLE WITH MANIPULATED LOWER TWAP ===
    await this.advanceBySeconds(10);

    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
        dao,
      })
      .signers([recipient])
      .rpc();

    // Get the start snapshot value for second cycle
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    const secondCycleStartValue =
      ppAccount.oracleReader.futarchyTwap.startValue;
    const secondCycleStartTime = ppAccount.oracleReader.futarchyTwap.startTime;

    await this.advanceBySeconds(minDuration + 5);

    // === MANIPULATE DAO AGGREGATOR TO PRODUCE LOW TWAP ===
    // TWAP = (end_aggregator - start_aggregator) / (end_time - start_time)
    // We want TWAP < 500 (below cliff) so calculated reward = 0
    // But we've already paid firstCycleReward, so no decrease should happen
    //
    // Note: The aggregator always INCREASES - it's cumulative. But the RATE
    // of increase can vary. If price is lower during cycle 2, the aggregator
    // grows more slowly, producing a lower TWAP. This is a valid real-world
    // scenario (price dropped).

    const AGGREGATOR_OFFSET = 9; // 8 (discriminator) + 1 (enum discriminant)
    const AGGREGATOR_SIZE = 16; // u128

    const daoAccount = await this.banksClient.getAccount(dao);

    // Calculate a low aggregator: startValue + (low_twap * time_delta)
    // For TWAP = 100 (well below cliff of 500):
    const currentClock = await this.banksClient.getClock();
    const timeDelta =
      Number(currentClock.unixTimestamp) - Number(secondCycleStartTime);
    const targetTwap = new BN(100); // Very low TWAP, below cliff
    const newAggregator = secondCycleStartValue.add(targetTwap.muln(timeDelta));

    // Directly modify the aggregator at offset 9
    const aggregatorBuffer = newAggregator.toArrayLike(
      Buffer,
      "le",
      AGGREGATOR_SIZE,
    );
    daoAccount.data.set(aggregatorBuffer, AGGREGATOR_OFFSET);

    // Update the account in the test context
    this.context.setAccount(dao, daoAccount);

    // Complete unlock - TWAP will be ~100, which is below cliff (500)
    // So calculated reward = 0, but we've already paid firstCycleReward
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
        dao,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([authority])
      .rpc();

    // === VERIFY REWARDS DID NOT DECREASE ===
    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), firstCycleReward.toString());

    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.totalRewardsPaidOut.toString(),
      firstCycleReward.toString(),
    );
  });

  it("succeeds with zero mint amount when rewards already paid", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Setup threshold where first threshold is already met
    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
      // Second threshold is far in future (won't be reached)
      {
        threshold: new BN(currentTimestamp + 10000),
        cumulativeAmount: new BN(500_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // First unlock - should mint 100 tokens
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    let recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "100000000");

    // Second unlock - time hasn't advanced enough to hit second threshold
    // so no new rewards should be minted (zero mint amount)
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([recipient])
      .rpc();

    // Advance just a tiny bit (not enough to hit second threshold)
    await this.advanceBySeconds(10);

    // This should succeed even with zero mint amount
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Balance should remain unchanged
    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "100000000");

    // Verify PP is back to Locked status
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
  });

  it("can be started again after complete (cycle repeats)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
      {
        threshold: new BN(currentTimestamp + 100),
        cumulativeAmount: new BN(200_000_000),
      },
      {
        threshold: new BN(currentTimestamp + 200),
        cumulativeAmount: new BN(300_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Cycle 1: Unlock and complete
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
    assert.equal(ppAccount.seqNum.toString(), "2"); // seq_num incremented twice (start + complete)

    let recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "100000000");

    // Advance time
    await this.advanceBySeconds(150);

    // Cycle 2: Should be able to start again
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([recipient])
      .rpc();

    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      ])
      .signers([authority])
      .rpc();

    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
    assert.equal(ppAccount.seqNum.toString(), "4"); // seq_num incremented again

    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "200000000");

    // Advance time again
    await this.advanceBySeconds(100);

    // Cycle 3: Should work again
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2 }),
      ])
      .signers([recipient])
      .rpc();

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 2 }),
      ])
      .signers([authority])
      .rpc();

    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "300000000");
  });

  it("records end snapshot for FutarchyTwap", async function () {
    // Setup a DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const minDuration = 10; // Short duration for testing
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    // Use threshold reward with TWAP thresholds
    const rewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
      { threshold: new BN(500), cumulativeAmount: new BN(500_000_000) },
    ]);

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
        dao,
      })
      .signers([recipient])
      .rpc();

    // Verify start snapshot was recorded
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    const startTime = ppAccount.oracleReader.futarchyTwap.startTime.toString();
    assert.notEqual(startTime, "0");
    assert.equal(ppAccount.oracleReader.futarchyTwap.endValue.toString(), "0");
    assert.equal(ppAccount.oracleReader.futarchyTwap.endTime.toString(), "0");

    // Advance time past min_duration
    await this.advanceBySeconds(minDuration + 5);

    // Complete unlock
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
        dao,
      })
      .signers([authority])
      .rpc();

    // Verify end snapshot was recorded and then reset
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);
    // After complete, oracle state is reset
    assert.equal(
      ppAccount.oracleReader.futarchyTwap.startValue.toString(),
      "0",
    );
    assert.equal(ppAccount.oracleReader.futarchyTwap.startTime.toString(), "0");
    assert.equal(ppAccount.oracleReader.futarchyTwap.endValue.toString(), "0");
    assert.equal(ppAccount.oracleReader.futarchyTwap.endTime.toString(), "0");
  });

  it("correctly computes TWAP for FutarchyTwap", async function () {
    // Setup a DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const minDuration = 10; // Short duration for testing
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    // Use threshold reward - any TWAP above 0 earns 100 tokens
    const rewardFunction = createThresholdReward([
      { threshold: new BN(1), cumulativeAmount: new BN(100_000_000) }, // Any TWAP > 0
    ]);

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
        dao,
      })
      .signers([recipient])
      .rpc();

    // Advance time past min_duration
    await this.advanceBySeconds(minDuration + 5);

    // Complete unlock - TWAP should be computed
    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
        dao,
      })
      .signers([authority])
      .rpc();

    // Verify the PP is back to locked and rewards were computed
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);

    // The DAO has a twapInitialObservation of 1000 (from setupDaoForTwapTests)
    // So the TWAP should be around 1000, which is > 1, so we should get 100 tokens
    const recipientBalance = await this.getTokenBalance(
      mint,
      recipient.publicKey,
    );
    assert.equal(recipientBalance.toString(), "100000000");
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "100000000");
  });

  it("fails when min_duration not reached for FutarchyTwap", async function () {
    // Setup a DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    // Set a longer min_duration that we won't wait for
    const minDuration = 3600; // 1 hour
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    const rewardFunction = createThresholdReward([
      { threshold: new BN(1), cumulativeAmount: new BN(100_000_000) },
    ]);

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
        dao,
      })
      .signers([recipient])
      .rpc();

    // Advance time, but NOT past min_duration (only 10 seconds instead of 3600)
    await this.advanceBySeconds(10);

    // Try to complete unlock - should fail because min_duration not reached
    const callbacks = expectError(
      "OracleMinDurationNotReached",
      "Should have failed because min_duration not reached",
    );

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
        dao,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when status is not Unlocking", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Verify initial status is Locked (not Unlocking)
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);

    // Try to complete unlock without starting first - should fail
    const callbacks = expectError(
      "NotUnlocking",
      "Should have failed because status is not Unlocking",
    );

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when signer is neither authority nor recipient", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const unauthorized = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock as authority
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Try to complete unlock with an unauthorized signer
    const callbacks = expectError(
      "Unauthorized",
      "Should have failed because signer is neither authority nor recipient",
    );

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: unauthorized.publicKey,
      })
      .signers([unauthorized])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint doesn't match", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create a different mint
    const wrongMint = Keypair.generate();
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: wrongMint.publicKey,
        lamports: await this.banksClient
          .getRent()
          .then((rent) => Number(rent.minimumBalance(BigInt(82)))),
        space: 82,
        programId: token.TOKEN_PROGRAM_ID,
      }),
      token.createInitializeMint2Instruction(
        wrongMint.publicKey,
        6,
        this.payer.publicKey,
        null,
      ),
    );
    createMintTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createMintTx.feePayer = this.payer.publicKey;
    createMintTx.sign(this.payer, wrongMint);
    await this.banksClient.processTransaction(createMintTx);

    // Create recipient ATA for the wrong mint
    const wrongRecipientAta = token.getAssociatedTokenAddressSync(
      wrongMint.publicKey,
      recipient.publicKey,
      true,
    );
    const createAtaTx = new Transaction().add(
      token.createAssociatedTokenAccountIdempotentInstruction(
        this.payer.publicKey,
        wrongRecipientAta,
        recipient.publicKey,
        wrongMint.publicKey,
      ),
    );
    createAtaTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createAtaTx.feePayer = this.payer.publicKey;
    createAtaTx.sign(this.payer);
    await this.banksClient.processTransaction(createAtaTx);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Try to complete unlock with wrong mint - should fail
    const callbacks = expectError(
      "ConstraintAddress",
      "Should have failed because mint doesn't match",
    );

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor,
        mintAuthority,
        mint: wrongMint.publicKey, // Wrong mint!
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint_governor doesn't match", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get current timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    const rewardFunction = createThresholdReward([
      {
        threshold: new BN(currentTimestamp),
        cumulativeAmount: new BN(100_000_000),
      },
    ]);

    const { performancePackage, mint, mintAuthority } =
      await setupPerformancePackageV2(
        this.banksClient,
        mintGovernorClient,
        ppClient,
        this.payer,
        {
          authority: authority.publicKey,
          recipient: recipient.publicKey,
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        },
      );

    // Create a separate, properly initialized mint governor (for a different mint)
    // This ensures we have a valid MintGovernor account that just doesn't match the PP's stored one
    const { mintGovernor: wrongMintGovernor } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage, // Use same authorized_minter so account is set up
        null,
        6,
      );

    // Create recipient ATA
    await createRecipientAta(this, mint, recipient.publicKey);

    // Start unlock
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Try to complete unlock with wrong mint governor - should fail
    const callbacks = expectError(
      "InvalidMintGovernor",
      "Should have failed because mint_governor doesn't match",
    );

    await ppClient
      .completeUnlockIx({
        performancePackage,
        mintGovernor: wrongMintGovernor, // Wrong - different mint governor!
        mintAuthority,
        mint,
        recipient: recipient.publicKey,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
