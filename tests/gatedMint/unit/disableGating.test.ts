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

  it("admin successfully disables gating", async function () {
    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const cfg = await gatedMintClient.fetchGatedMintConfig(gatedMintConfig);
    assert.equal(cfg.gatingDisabled, true);
    assert.equal(cfg.seqNum.toString(), "1");
  });

  it("fails when signer is not the admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed because signer is not the admin",
    );

    await gatedMintClient
      .disableGatingIx({ mint, admin: fakeAdmin.publicKey })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when disabling twice", async function () {
    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .signers([admin])
      .rpc();

    const callbacks = expectError(
      "GatingDisabled",
      "Should have failed because gating is already disabled",
    );

    await gatedMintClient
      .disableGatingIx({ mint, admin: admin.publicKey })
      .postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_001 }),
      ])
      .signers([admin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
