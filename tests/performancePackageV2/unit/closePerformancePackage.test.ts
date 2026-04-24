import { Keypair } from "@solana/web3.js";
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

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let ppClient: PerformancePackageV2Client;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
    ppClient = this.performancePackageV2;
  });

  it("successfully closes", async function () {
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

    // Verify PP exists before closing
    const ppAccount =
      await ppClient.fetchPerformancePackage(performancePackage);
    assert.isDefined(ppAccount);
    assert.isDefined(ppAccount.status.locked);

    const rentDestination = Keypair.generate().publicKey;

    // Close the PP
    await ppClient
      .closePerformancePackageIx({
        performancePackage,
        admin: this.payer.publicKey,
        rentDestination,
      })
      .rpc();

    // Verify PP no longer exists
    const rawAccount = await this.banksClient.getAccount(performancePackage);
    assert.isNull(rawAccount);
  });
}
