import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
} from "@metadaoproject/futarchy/v0.7";
import {
  setupPerformancePackageV2,
  createCliffLinearReward,
  createThresholdReward,
  createFutarchyTwapOracle,
} from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let ppClient: PerformancePackageV2Client;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
    ppClient = this.performancePackageV2;
  });

  it("successfully executes (authority proposed, recipient signs)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Authority proposes a change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify change was applied
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
  });

  it("successfully executes (recipient proposed, authority signs)", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Recipient proposes a change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      recipient.publicKey,
      pdaNonce,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: recipient.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Authority executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: authority.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify change was applied
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
  });

  it("successfully executes recipient change", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Verify initial recipient
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      recipient.publicKey.toBase58(),
    );

    // Authority proposes recipient change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify recipient was changed
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
  });

  it("successfully executes oracle change", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Initialize with FutarchyTwap oracle
    const fakeAmm = Keypair.generate().publicKey;
    const initialOracleReader = createFutarchyTwapOracle({ amm: fakeAmm });

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        oracleReader: initialOracleReader,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Verify initial oracle is FutarchyTwap
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.oracleReader.futarchyTwap);
    assert.equal(
      ppAccount.oracleReader.futarchyTwap.amm.toBase58(),
      fakeAmm.toBase58(),
    );

    // Authority proposes oracle change (FutarchyTwap -> Time)
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    const newOracleReader = { time: {} };

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newOracleReader,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify oracle was changed to Time
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.oracleReader.time);
  });

  it("successfully executes reward function change", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Verify initial reward function is CliffLinear
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.rewardFunction.cliffLinear);

    // Authority proposes reward function change to Threshold
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    const newRewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
      { threshold: new BN(200), cumulativeAmount: new BN(200_000_000) },
    ]);

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRewardFunction,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify reward function was changed to Threshold
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.rewardFunction.threshold);
  });

  it("successfully executes multiple changes at once", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Verify initial state
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      recipient.publicKey.toBase58(),
    );
    assert.isDefined(ppAccount.oracleReader.time);
    assert.isDefined(ppAccount.rewardFunction.cliffLinear);

    // Authority proposes multiple changes at once
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    // We don't need a real AMM for this test, just a pubkey
    const fakeAmm = Keypair.generate().publicKey;
    const newOracleReader = createFutarchyTwapOracle({ amm: fakeAmm });
    const newRewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
    ]);

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
        newOracleReader,
        newRewardFunction,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify all changes were applied
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
    assert.isDefined(ppAccount.oracleReader.futarchyTwap);
    assert.equal(
      ppAccount.oracleReader.futarchyTwap.amm.toBase58(),
      fakeAmm.toBase58(),
    );
    assert.equal(ppAccount.oracleReader.futarchyTwap.minDuration, 60);
    assert.equal(ppAccount.oracleReader.futarchyTwap.startValue.toNumber(), 0);
    assert.equal(ppAccount.oracleReader.futarchyTwap.startTime.toNumber(), 0);
    assert.equal(ppAccount.oracleReader.futarchyTwap.endValue.toNumber(), 0);
    assert.equal(ppAccount.oracleReader.futarchyTwap.endTime.toNumber(), 0);
    assert.isDefined(ppAccount.rewardFunction.threshold);
  });

  it("closes change_request account and returns rent", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();
    const rentDestination = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Authority proposes a change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify change request exists
    let changeRequestAccount = await ppClient.fetchChangeRequest(changeRequest);
    assert.isNotNull(changeRequestAccount);

    // Get rent destination balance before
    const rentDestBalanceBefore = await this.banksClient.getBalance(
      rentDestination.publicKey,
    );

    // Recipient executes the change
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: rentDestination.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify change request account was closed
    const closedAccount = await this.banksClient.getAccount(changeRequest);
    assert.isNull(closedAccount);

    // Verify rent was returned
    const rentDestBalanceAfter = await this.banksClient.getBalance(
      rentDestination.publicKey,
    );
    assert.isTrue(rentDestBalanceAfter > rentDestBalanceBefore);
  });

  it("fails when same party tries to propose and execute", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Authority proposes a change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([authority])
      .rpc();

    // Authority tries to execute their own proposal - should fail
    const callbacks = expectError(
      "InvalidExecutor",
      "Should have failed because same party cannot propose and execute",
    );

    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: authority.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when oracle change attempted while Unlocking", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Authority proposes an oracle change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    const newOracleReader = { time: {} };

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newOracleReader,
      })
      .signers([authority])
      .rpc();

    // Start unlock to transition to Unlocking status
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([authority])
      .rpc();

    // Verify status is Unlocking
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);

    // Try to execute oracle change while Unlocking - should fail
    const callbacks = expectError(
      "NotLocked",
      "Should have failed because oracle change cannot be executed while Unlocking",
    );

    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when reward function change attempted while Unlocking", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      },
    );

    // Authority proposes a reward function change
    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    const newRewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
    ]);

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRewardFunction,
      })
      .signers([authority])
      .rpc();

    // Start unlock to transition to Unlocking status
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([authority])
      .rpc();

    // Verify status is Unlocking
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);

    // Try to execute reward function change while Unlocking - should fail
    const callbacks = expectError(
      "NotLocked",
      "Should have failed because reward function change cannot be executed while Unlocking",
    );

    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
