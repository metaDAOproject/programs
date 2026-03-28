import { ComputeBudgetProgram, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
} from "@metadaoproject/futarchy-v2";
import {
  setupPerformancePackageV2,
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

  it("successfully proposes change when called by authority", async function () {
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

    // Verify change request was created
    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.isNotNull(changeRequestAccount);
    assert.equal(
      changeRequestAccount.performancePackage.toBase58(),
      performancePackage.toBase58(),
    );
    assert.equal(
      changeRequestAccount.proposer.toBase58(),
      authority.publicKey.toBase58(),
    );
    assert.equal(changeRequestAccount.pdaNonce, pdaNonce);
    assert.equal(
      changeRequestAccount.newRecipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
    assert.isNull(changeRequestAccount.newOracleReader);
    assert.isNull(changeRequestAccount.newRewardFunction);

    // Verify seq_num was incremented
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(ppAccount.seqNum.toString(), "1");
  });

  it("successfully proposes change when called by recipient", async function () {
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

    // Verify change request was created with recipient as proposer
    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.isNotNull(changeRequestAccount);
    assert.equal(
      changeRequestAccount.proposer.toBase58(),
      recipient.publicKey.toBase58(),
    );
  });

  it("successfully proposes recipient change", async function () {
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

    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.equal(
      changeRequestAccount.newRecipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
    assert.isNull(changeRequestAccount.newOracleReader);
    assert.isNull(changeRequestAccount.newRewardFunction);
  });

  it("successfully proposes oracle change", async function () {
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

    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.isNull(changeRequestAccount.newRecipient);
    assert.isNotNull(changeRequestAccount.newOracleReader);
    assert.isDefined(changeRequestAccount.newOracleReader.time);
    assert.isNull(changeRequestAccount.newRewardFunction);
  });

  it("successfully proposes reward function change", async function () {
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

    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.isNull(changeRequestAccount.newRecipient);
    assert.isNull(changeRequestAccount.newOracleReader);
    assert.isNotNull(changeRequestAccount.newRewardFunction);
    assert.isDefined(changeRequestAccount.newRewardFunction.threshold);
  });

  it("successfully proposes multiple changes at once", async function () {
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

    const pdaNonce = 1;
    const [changeRequest] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce,
    );

    const newOracleReader = { time: {} };
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

    const changeRequestAccount =
      await ppClient.fetchChangeRequest(changeRequest);
    assert.equal(
      changeRequestAccount.newRecipient.toBase58(),
      newRecipient.publicKey.toBase58(),
    );
    assert.isNotNull(changeRequestAccount.newOracleReader);
    assert.isDefined(changeRequestAccount.newOracleReader.time);
    assert.isNotNull(changeRequestAccount.newRewardFunction);
    assert.isDefined(changeRequestAccount.newRewardFunction.threshold);
  });

  it("allows multiple concurrent proposals with different nonces", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newRecipient1 = Keypair.generate();
    const newRecipient2 = Keypair.generate();

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

    // Create first proposal with nonce 1
    const pdaNonce1 = 1;
    const [changeRequest1] = ppClient.getChangeRequestAddr(
      performancePackage,
      authority.publicKey,
      pdaNonce1,
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce: pdaNonce1,
        newRecipient: newRecipient1.publicKey,
      })
      .signers([authority])
      .rpc();

    // Create second proposal with nonce 2
    const pdaNonce2 = 2;
    const [changeRequest2] = ppClient.getChangeRequestAddr(
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
        newRecipient: newRecipient2.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([authority])
      .rpc();

    // Verify both change requests exist independently
    const changeRequestAccount1 =
      await ppClient.fetchChangeRequest(changeRequest1);
    const changeRequestAccount2 =
      await ppClient.fetchChangeRequest(changeRequest2);

    assert.isNotNull(changeRequestAccount1);
    assert.isNotNull(changeRequestAccount2);
    assert.equal(changeRequestAccount1.pdaNonce, pdaNonce1);
    assert.equal(changeRequestAccount2.pdaNonce, pdaNonce2);
    assert.equal(
      changeRequestAccount1.newRecipient.toBase58(),
      newRecipient1.publicKey.toBase58(),
    );
    assert.equal(
      changeRequestAccount2.newRecipient.toBase58(),
      newRecipient2.publicKey.toBase58(),
    );
  });

  it("fails when all optional fields are None", async function () {
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

    const pdaNonce = 1;

    const callbacks = expectError(
      "NoChangesProposed",
      "Should have failed because no changes were proposed",
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        // All optional fields are null (default)
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when proposing oracle change with excessive min_duration", async function () {
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

    const dao = await setupDaoForTwapTests(this);

    // 365 days + 1 second - exceeds maximum
    const minDuration = 365 * 24 * 60 * 60 + 1;
    const newOracleReader = createFutarchyTwapOracle({ amm: dao, minDuration });

    const pdaNonce = 1;

    const callbacks = expectError(
      "MinDurationTooLarge",
      "Should have failed because proposed oracle min_duration exceeds maximum allowed",
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: authority.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newOracleReader,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when signer is neither authority nor recipient", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const unauthorized = Keypair.generate();
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

    const pdaNonce = 1;

    const callbacks = expectError(
      "Unauthorized",
      "Should have failed because signer is neither authority nor recipient",
    );

    await ppClient
      .proposeChangeIx({
        performancePackage,
        proposer: unauthorized.publicKey,
        payer: this.payer.publicKey,
        pdaNonce,
        newRecipient: newRecipient.publicKey,
      })
      .signers([unauthorized])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
