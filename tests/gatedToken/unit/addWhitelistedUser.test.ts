import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  GatedTokenClient,
  getWhitelistedUserAddr,
} from "@metadaoproject/programs";
import { setupGatedMint, whitelistUser } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let gatedTokenClient: GatedTokenClient;
  let admin: Keypair;
  let mint: PublicKey;
  let gatedMintConfig: PublicKey;

  before(async function () {
    gatedTokenClient = this.gatedToken;
  });

  beforeEach(async function () {
    admin = Keypair.generate();
    ({ mint, gatedMintConfig } = await setupGatedMint(
      this.banksClient,
      gatedTokenClient,
      this.payer,
      admin.publicKey,
    ));
  });

  it("admin successfully whitelists a new user (payer != admin)", async function () {
    const user = Keypair.generate().publicKey;
    const [expectedAddr, expectedBump] = getWhitelistedUserAddr({ mint, user });

    await gatedTokenClient
      .addWhitelistedUserIx({
        mint,
        admin: admin.publicKey,
        user,
        payer: this.payer.publicKey,
      })
      .signers([admin])
      .rpc();

    const wu = await gatedTokenClient.fetchWhitelistedUser(expectedAddr);

    assert.isNotNull(wu);
    assert.equal(wu.mint.toBase58(), mint.toBase58());
    assert.equal(wu.user.toBase58(), user.toBase58());
    assert.equal(wu.bump, expectedBump);

    const cfg = await gatedTokenClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.seqNum.toString(), "1");
  });

  it("fails when signer is not the admin", async function () {
    const fakeAdmin = Keypair.generate();
    const user = Keypair.generate().publicKey;

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because signer is not the admin",
    );

    await gatedTokenClient
      .addWhitelistedUserIx({
        mint,
        admin: fakeAdmin.publicKey,
        user,
        payer: this.payer.publicKey,
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when re-adding an existing user", async function () {
    const user = Keypair.generate().publicKey;

    await whitelistUser(gatedTokenClient, mint, admin, user, this.payer);

    try {
      await gatedTokenClient
        .addWhitelistedUserIx({
          mint,
          admin: admin.publicKey,
          user,
          payer: this.payer.publicKey,
        })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .signers([admin])
        .rpc();

      assert.fail("Should have failed because whitelisted_user already exists");
    } catch (e) {
      assert.include(e.message, "custom program error: 0x0");
    }
  });

  it("fails after gating is disabled", async function () {
    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const user = Keypair.generate().publicKey;

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is disabled",
    );

    await gatedTokenClient
      .addWhitelistedUserIx({
        mint,
        admin: admin.publicKey,
        user,
        payer: this.payer.publicKey,
      })
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("distinct mints have independent whitelists", async function () {
    const otherAdmin = Keypair.generate();
    const { mint: otherMint } = await setupGatedMint(
      this.banksClient,
      gatedTokenClient,
      this.payer,
      otherAdmin.publicKey,
    );

    const user = Keypair.generate().publicKey;

    const wuAddrA = await whitelistUser(
      gatedTokenClient,
      mint,
      admin,
      user,
      this.payer,
    );
    const wuAddrB = await whitelistUser(
      gatedTokenClient,
      otherMint,
      otherAdmin,
      user,
      this.payer,
    );

    assert.notEqual(wuAddrA.toBase58(), wuAddrB.toBase58());

    const wuA = await gatedTokenClient.fetchWhitelistedUser(wuAddrA);
    const wuB = await gatedTokenClient.fetchWhitelistedUser(wuAddrB);

    assert.isNotNull(wuA);
    assert.isNotNull(wuB);
    assert.equal(wuA.mint.toBase58(), mint.toBase58());
    assert.equal(wuB.mint.toBase58(), otherMint.toBase58());
    assert.equal(wuA.user.toBase58(), user.toBase58());
    assert.equal(wuB.user.toBase58(), user.toBase58());
  });
}
