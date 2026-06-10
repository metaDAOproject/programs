import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import {
  GatedMintClient,
  getGatedMintConfigAddr,
} from "@metadaoproject/programs";
import { createMintWithFreezeAuthority } from "../utils.js";
import { createMintWithAuthority } from "../../mintGovernor/utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let gatedMintClient: GatedMintClient;
  let mint: PublicKey;

  before(async function () {
    gatedMintClient = this.gatedMint;
  });

  beforeEach(async function () {
    mint = await createMintWithFreezeAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      6,
    );
  });

  it("successfully initializes a gated mint", async function () {
    const adminKey = Keypair.generate().publicKey;
    const [gatedMintConfig, expectedBump] = getGatedMintConfigAddr({ mint });

    await gatedMintClient
      .initializeGatedMintIx({
        mint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: adminKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);

    assert.isNotNull(cfg);
    assert.equal(cfg.mint.toBase58(), mint.toBase58());
    assert.equal(cfg.admin.toBase58(), adminKey.toBase58());
    assert.isNull(cfg.whitelistAdmin);
    assert.equal(cfg.gatingDisabled, false);
    assert.equal(cfg.seqNum.toString(), "0");
    assert.equal(cfg.bump, expectedBump);

    const mintAccount = await this.banksClient.getAccount(mint);
    const mintInfo = token.unpackMint(mint, {
      data: Buffer.from(mintAccount.data),
      owner: token.TOKEN_PROGRAM_ID,
      executable: false,
      lamports: mintAccount.lamports,
    });
    assert.equal(
      mintInfo.freezeAuthority.toBase58(),
      gatedMintConfig.toBase58(),
    );
  });

  it("initializes with a whitelist_admin", async function () {
    const adminKey = Keypair.generate().publicKey;
    const whitelistAdminKey = Keypair.generate().publicKey;
    const [gatedMintConfig] = getGatedMintConfigAddr({ mint });

    await gatedMintClient
      .initializeGatedMintIx({
        mint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: adminKey,
        whitelistAdmin: whitelistAdminKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.isNotNull(cfg);
    assert.equal(cfg.admin.toBase58(), adminKey.toBase58());
    assert.equal(cfg.whitelistAdmin.toBase58(), whitelistAdminKey.toBase58());
  });

  it("fails when whitelist_admin equals admin", async function () {
    const adminKey = Keypair.generate().publicKey;

    const callbacks = expectError(
      "InvalidWhitelistAdmin",
      "Should have failed because whitelist_admin equals admin",
    );

    await gatedMintClient
      .initializeGatedMintIx({
        mint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: adminKey,
        whitelistAdmin: adminKey,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint has no freeze authority", async function () {
    const noFreezeMint = await createMintWithAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      6,
    );

    const callbacks = expectError(
      "UnauthorizedFreezeAuthority",
      "Should have failed because mint has no freeze authority",
    );

    await gatedMintClient
      .initializeGatedMintIx({
        mint: noFreezeMint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when signer is not the current freeze authority", async function () {
    const wrongSigner = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedFreezeAuthority",
      "Should have failed because signer is not the current freeze authority",
    );

    await gatedMintClient
      .initializeGatedMintIx({
        mint,
        currentFreezeAuthority: wrongSigner.publicKey,
        admin: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .signers([wrongSigner])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when re-initializing the same mint", async function () {
    await gatedMintClient
      .initializeGatedMintIx({
        mint,
        currentFreezeAuthority: this.payer.publicKey,
        admin: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .rpc();

    try {
      await gatedMintClient
        .initializeGatedMintIx({
          mint,
          currentFreezeAuthority: this.payer.publicKey,
          admin: this.payer.publicKey,
          payer: this.payer.publicKey,
        })
        .postInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
        ])
        .rpc();

      assert.fail(
        "Should have failed because gated_mint_config already exists",
      );
    } catch (e) {
      assert.include(e.message, "custom program error: 0x0");
    }
  });
}
