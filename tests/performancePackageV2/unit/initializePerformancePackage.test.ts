import { Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
  getPerformancePackageV2Addr,
} from "@metadaoproject/futarchy-v2";
import {
  setupMintGovernorWithAuthority,
  createCliffLinearReward,
  createThresholdReward,
  createMintWithAuthority,
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

  it("successfully initializes with Time oracle and CliffLinear reward function", async function () {
    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const minUnlockTimestamp = new BN(1000);
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(100),
      endValue: new BN(1000),
      cliffAmount: new BN(100_000_000),
      totalAmount: new BN(1_000_000_000),
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
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp,
      })
      .signers([createKey])
      .rpc();

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.equal(ppAccount.mint.toBase58(), mint.toBase58());
    assert.equal(ppAccount.mintGovernor.toBase58(), mintGovernor.toBase58());
    assert.equal(ppAccount.mintAuthority.toBase58(), mintAuthority.toBase58());
    assert.equal(
      ppAccount.authority.toBase58(),
      authority.publicKey.toBase58(),
    );
    assert.equal(
      ppAccount.recipient.toBase58(),
      recipient.publicKey.toBase58(),
    );
    assert.equal(
      ppAccount.minUnlockTimestamp.toString(),
      minUnlockTimestamp.toString(),
    );
    assert.equal(ppAccount.totalRewardsPaidOut.toString(), "0");
    assert.equal(ppAccount.seqNum.toString(), "0");
    assert.equal(
      ppAccount.createKey.toBase58(),
      createKey.publicKey.toBase58(),
    );
    assert.isDefined(ppAccount.oracleReader.time);
    assert.isDefined(ppAccount.rewardFunction.cliffLinear);
    assert.isDefined(ppAccount.status.locked);
    assert.isTrue(ppAccount.createdAtTimestamp.toNumber() > 0);

    // Verify CliffLinear properties match what we defined
    const cliffLinear = ppAccount.rewardFunction.cliffLinear;
    assert.equal(cliffLinear.cliffValue.toString(), "100");
    assert.equal(cliffLinear.endValue.toString(), "1000");
    assert.equal(cliffLinear.cliffAmount.toString(), "100000000");
    assert.equal(cliffLinear.totalAmount.toString(), "1000000000");
  });

  it("successfully initializes with Time oracle and Threshold reward function", async function () {
    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const rewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
      { threshold: new BN(200), cumulativeAmount: new BN(200_000_000) },
      { threshold: new BN(300), cumulativeAmount: new BN(300_000_000) },
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
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.isDefined(ppAccount.oracleReader.time);
    assert.isDefined(ppAccount.rewardFunction.threshold);
    assert.equal(ppAccount.rewardFunction.threshold.tranches.length, 3);

    // Verify all 3 tranches
    const tranches = ppAccount.rewardFunction.threshold.tranches;
    assert.equal(tranches[0].threshold.toString(), "100");
    assert.equal(tranches[0].cumulativeAmount.toString(), "100000000");
    assert.equal(tranches[1].threshold.toString(), "200");
    assert.equal(tranches[1].cumulativeAmount.toString(), "200000000");
    assert.equal(tranches[2].threshold.toString(), "300");
    assert.equal(tranches[2].cumulativeAmount.toString(), "300000000");
  });

  it("successfully initializes with 10 threshold tranches", async function () {
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

    // Create 10 threshold tranches with increasing thresholds and cumulative amounts
    const tranches = [];
    for (let i = 1; i <= 10; i++) {
      tranches.push({
        threshold: new BN(i * 100), // 100, 200, 300, ..., 1000
        cumulativeAmount: new BN(i * 100_000_000), // 100M, 200M, ..., 1000M (in smallest unit)
      });
    }
    const rewardFunction = createThresholdReward(tranches);

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.isDefined(ppAccount.rewardFunction.threshold);
    assert.equal(ppAccount.rewardFunction.threshold.tranches.length, 10);

    // Verify first tranche
    assert.equal(
      ppAccount.rewardFunction.threshold.tranches[0].threshold.toString(),
      "100",
    );
    assert.equal(
      ppAccount.rewardFunction.threshold.tranches[0].cumulativeAmount.toString(),
      "100000000",
    );

    // Verify last tranche
    assert.equal(
      ppAccount.rewardFunction.threshold.tranches[9].threshold.toString(),
      "1000",
    );
    assert.equal(
      ppAccount.rewardFunction.threshold.tranches[9].cumulativeAmount.toString(),
      "1000000000",
    );
  });

  it("successfully initializes with FutarchyTwap oracle and CliffLinear reward function", async function () {
    // Setup a DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const minDuration = 60; // 60 seconds
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(100), // TWAP value threshold
      endValue: new BN(1000),
      cliffAmount: new BN(100_000_000), // 100 tokens
      totalAmount: new BN(1_000_000_000), // 1000 tokens
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

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.isDefined(ppAccount.oracleReader.futarchyTwap);
    assert.isDefined(ppAccount.rewardFunction.cliffLinear);
    assert.isDefined(ppAccount.status.locked);

    // Verify FutarchyTwap properties
    const futarchyTwap = ppAccount.oracleReader.futarchyTwap;
    assert.equal(futarchyTwap.amm.toBase58(), dao.toBase58());
    assert.equal(futarchyTwap.minDuration, minDuration);
    assert.equal(futarchyTwap.startValue.toString(), "0");
    assert.equal(futarchyTwap.startTime.toString(), "0");
    assert.equal(futarchyTwap.endValue.toString(), "0");
    assert.equal(futarchyTwap.endTime.toString(), "0");
  });

  it("successfully initializes with FutarchyTwap oracle and Threshold reward function", async function () {
    // Setup a DAO for TWAP oracle
    const dao = await setupDaoForTwapTests(this);

    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    const minDuration = 120; // 120 seconds
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    const rewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) }, // TWAP >= 100
      { threshold: new BN(500), cumulativeAmount: new BN(500_000_000) }, // TWAP >= 500
      { threshold: new BN(1000), cumulativeAmount: new BN(1_000_000_000) }, // TWAP >= 1000
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

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.isDefined(ppAccount.oracleReader.futarchyTwap);
    assert.isDefined(ppAccount.rewardFunction.threshold);
    assert.isDefined(ppAccount.status.locked);

    // Verify FutarchyTwap properties
    const futarchyTwap = ppAccount.oracleReader.futarchyTwap;
    assert.equal(futarchyTwap.amm.toBase58(), dao.toBase58());
    assert.equal(futarchyTwap.minDuration, minDuration);

    // Verify Threshold tranches
    const tranches = ppAccount.rewardFunction.threshold.tranches;
    assert.equal(tranches.length, 3);
    assert.equal(tranches[0].threshold.toString(), "100");
    assert.equal(tranches[0].cumulativeAmount.toString(), "100000000");
    assert.equal(tranches[1].threshold.toString(), "500");
    assert.equal(tranches[2].threshold.toString(), "1000");
  });

  it("fails when create_key does not sign", async function () {
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

    const rewardFunction = createCliffLinearReward();

    try {
      // Don't include createKey in signers - this should fail
      await ppClient
        .initializePerformancePackageIx({
          createKey: createKey.publicKey,
          mint,
          mintGovernor,
          mintAuthority,
          authority: this.payer.publicKey,
          recipient: this.payer.publicKey,
          payer: this.payer.publicKey,
          oracleReader: { time: {} },
          rewardFunction,
          minUnlockTimestamp: new BN(0),
        })
        .rpc(); // No signers - should fail

      assert.fail("Should have failed because create_key did not sign");
    } catch (e) {
      // The transaction should fail with a signature verification error
      assert.include(e.message.toLowerCase(), "signature");
    }
  });

  it("fails when mint_authority.authorized_minter does not match PP", async function () {
    const createKey = Keypair.generate();

    // Create a mint authority for a DIFFERENT authorized minter (not the PP)
    const wrongAuthorizedMinter = Keypair.generate();
    const { mint, mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        wrongAuthorizedMinter.publicKey, // Wrong! Should be PP's address
      );

    const rewardFunction = createCliffLinearReward();

    const callbacks = expectError(
      "InvalidMintAuthority",
      "Should have failed because mint_authority.authorized_minter doesn't match PP",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint_governor.mint does not match mint", async function () {
    const createKey = Keypair.generate();
    const [performancePackage] = getPerformancePackageV2Addr({
      createKey: createKey.publicKey,
    });

    // Set up mint governor with the correct PP as authorized minter
    // Note: we intentionally ignore the mint from setupMintGovernorWithAuthority
    // and use wrongMint instead to test the failure case
    const { mintGovernor, mintAuthority } =
      await setupMintGovernorWithAuthority(
        this.banksClient,
        mintGovernorClient,
        this.payer,
        performancePackage,
      );

    // Create a different mint to pass in (doesn't match the governor)
    const wrongMint = await createMintWithAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
    );

    const rewardFunction = createCliffLinearReward();

    const callbacks = expectError(
      "InvalidMintGovernor",
      "Should have failed because mint_governor.mint doesn't match mint",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint: wrongMint, // Wrong mint!
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with invalid reward function config - unsorted tranches", async function () {
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

    // Create threshold reward with unsorted tranches (300 before 200)
    const rewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
      { threshold: new BN(300), cumulativeAmount: new BN(300_000_000) }, // Out of order!
      { threshold: new BN(200), cumulativeAmount: new BN(200_000_000) },
    ]);

    const callbacks = expectError(
      "InvalidTranches",
      "Should have failed because tranches are not sorted",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with invalid reward function config - decreasing cumulative amounts", async function () {
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

    // Create threshold reward with decreasing cumulative amounts
    const rewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(300_000_000) },
      { threshold: new BN(200), cumulativeAmount: new BN(200_000_000) }, // Less than previous!
      { threshold: new BN(300), cumulativeAmount: new BN(100_000_000) },
    ]);

    const callbacks = expectError(
      "InvalidTranches",
      "Should have failed because cumulative amounts are not non-decreasing",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with invalid reward function config - empty tranches", async function () {
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

    // Create threshold reward with empty tranches
    const rewardFunction = createThresholdReward([]);

    const callbacks = expectError(
      "InvalidTranches",
      "Should have failed because tranches are empty",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with invalid CliffLinear config - cliff_value > end_value", async function () {
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

    // cliff_value (1000) > end_value (500) - invalid
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(1000),
      endValue: new BN(500), // Less than cliff!
      cliffAmount: new BN(100_000_000),
      totalAmount: new BN(1_000_000_000),
    });

    const callbacks = expectError(
      "InvalidVestingSchedule",
      "Should have failed because cliff_value > end_value",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with invalid CliffLinear config - cliff_amount > total_amount", async function () {
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

    // cliff_amount (2000) > total_amount (1000) - invalid
    const rewardFunction = createCliffLinearReward({
      cliffValue: new BN(100),
      endValue: new BN(1000),
      cliffAmount: new BN(2_000_000_000), // More than total!
      totalAmount: new BN(1_000_000_000),
    });

    const callbacks = expectError(
      "InvalidVestingSchedule",
      "Should have failed because cliff_amount > total_amount",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader: { time: {} },
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails with excessive min_duration", async function () {
    const dao = await setupDaoForTwapTests(this);

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

    // 365 days + 1 second - exceeds maximum
    const minDuration = 365 * 24 * 60 * 60 + 1;
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    const rewardFunction = createCliffLinearReward();

    const callbacks = expectError(
      "MinDurationTooLarge",
      "Should have failed because min_duration exceeds maximum allowed",
    );

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("succeeds with max allowed min_duration", async function () {
    const dao = await setupDaoForTwapTests(this);

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

    // Exactly 365 days - should succeed
    const minDuration = 365 * 24 * 60 * 60;
    const oracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });
    const rewardFunction = createCliffLinearReward();

    await ppClient
      .initializePerformancePackageIx({
        createKey: createKey.publicKey,
        mint,
        mintGovernor,
        mintAuthority,
        authority: this.payer.publicKey,
        recipient: this.payer.publicKey,
        payer: this.payer.publicKey,
        oracleReader,
        rewardFunction,
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);

    assert.isNotNull(ppAccount);
    assert.isDefined(ppAccount.oracleReader.futarchyTwap);
    assert.equal(ppAccount.oracleReader.futarchyTwap.minDuration, minDuration);
  });
}
