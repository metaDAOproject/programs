import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  getMintGovernorAddr,
} from "@metadaoproject/futarchy/v0.7";
import { createMintWithAuthority } from "../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mint: PublicKey;
  let createKey: Keypair;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    mint = await createMintWithAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      6,
    );
    createKey = Keypair.generate();
  });

  it("successfully initializes a mint governor", async function () {
    const [mintGovernor, expectedBump] = getMintGovernorAddr({
      mint,
      createKey: createKey.publicKey,
    });

    await mintGovernorClient
      .initializeMintGovernorIx({
        mint,
        createKey: createKey.publicKey,
        admin: this.payer.publicKey,
        payer: this.payer.publicKey,
      })
      .signers([createKey])
      .rpc();

    const mintGovernorAccount =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);

    assert.isNotNull(mintGovernorAccount);
    assert.equal(mintGovernorAccount.mint.toBase58(), mint.toBase58());
    assert.equal(
      mintGovernorAccount.admin.toBase58(),
      this.payer.publicKey.toBase58(),
    );
    assert.equal(
      mintGovernorAccount.createKey.toBase58(),
      createKey.publicKey.toBase58(),
    );
    assert.equal(mintGovernorAccount.seqNum.toString(), "0");
    assert.equal(mintGovernorAccount.bump, expectedBump);
  });

  it("fails when create_key does not sign", async function () {
    try {
      await mintGovernorClient
        .initializeMintGovernorIx({
          mint,
          createKey: createKey.publicKey,
          admin: this.payer.publicKey,
          payer: this.payer.publicKey,
        })
        // Intentionally NOT adding createKey as a signer
        .rpc();

      assert.fail("Should have failed due to missing createKey signature");
    } catch (e) {
      assert.include(e.message, "Signature verification failed");
    }
  });
}
