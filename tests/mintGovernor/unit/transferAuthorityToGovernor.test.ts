import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { assert } from "chai";
import { MintGovernorClient } from "@metadaoproject/futarchy";
import { createMintWithAuthority, createMintAndGovernor } from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mint: PublicKey;
  let mintGovernor: PublicKey;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    ({ mint, mintGovernor } = await createMintAndGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    ));
  });

  it("successfully transfers mint authority to governor", async function () {
    // Verify mint authority is currently the payer
    const mintAccountBefore = await this.banksClient.getAccount(mint);
    const mintInfoBefore = token.unpackMint(mint, {
      data: Buffer.from(mintAccountBefore.data),
      owner: token.TOKEN_PROGRAM_ID,
      executable: false,
      lamports: mintAccountBefore.lamports,
    });
    assert.equal(
      mintInfoBefore.mintAuthority.toBase58(),
      this.payer.publicKey.toBase58(),
    );

    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint,
        currentAuthority: this.payer.publicKey,
      })
      .rpc();

    // Verify mint authority is now the governor PDA
    const mintAccountAfter = await this.banksClient.getAccount(mint);
    const mintInfoAfter = token.unpackMint(mint, {
      data: Buffer.from(mintAccountAfter.data),
      owner: token.TOKEN_PROGRAM_ID,
      executable: false,
      lamports: mintAccountAfter.lamports,
    });
    assert.equal(
      mintInfoAfter.mintAuthority.toBase58(),
      mintGovernor.toBase58(),
    );

    const mintGovernorAccount =
      await mintGovernorClient.fetchMintGovernor(mintGovernor);
    assert.equal(mintGovernorAccount.seqNum.toString(), "1");
  });

  it("fails when current_authority is not the actual mint authority", async function () {
    const fakeAuthority = Keypair.generate();

    try {
      await mintGovernorClient
        .transferAuthorityToGovernorIx({
          mintGovernor,
          mint,
          currentAuthority: fakeAuthority.publicKey,
        })
        .signers([fakeAuthority])
        .rpc();

      assert.fail(
        "Should have failed because fakeAuthority is not the mint authority",
      );
    } catch (e) {
      // Token program error indicating wrong owner/authority (error code 0x4)
      assert.include(e.message, "custom program error: 0x4");
    }
  });

  it("fails when mint_governor.mint does not match mint", async function () {
    // Create a different mint with payer as authority
    const mintB = await createMintWithAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      6,
    );

    // Attempt to transfer authority for mintB using mintGovernor (which is for mint)
    const callbacks = expectError(
      "MintMismatch",
      "Should have failed because mint_governor.mint does not match the provided mint",
    );

    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint: mintB, // Wrong mint - governor is for mint
        currentAuthority: this.payer.publicKey,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when governor does not hold authority after previous reclaim", async function () {
    // Transfer authority to governor
    await mintGovernorClient
      .transferAuthorityToGovernorIx({
        mintGovernor,
        mint,
        currentAuthority: this.payer.publicKey,
      })
      .rpc();

    // Reclaim authority back to payer
    await mintGovernorClient
      .reclaimAuthorityIx({
        mintGovernor,
        mint,
        admin: this.payer.publicKey,
        newAuthority: this.payer.publicKey,
      })
      .rpc();

    // Verify mint authority is back to payer
    const mintAccount = await this.banksClient.getAccount(mint);
    const mintInfo = token.unpackMint(mint, {
      data: Buffer.from(mintAccount.data),
      owner: token.TOKEN_PROGRAM_ID,
      executable: false,
      lamports: mintAccount.lamports,
    });
    assert.equal(
      mintInfo.mintAuthority.toBase58(),
      this.payer.publicKey.toBase58(),
    );

    // Attempt to transfer authority using governor PDA as current authority
    // This should fail because the governor no longer holds the authority
    try {
      await mintGovernorClient
        .transferAuthorityToGovernorIx({
          mintGovernor,
          mint,
          currentAuthority: mintGovernor, // Governor no longer has authority
        })
        .rpc();

      assert.fail(
        "Should have failed because governor no longer holds mint authority",
      );
    } catch (e) {
      // The PDA cannot sign as a regular signer
      assert.include(e.message, "Signature verification failed");
    }
  });
}
