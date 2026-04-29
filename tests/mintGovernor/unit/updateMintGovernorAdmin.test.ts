import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { MintGovernorClient } from "@metadaoproject/programs";
import { setupMintWithGovernor } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mintGovernor: PublicKey;
  let newAdmin: Keypair;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    ({ mintGovernor } = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    ));
    newAdmin = Keypair.generate();
  });

  it("successfully updates admin", async function () {
    const governorBefore =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);
    const seqNumBefore = governorBefore.seqNum;

    await mintGovernorClient
      .updateMintGovernorAdminIx({
        mintGovernor,
        admin: this.payer.publicKey,
        newAdmin: newAdmin.publicKey,
      })
      .rpc();

    const governorAfter =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);

    assert.equal(governorAfter.admin.toBase58(), newAdmin.publicKey.toBase58());
    assert.equal(
      governorAfter.seqNum.toString(),
      seqNumBefore.addn(1).toString(),
    );
  });

  it("new admin can perform admin actions", async function () {
    // Transfer admin to newAdmin
    await mintGovernorClient
      .updateMintGovernorAdminIx({
        mintGovernor,
        admin: this.payer.publicKey,
        newAdmin: newAdmin.publicKey,
      })
      .rpc();

    // New admin should be able to add a mint authority
    const authorizedMinter = Keypair.generate();

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: newAdmin.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .signers([newAdmin])
      .rpc();

    // Verify the mint authority was created
    const governorAfter =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);
    // seqNum: 1 (transfer authority) + 1 (update admin) + 1 (add mint authority) = 3
    assert.equal(governorAfter.seqNum.toString(), "3");
  });

  it("old admin cannot perform admin actions after transfer", async function () {
    // Transfer admin to newAdmin
    await mintGovernorClient
      .updateMintGovernorAdminIx({
        mintGovernor,
        admin: this.payer.publicKey,
        newAdmin: newAdmin.publicKey,
      })
      .rpc();

    // Old admin (payer) should no longer be able to add a mint authority
    const authorizedMinter = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because old admin is no longer authorized",
    );

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when admin is not the current admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed due to unauthorized admin",
    );

    await mintGovernorClient
      .updateMintGovernorAdminIx({
        mintGovernor,
        admin: fakeAdmin.publicKey,
        newAdmin: newAdmin.publicKey,
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
