import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  getMintAuthorityAddr,
} from "@metadaoproject/futarchy/v0.7";
import { setupMintWithGovernor } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mintGovernor: PublicKey;
  let authorizedMinter: Keypair;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    ({ mintGovernor } = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    ));
    authorizedMinter = Keypair.generate();
  });

  it("successfully adds mint authority with max_total", async function () {
    const maxTotal = new BN(1000);

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });

    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);

    assert.isNotNull(mintAuthorityAccount);
    assert.equal(
      mintAuthorityAccount.mintGovernor.toBase58(),
      mintGovernor.toBase58(),
    );
    assert.equal(
      mintAuthorityAccount.authorizedMinter.toBase58(),
      authorizedMinter.publicKey.toBase58(),
    );
    assert.equal(mintAuthorityAccount.maxTotal.toString(), maxTotal.toString());
    assert.equal(mintAuthorityAccount.totalMinted.toString(), "0");

    const mintGovernorAccount =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);
    assert.equal(mintGovernorAccount.seqNum.toString(), "2"); // 1 from transfer, 1 from add
  });

  it("successfully adds mint authority without max_total (unlimited)", async function () {
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: null,
      })
      .rpc();

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });

    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);

    assert.isNotNull(mintAuthorityAccount);
    assert.equal(
      mintAuthorityAccount.mintGovernor.toBase58(),
      mintGovernor.toBase58(),
    );
    assert.equal(
      mintAuthorityAccount.authorizedMinter.toBase58(),
      authorizedMinter.publicKey.toBase58(),
    );
    assert.isNull(mintAuthorityAccount.maxTotal);
    assert.equal(mintAuthorityAccount.totalMinted.toString(), "0");
  });

  it("fails when admin is not the governor's admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed due to unauthorized admin",
    );

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: fakeAdmin.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint_authority already exists", async function () {
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    try {
      await mintGovernorClient
        .addMintAuthorityIx({
          mintGovernor,
          admin: this.payer.publicKey,
          authorizedMinter: authorizedMinter.publicKey,
          maxTotal: new BN(500),
        })
        .rpc();

      assert.fail("Should have failed because mint_authority already exists");
    } catch (e) {
      // The init constraint will fail because the account already exists (system program error 0x0)
      assert.include(e.message, "custom program error: 0x0");
    }
  });
}
