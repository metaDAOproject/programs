import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { GatedMintClient } from "@metadaoproject/programs";
import { setupGatedMint } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let gatedMintClient: GatedMintClient;
  let admin: Keypair;
  let mint: PublicKey;
  let gatedMintConfig: PublicKey;

  before(async function () {
    gatedMintClient = this.gatedMint;
  });

  beforeEach(async function () {
    admin = Keypair.generate();
    ({ mint, gatedMintConfig } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      admin.publicKey,
    ));
  });

  it("admin sets whitelist_admin from None to Some", async function () {
    const newWhitelistAdmin = Keypair.generate().publicKey;

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: newWhitelistAdmin,
      })
      .signers([admin])
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.whitelistAdmin.toBase58(), newWhitelistAdmin.toBase58());
    assert.equal(cfg.seqNum.toString(), "1");
  });

  it("admin replaces existing whitelist_admin with a different key", async function () {
    const first = Keypair.generate().publicKey;
    const second = Keypair.generate().publicKey;

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: first,
      })
      .signers([admin])
      .rpc();

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: second,
      })
      .signers([admin])
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.whitelistAdmin.toBase58(), second.toBase58());
    assert.equal(cfg.seqNum.toString(), "2");
  });

  it("admin clears whitelist_admin", async function () {
    const wl = Keypair.generate().publicKey;

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: wl,
      })
      .signers([admin])
      .rpc();

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: null,
      })
      .signers([admin])
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.isNull(cfg.whitelistAdmin);
    assert.equal(cfg.seqNum.toString(), "2");
  });

  it("fails when signer is not the admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because signer is not the admin",
    );

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: fakeAdmin.publicKey,
        whitelistAdmin: Keypair.generate().publicKey,
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("current whitelist_admin cannot rotate itself", async function () {
    const whitelistAdmin = Keypair.generate();

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: whitelistAdmin.publicKey,
      })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because whitelist_admin cannot rotate itself",
    );

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: whitelistAdmin.publicKey,
        whitelistAdmin: Keypair.generate().publicKey,
      })
      .signers([whitelistAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when new whitelist_admin equals admin", async function () {
    const callbacks = expectError(
      "InvalidWhitelistAdmin",
      "Should have failed because whitelist_admin equals admin",
    );

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: admin.publicKey,
      })
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails after gating is disabled", async function () {
    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is disabled",
    );

    await gatedMintClient
      .setWhitelistAdminIx({
        mint,
        admin: admin.publicKey,
        whitelistAdmin: Keypair.generate().publicKey,
      })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
