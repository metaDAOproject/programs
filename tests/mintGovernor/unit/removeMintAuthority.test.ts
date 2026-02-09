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

    // Add a mint authority for testing removal
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

  it("successfully removes mint authority", async function () {
    // Verify the mint authority exists before removal
    const mintAuthorityAccountBefore =
      await this.banksClient.getAccount(mintAuthority);
    assert.isNotNull(mintAuthorityAccountBefore);

    await mintGovernorClient
      .removeMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: this.payer.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .rpc();

    // Verify the mint authority account was closed
    const mintAuthorityAccountAfter =
      await this.banksClient.getAccount(mintAuthority);
    assert.isNull(mintAuthorityAccountAfter);

    // Verify seq_num was incremented
    const mintGovernorAccount = await mintGovernorClient.fetchMintGovernor(
      this.mintGovernorAddr,
    );
    // seq_num: 1 from transfer, 1 from add, 1 from remove = 3
    assert.equal(mintGovernorAccount.seqNum.toString(), "3");
  });

  it("successfully removes mint authority that has minted tokens", async function () {
    // First, mint some tokens
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
    const mintAuthorityAccountBefore =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(mintAuthorityAccountBefore.totalMinted.toString(), "500");

    // Now remove the mint authority
    await mintGovernorClient
      .removeMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: this.payer.publicKey,
        rentDestination: this.payer.publicKey,
      })
      .rpc();

    // Verify the mint authority account was closed
    const mintAuthorityAccountAfter =
      await this.banksClient.getAccount(mintAuthority);
    assert.isNull(mintAuthorityAccountAfter);
  });

  it("fails when admin is not the governor's admin", async function () {
    const fakeAdmin = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed due to unauthorized admin",
    );

    await mintGovernorClient
      .removeMintAuthorityIx({
        mintGovernor: this.mintGovernorAddr,
        mintAuthority,
        admin: fakeAdmin.publicKey,
        rentDestination: fakeAdmin.publicKey,
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
        .removeMintAuthorityIx({
          mintGovernor: this.mintGovernorAddr,
          mintAuthority: nonExistentMintAuthority,
          admin: this.payer.publicKey,
          rentDestination: this.payer.publicKey,
        })
        .rpc();

      assert.fail("Should have failed because mint_authority does not exist");
    } catch (e) {
      // Account does not exist error
      assert.include(e.message, "AccountNotInitialized");
    }
  });
}
