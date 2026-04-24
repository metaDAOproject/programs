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
} from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let ppClient: PerformancePackageV2Client;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
    ppClient = this.performancePackageV2;
  });

  it("successfully changes authority", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newAuthority = Keypair.generate();

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

    // Verify initial authority
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.authority.toBase58(),
      authority.publicKey.toBase58(),
    );
    assert.equal(ppAccount.seqNum.toString(), "0");

    // Change authority
    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: authority.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify authority changed
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.authority.toBase58(),
      newAuthority.publicKey.toBase58(),
    );
    assert.equal(ppAccount.seqNum.toString(), "1");
  });

  it("new authority can perform authority actions", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newAuthority = Keypair.generate();
    const newerAuthority = Keypair.generate();

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

    // Change authority to newAuthority
    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: authority.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify newAuthority is set
    let ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.authority.toBase58(),
      newAuthority.publicKey.toBase58(),
    );

    // Now newAuthority should be able to change authority again
    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: newAuthority.publicKey,
        newAuthority: newerAuthority.publicKey,
      })
      .signers([newAuthority])
      .rpc();

    // Verify newerAuthority is now set
    ppAccount = await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.authority.toBase58(),
      newerAuthority.publicKey.toBase58(),
    );
    assert.equal(ppAccount.seqNum.toString(), "2");
  });

  it("old authority cannot perform authority actions after change", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const newAuthority = Keypair.generate();
    const anotherAuthority = Keypair.generate();

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

    // Change authority to newAuthority
    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: authority.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify newAuthority is set
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.equal(
      ppAccount.authority.toBase58(),
      newAuthority.publicKey.toBase58(),
    );

    // Old authority should no longer be able to change authority
    const callbacks = expectError(
      "InvalidAuthority",
      "Should have failed because old authority is no longer the authority",
    );

    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: authority.publicKey,
        newAuthority: anotherAuthority.publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ])
      .signers([authority])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when signer is not current authority", async function () {
    const authority = Keypair.generate();
    const recipient = Keypair.generate();
    const unauthorized = Keypair.generate();
    const newAuthority = Keypair.generate();

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

    // Try to change authority with an unauthorized signer
    const callbacks = expectError(
      "InvalidAuthority",
      "Should have failed because signer is not the current authority",
    );

    await ppClient
      .changeAuthorityIx({
        performancePackage,
        authority: unauthorized.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([unauthorized])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
