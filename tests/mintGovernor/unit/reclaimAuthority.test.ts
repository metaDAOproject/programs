import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  getMintAuthorityAddr,
} from "@metadaoproject/futarchy/v0.7";
import { setupMintWithGovernor, createMintAndGovernor } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mint: PublicKey;
  let mintGovernor: PublicKey;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    ({ mint, mintGovernor } = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    ));
  });

  it("successfully reclaims authority to new address", async function () {
    const newAuthority = Keypair.generate();

    // Verify governor currently holds mint authority
    const mintAccountBefore = await token.getMint(
      this.provider.connection,
      mint,
    );
    assert.isTrue(mintAccountBefore.mintAuthority.equals(mintGovernor));

    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: this.payer.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .rpc();

    // Verify mint authority was transferred to new address
    const mintAccountAfter = await token.getMint(
      this.provider.connection,
      mint,
    );
    assert.isTrue(
      mintAccountAfter.mintAuthority.equals(newAuthority.publicKey),
    );

    // Verify seq_num was incremented
    const mintGovernorAccount =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);
    // seq_num: 1 from transfer_authority_to_governor, 1 from reclaim = 2
    assert.equal(mintGovernorAccount.seqNum.toString(), "2");
  });

  it("successfully reclaims authority back to admin", async function () {
    // Verify governor currently holds mint authority
    const mintAccountBefore = await token.getMint(
      this.provider.connection,
      mint,
    );
    assert.isTrue(mintAccountBefore.mintAuthority.equals(mintGovernor));

    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: this.payer.publicKey,
        newAuthority: this.payer.publicKey,
      })
      .rpc();

    // Verify mint authority was transferred back to admin
    const mintAccountAfter = await token.getMint(
      this.provider.connection,
      mint,
    );
    assert.isTrue(mintAccountAfter.mintAuthority.equals(this.payer.publicKey));
  });

  it("existing mint authorities cannot mint after reclaim", async function () {
    const authorizedMinter = Keypair.generate();
    const newAuthority = Keypair.generate();

    // Add a mint authority
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    // Create destination token account
    const destination = await this.createTokenAccount(
      mint,
      this.payer.publicKey,
    );

    // Verify minting works before reclaim
    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destination,
        authorizedMinter: authorizedMinter.publicKey,
        amount: new BN(100),
      })
      .signers([authorizedMinter])
      .rpc();

    const balanceBefore = await this.getTokenBalance(
      mint,
      this.payer.publicKey,
    );
    assert.equal(balanceBefore.toString(), "100");

    // Reclaim authority
    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: this.payer.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .rpc();

    // Try to mint with the existing mint authority - should fail
    try {
      await mintGovernorClient
        .mintTokensIx({
          mintGovernor,
          mint,
          destination,
          authorizedMinter: authorizedMinter.publicKey,
          amount: new BN(100),
        })
        .signers([authorizedMinter])
        .rpc();

      assert.fail(
        "Should have failed because governor no longer holds mint authority",
      );
    } catch (e) {
      // The mint_to CPI will fail because the governor PDA is no longer the mint authority
      // Token program returns error code 0x4 ("owner does not match")
      assert.include(e.message, "custom program error: 0x4");
    }
  });

  it("mint authorities can still be removed after reclaim", async function () {
    const authorizedMinter = Keypair.generate();
    const newAuthority = Keypair.generate();

    // Add a mint authority
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });

    // Verify the mint authority exists
    const mintAuthorityAccountBefore =
      await this.banksClient.getAccount(mintAuthority);
    assert.isNotNull(mintAuthorityAccountBefore);

    // Reclaim authority
    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: this.payer.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .rpc();

    // Remove the mint authority - should succeed even after reclaim
    await mintGovernorClient
      .removeMintAuthorityIx({
        mintGovernor,
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
    const newAuthority = Keypair.generate();

    const callbacks = expectError(
      "UnauthorizedAdmin",
      "Should have failed due to unauthorized admin",
    );

    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: fakeAdmin.publicKey,
        newAuthority: newAuthority.publicKey,
      })
      .signers([fakeAdmin])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when governor does not currently hold mint authority", async function () {
    // Create a governor without transferring mint authority
    const { mint: mintWithoutAuth, mintGovernor: governorWithoutAuth } =
      await createMintAndGovernor(
        this.banksClient,
        mintGovernorClient,
        this.payer,
      );

    try {
      await mintGovernorClient
        .reclaimAuthorityIx({
          mintGovernor: governorWithoutAuth,
          mint: mintWithoutAuth,
          admin: this.payer.publicKey,
          newAuthority: this.payer.publicKey,
        })
        .rpc();

      assert.fail(
        "Should have failed because governor does not hold mint authority",
      );
    } catch (e) {
      // The set_authority CPI will fail because the governor PDA is not the mint authority
      // Token program returns error code 0x4 ("owner does not match")
      assert.include(e.message, "custom program error: 0x4");
    }
  });
}
