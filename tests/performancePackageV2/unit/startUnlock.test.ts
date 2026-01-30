import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
} from "@metadaoproject/futarchy/v0.7";
import {
  setupPerformancePackageV2,
  createCliffLinearReward,
} from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let ppClient: PerformancePackageV2Client;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
    ppClient = this.performancePackageV2;
  });

  it("successfully starts when called by authority", async function () {
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

    // Verify initial status is Locked
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);

    // Call start_unlock as authority
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify status is now Unlocking
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);
    assert.equal(ppAccount.seqNum.toString(), "1");
  });

  it("successfully starts when called by recipient", async function () {
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

    // Verify initial status is Locked
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.locked);

    // Call start_unlock as recipient
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: recipient.publicKey,
      })
      .signers([recipient])
      .rpc();

    // Verify status is now Unlocking
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);
    assert.equal(ppAccount.seqNum.toString(), "1");
  });

  it("fails when status is not Locked", async function () {
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

    // First, start the unlock to transition to Unlocking status
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify status is now Unlocking
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);

    // Try to call start_unlock again - should fail because status is Unlocking, not Locked
    const callbacks = expectError(
      "NotLocked",
      "Should have failed because status is not Locked",
    );

    // Add a ComputeBudget instruction to get a different tx signature
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when min_unlock_timestamp not reached", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get the current clock timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Set minUnlockTimestamp to far in the future (1 hour from now)
    const minUnlockTimestamp = new BN(currentTimestamp + 3600);

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp,
      },
    );

    // Try to call start_unlock before min_unlock_timestamp is reached
    const callbacks = expectError(
      "UnlockTimestampNotReached",
      "Should have failed because min_unlock_timestamp not reached",
    );

    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("successfully starts after min_unlock_timestamp is reached", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();

    // Get the current clock timestamp
    const currentClock = await this.banksClient.getClock();
    const currentTimestamp = Number(currentClock.unixTimestamp);

    // Set minUnlockTimestamp to 10 seconds in the future
    const minUnlockTimestamp = new BN(currentTimestamp + 10);

    const { performancePackage } = await setupPerformancePackageV2(
      this.banksClient,
      mintGovernorClient,
      ppClient,
      this.payer,
      {
        authority: authority.publicKey,
        recipient: recipient.publicKey,
        rewardFunction: createCliffLinearReward(),
        minUnlockTimestamp,
      },
    );

    // Advance time to past the min_unlock_timestamp
    await this.advanceBySeconds(15);

    // Now it should succeed
    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify status is now Unlocking
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount.status.unlocking);
  });

  it("fails when signer is neither authority nor recipient", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const unauthorized = Keypair.generate();

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

    // Try to call start_unlock with an unauthorized signer
    const callbacks = expectError(
      "Unauthorized",
      "Should have failed because signer is neither authority nor recipient",
    );

    await ppClient
      .startUnlockIx({
        performancePackage,
        signer: unauthorized.publicKey,
      })
      .signers([unauthorized])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
