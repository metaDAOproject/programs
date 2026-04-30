import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  getMintAuthorityAddr,
} from "@metadaoproject/programs";
import { setupMintWithGovernor } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let authorizedMinter: Keypair;
  let mintAuthority: PublicKey;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    const result = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    );
    this.mint = result.mint;
    this.mintGovernorAddr = result.mintGovernor;
    authorizedMinter = Keypair.generate();

    // Add a mint authority for testing updates
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    [mintAuthority] = getMintAuthorityAddr({
      mintGovernor: this.mintGovernorAddr,
      authorizedMinter: authorizedMinter.publicKey,
    });
  });

  it("successfully updates max_total to a new value", async function () {
    const newMaxTotal = new BN(2000);

    await mintGovernorClient
      .updateMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: this.payer.publicKey,
        maxTotal: newMaxTotal,
      })
      .rpc();

    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);

    assert.equal(
      mintAuthorityAccount.maxTotal.toString(),
      newMaxTotal.toString(),
    );

    const mintGovernorAccount = await mintGovernorClient.fetchMintGovernor(
      this.mintGovernorAddr,
    );
    // seq_num: 1 from transfer, 1 from add, 1 from update = 3
    assert.equal(mintGovernorAccount.seqNum.toString(), "3");
  });

  it("successfully updates max_total to None (unlimited)", async function () {
    await mintGovernorClient
      .updateMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: this.payer.publicKey,
        maxTotal: null,
      })
      .rpc();

    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);

    assert.isNull(mintAuthorityAccount.maxTotal);
  });

  it("successfully updates max_total to value <= total_minted (soft revoke)", async function () {
    // First, mint some tokens to increase total_minted
    const destinationAta = await this.createTokenAccount(
      this.mint,
      this.payer.publicKey,
    );

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor: this.mintGovernorAddr,
        mint: this.mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: new BN(500),
      })
      .signers([authorizedMinter])
      .rpc();

    // Verify tokens were minted
    let mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(mintAuthorityAccount.totalMinted.toString(), "500");

    // Now update max_total to be equal to total_minted (soft revoke)
    await mintGovernorClient
      .updateMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: this.payer.publicKey,
        maxTotal: new BN(500),
      })
      .rpc();

    mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);

    assert.equal(mintAuthorityAccount.maxTotal.toString(), "500");
    assert.equal(mintAuthorityAccount.totalMinted.toString(), "500");
  });

  it("fails when admin is not the governor's admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed due to unauthorized admin",
    );

    await mintGovernorClient
      .updateMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: fakeAdmin.publicKey,
        maxTotal: new BN(2000),
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when mint_authority does not exist", async function () {
    const nonExistentMinter = Keypair.generate();
    const [nonExistentMintAuthority] = getMintAuthorityAddr({
      mintGovernor: this.mintGovernorAddr,
      authorizedMinter: nonExistentMinter.publicKey,
    });

    try {
      await mintGovernorClient
        .updateMintAuthorityIx({
          mintGovernor: this.mintGovernorAddr,
          mintAuthority: nonExistentMintAuthority,
          admin: this.payer.publicKey,
          maxTotal: new BN(2000),
        })
        .rpc();

      assert.fail("Should have failed because mint_authority does not exist");
    } catch (e) {
      // Account does not exist error
      assert.include(e.message, "AccountNotInitialized");
    }
  });
}
