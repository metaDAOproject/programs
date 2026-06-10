import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { mintTo } from "spl-token-bankrun";
import {
  GatedMintClient,
  getWhitelistedUserAddr,
} from "@metadaoproject/programs";
import { setupGatedMint, whitelistUser, freezeTokenAccount } from "../utils.js";
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

  it("admin successfully removes a whitelisted user", async function () {
    const user = Keypair.generate().publicKey;
    const [addr] = getWhitelistedUserAddr({ mint, user });

    await whitelistUser(gatedMintClient, mint, admin, user, this.payer);
    assert.isNotNull(await this.banksClient.getAccount(addr));

    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: admin.publicKey,
        user,
        rentDestination: this.payer.publicKey,
      })
      .signers([admin])
      .rpc();

    assert.isNull(await this.banksClient.getAccount(addr));

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    // init = 0, add = 1, remove = 2
    assert.equal(cfg.seqNum.toString(), "2");
  });

  it("whitelist_admin successfully removes a whitelisted user", async function () {
    const whitelistAdmin = Keypair.generate();
    const { mint: m } = await setupGatedMint(
      this.banksClient,
      gatedMintClient,
      this.payer,
      admin.publicKey,
      whitelistAdmin.publicKey,
    );

    const user = Keypair.generate().publicKey;
    const [addr] = getWhitelistedUserAddr({ mint: m, user });

    await whitelistUser(gatedMintClient, m, whitelistAdmin, user, this.payer);
    assert.isNotNull(await this.banksClient.getAccount(addr));

    await gatedMintClient
      .removeWhitelistedUserIx({
        mint: m,
        authority: whitelistAdmin.publicKey,
        user,
        rentDestination: this.payer.publicKey,
      })
      .signers([whitelistAdmin])
      .rpc();

    assert.isNull(await this.banksClient.getAccount(addr));
  });

  it("fails when signer is neither admin nor whitelist_admin", async function () {
    const user = Keypair.generate().publicKey;
    await whitelistUser(gatedMintClient, mint, admin, user, this.payer);

    const stranger = Keypair.generate();
    const callbacks = expectError(
      "UnauthorizedWhitelistAuthority",
      "Should have failed because signer is not authorized",
    );

    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: stranger.publicKey,
        user,
        rentDestination: this.payer.publicKey,
      })
      .signers([stranger])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when the whitelist entry does not exist", async function () {
    const user = Keypair.generate().publicKey;

    try {
      await gatedMintClient
        .removeWhitelistedUserIx({
          mint,
          authority: admin.publicKey,
          user,
          rentDestination: this.payer.publicKey,
        })
        .signers([admin])
        .rpc();
      assert.fail("Should have failed because whitelisted_user does not exist");
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });

  it("fails after gating is disabled", async function () {
    const user = Keypair.generate().publicKey;
    await whitelistUser(gatedMintClient, mint, admin, user, this.payer);

    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is disabled",
    );

    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: admin.publicKey,
        user,
        rentDestination: this.payer.publicKey,
      })
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("removing one user leaves other whitelist entries intact", async function () {
    const userA = Keypair.generate().publicKey;
    const userB = Keypair.generate().publicKey;
    const [addrA] = getWhitelistedUserAddr({ mint, user: userA });
    const [addrB] = getWhitelistedUserAddr({ mint, user: userB });

    await whitelistUser(gatedMintClient, mint, admin, userA, this.payer);
    await whitelistUser(gatedMintClient, mint, admin, userB, this.payer);

    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: admin.publicKey,
        user: userA,
        rentDestination: this.payer.publicKey,
      })
      .signers([admin])
      .rpc();

    assert.isNull(await this.banksClient.getAccount(addrA));

    const wuB = await gatedMintClient.fetchWhitelistedUser(addrB);
    assert.isNotNull(wuB);
    assert.equal(wuB.user.toBase58(), userB.toBase58());
  });

  it("allows re-adding a user after removal", async function () {
    const user = Keypair.generate().publicKey;
    const [addr] = getWhitelistedUserAddr({ mint, user });

    await whitelistUser(gatedMintClient, mint, admin, user, this.payer);
    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: admin.publicKey,
        user,
        rentDestination: this.payer.publicKey,
      })
      .signers([admin])
      .rpc();
    assert.isNull(await this.banksClient.getAccount(addr));

    // The PDA was freed, so the same user can be whitelisted again.
    await whitelistUser(gatedMintClient, mint, admin, user, this.payer);
    assert.isNotNull(await this.banksClient.getAccount(addr));
  });

  it("revokes gated_invoke access after removal", async function () {
    const alice = Keypair.generate();
    const bob = Keypair.generate();
    const [aliceWu] = getWhitelistedUserAddr({ mint, user: alice.publicKey });

    await whitelistUser(
      gatedMintClient,
      mint,
      admin,
      alice.publicKey,
      this.payer,
    );
    await whitelistUser(
      gatedMintClient,
      mint,
      admin,
      bob.publicKey,
      this.payer,
    );

    const aliceAta = await this.createTokenAccount(mint, alice.publicKey);
    const bobAta = await this.createTokenAccount(mint, bob.publicKey);

    await mintTo(
      this.banksClient,
      this.payer,
      mint,
      aliceAta,
      this.payer,
      100_000_000n,
    );

    await freezeTokenAccount(this.context, this.banksClient, aliceAta);
    await freezeTokenAccount(this.context, this.banksClient, bobAta);

    // While whitelisted, alice can move tokens via gated_invoke.
    await gatedMintClient
      .gatedInvokeIx({
        caller: alice.publicKey,
        mint,
        instruction: token.createTransferInstruction(
          aliceAta,
          bobAta,
          alice.publicKey,
          50_000_000n,
        ),
      })
      .signers([alice])
      .rpc();

    assert.equal(
      (await this.getTokenBalance(mint, bob.publicKey)).toString(),
      "50000000",
    );

    // Revoke alice.
    await gatedMintClient
      .removeWhitelistedUserIx({
        mint,
        authority: admin.publicKey,
        user: alice.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .signers([admin])
      .rpc();

    assert.isNull(await this.banksClient.getAccount(aliceWu));

    // After removal, the whitelisted_user PDA is gone, so gated_invoke fails.
    try {
      await gatedMintClient
        .gatedInvokeIx({
          caller: alice.publicKey,
          mint,
          instruction: token.createTransferInstruction(
            aliceAta,
            bobAta,
            alice.publicKey,
            10_000_000n,
          ),
        })
        .signers([alice])
        .rpc();
      assert.fail(
        "Should have failed because alice was removed from the whitelist",
      );
    } catch (e) {
      assert.include(e.message, "AccountNotInitialized");
    }
  });
}
