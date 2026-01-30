import {
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
} from "@metadaoproject/futarchy/v0.7";
import {
  setupPerformancePackageV2,
  setupMintGovernorWithAuthority,
  createCliffLinearReward,
  createThresholdReward,
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
      startValue: new BN(0),
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
      startValue: new BN(0),
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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

    recipientBalance = await this.getTokenBalance(mint, recipient.publicKey);
    assert.equal(recipientBalance.toString(), "300000000");
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
        signer: authority.publicKey,
      })
      .signers([authority])
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
