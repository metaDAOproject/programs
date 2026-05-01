import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { GatedTokenClient } from "@metadaoproject/programs";
import { setupGatedMint } from "../utils.js";
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

  it("admin successfully disables gating", async function () {
    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const cfg = await gatedTokenClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.gatingDisabled, true);
    assert.equal(cfg.seqNum.toString(), "1");
  });

  it("fails when signer is not the admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because signer is not the admin",
    );

    await gatedTokenClient
      .disableGatingIx({ mint, admin: fakeAdmin.publicKey })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when disabling twice", async function () {
    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is already disabled",
    );

    await gatedTokenClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
