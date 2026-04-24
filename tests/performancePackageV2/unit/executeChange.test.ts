import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
} from "@metadaoproject/futarchy";
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
        signer: recipient.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([recipient])
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

  it("fails with stale CR after authority changes via change_authority", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newAuthority = Keypair.generate();
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

    // Authority proposes a recipient change
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

    // Authority transfers authority to newAuthority
    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: authority.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Recipient tries to execute the old CR — should fail because authority changed
    const callbacks = expectError(
      "StaleChangeRequest",
      "Should have failed because authority changed since CR was proposed",
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

  it("fails with stale CR after recipient changes via execute_change", async function () {
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

    // Recipient proposes some change (oracle change)
    const pdaNonce = 1;
    const [staleCR] = ppClient.getChangeRequestAddr(
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
        newOracleReader: { time: {} },
      })
      .signers([recipient])
      .rpc();

    // Authority proposes a recipient change (separate CR)
    const pdaNonce2 = 2;
    const [recipientChangeCR] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce2,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce: pdaNonce2,
        newRecipient: newRecipient.publicKey,
      })
      .signers([authority])
      .rpc();

    // Recipient executes the recipient change CR
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest: recipientChangeCR,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify recipient changed
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );

    // Authority tries to execute the old recipient's CR — should fail
    const callbacks = expectError(
      "StaleChangeRequest",
      "Should have failed because the proposing recipient has changed",
    );

    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest: staleCR,
        executor: authority.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("concurrent CRs from authority and recipient both succeed", async function () {
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

    // Authority proposes CR1: change reward function
    const pdaNonce1 = 1;
    const [cr1] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce1,
    );

    const newRewardFunction = createThresholdReward([
      { threshold: new BN(100), cumulativeAmount: new BN(100_000_000) },
    ]);

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce: pdaNonce1,
        newRewardFunction,
      })
      .signers([authority])
      .rpc();

    // Recipient proposes CR2: change recipient
    const pdaNonce2 = 1;
    const [cr2] = ppClient.getChangeRequestAddr(
      performancePackage,
      recipient.publicKey,
      pdaNonce2,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: recipient.publicKey,
        payer: this.payer.publicKey,
        pdaNonce: pdaNonce2,
        newRecipient: newRecipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Recipient executes CR1 (authority proposed)
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest: cr1,
        executor: recipient.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Authority executes CR2 (recipient proposed)
    await ppClient
      .executeChangeIx({
        performancePackage,
        changeRequest: cr2,
        executor: authority.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([authority])
      .rpc();

    // Verify both changes applied
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.recipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
    assert.isDefined(ppAccount.rewardFunction.threshold);
  });

  it("fails with stale CR after PP is closed and recreated", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient = Keypair.generate();

    const { performancePackage, createKey, mint, mintGovernor, mintAuthority } =
      await setupPerformancePackageV2(
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

    // Authority proposes a recipient change
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

    // Close the PP
    await ppClient
      .closePerformancePackageIx({
        performancePackage,
        admin: this.payer.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .rpc();

    // Advance time so recreated PP gets a different created_at_timestamp
    await this.advanceBySeconds(2);

    // Recreate PP at same address (same createKey → same PDA)
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
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp: new BN(0),
      })
      .signers([createKey])
      .rpc();

    // Attempt to execute the old CR — should fail due to timestamp mismatch
    const callbacks = expectError(
      "StaleChangeRequest",
      "Should have failed because CR was created for previous PP incarnation",
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
        signer: recipient.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([recipient])
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
