import { Keypair, PublicKey } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import BN from "bn.js";
import { assert } from "chai";
import {
  MintGovernorClient,
  getMintAuthorityAddr,
} from "@metadaoproject/futarchy";
import {
  setupMintWithGovernor,
  createMintAndGovernor,
  createMintWithAuthority,
} from "../utils.js";
import { expectError } from "../../utils.js";

export default function suite() {
  let mintGovernorClient: MintGovernorClient;
  let mint: PublicKey;
  let mintGovernor: PublicKey;
  let authorizedMinter: Keypair;
  let destinationAta: PublicKey;

  before(async function () {
    mintGovernorClient = this.mintGovernor;
  });

  beforeEach(async function () {
    ({ mint, mintGovernor } = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    ));
    authorizedMinter = Keypair.generate();
    destinationAta = await this.createTokenAccount(mint, this.payer.publicKey);
  });

  it("successfully mints tokens within limit", async function () {
    const maxTotal = new BN(1000);
    const mintAmount = new BN(500);

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: mintAmount,
      })
      .signers([authorizedMinter])
      .rpc();

    const balance = await this.getTokenBalance(mint, this.payer.publicKey);
    assert.equal(balance.toString(), mintAmount.toString());

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });
    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      mintAmount.toString(),
    );
  });

  it("successfully mints tokens with unlimited authority", async function () {
    const mintAmount = new BN(5000);

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: null,
      })
      .rpc();

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: mintAmount,
      })
      .signers([authorizedMinter])
      .rpc();

    const balance = await this.getTokenBalance(mint, this.payer.publicKey);
    assert.equal(balance.toString(), mintAmount.toString());

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });
    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.isNull(mintAuthorityAccount.maxTotal);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      mintAmount.toString(),
    );
  });

  it("successfully mints tokens up to exact limit", async function () {
    const maxTotal = new BN(1000);

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: maxTotal,
      })
      .signers([authorizedMinter])
      .rpc();

    const balance = await this.getTokenBalance(mint, this.payer.publicKey);
    assert.equal(balance.toString(), maxTotal.toString());

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });
    const mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      maxTotal.toString(),
    );
  });

  it("successfully mints multiple times accumulating total_minted", async function () {
    const maxTotal = new BN(1000);
    const firstMint = new BN(300);
    const secondMint = new BN(400);
    const thirdMint = new BN(200);

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: firstMint,
      })
      .signers([authorizedMinter])
      .rpc();

    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });
    let mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      firstMint.toString(),
    );

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: secondMint,
      })
      .signers([authorizedMinter])
      .rpc();

    mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      firstMint.add(secondMint).toString(),
    );

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: thirdMint,
      })
      .signers([authorizedMinter])
      .rpc();

    mintAuthorityAccount =
      await mintGovernorClient.fetchMintAuthority(mintAuthority);
    assert.equal(
      mintAuthorityAccount.totalMinted.toString(),
      firstMint.add(secondMint).add(thirdMint).toString(),
    );

    const balance = await this.getTokenBalance(mint, this.payer.publicKey);
    assert.equal(
      balance.toString(),
      firstMint.add(secondMint).add(thirdMint).toString(),
    );
  });

  it("fails when amount exceeds remaining quota", async function () {
    const maxTotal = new BN(1000);
    const firstMint = new BN(800);
    const secondMint = new BN(300); // Would exceed by 100

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: firstMint,
      })
      .signers([authorizedMinter])
      .rpc();

    const callbacks = expectError(
      "MintLimitExceeded",
      "Should have failed due to mint limit exceeded",
    );

    await mintGovernorClient
      .mintTokensIx({
        mintGovernor,
        mint,
        destinationAta,
        authorizedMinter: authorizedMinter.publicKey,
        amount: secondMint,
      })
      .signers([authorizedMinter])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when authorized_minter is not the signer", async function () {
    const maxTotal = new BN(1000);
    const fakeMinter = Keypair.generate();

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    // Get the mint_authority PDA that was created for the real authorizedMinter
    const [mintAuthority] = getMintAuthorityAddr({
      mintGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });

    const callbacks = expectError(
      "UnauthorizedMinter",
      "Should have failed due to unauthorized minter",
    );

    // Manually construct the instruction to pass fakeMinter as signer
    // but use the mint_authority created for the real authorizedMinter
    await mintGovernorClient.program.methods
      .mintTokens({ amount: new BN(500) })
      .accounts({
        mintGovernor,
        mintAuthority,
        mint,
        destinationAta,
        authorizedMinter: fakeMinter.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([fakeMinter])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when governor does not hold mint authority", async function () {
    // Create a governor without transferring mint authority
    const { mint: mintWithoutAuth, mintGovernor: governorWithoutAuth } =
      await createMintAndGovernor(
        this.banksClient,
        mintGovernorClient,
        this.payer,
      );

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor: governorWithoutAuth,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    const destAccount = await this.createTokenAccount(
      mintWithoutAuth,
      this.payer.publicKey,
    );

    try {
      await mintGovernorClient
        .mintTokensIx({
          mintGovernor: governorWithoutAuth,
          mint: mintWithoutAuth,
          destinationAta: destAccount,
          authorizedMinter: authorizedMinter.publicKey,
          amount: new BN(500),
        })
        .signers([authorizedMinter])
        .rpc();

      assert.fail(
        "Should have failed because governor does not hold mint authority",
      );
    } catch (e) {
      // The mint_to CPI will fail because the governor PDA is not the mint authority
      // Token program returns error code 0x4 ("owner does not match")
      assert.include(e.message, "custom program error: 0x4");
    }
  });

  it("fails when mint_authority.mint_governor does not match", async function () {
    // Create a second governor
    const { mintGovernor: otherGovernor } = await setupMintWithGovernor(
      this.banksClient,
      mintGovernorClient,
      this.payer,
    );

    // Add authority to the other governor
    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor: otherGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal: new BN(1000),
      })
      .rpc();

    // Try to mint using the first governor but with authority from the second
    const [wrongMintAuthority] = getMintAuthorityAddr({
      mintGovernor: otherGovernor,
      authorizedMinter: authorizedMinter.publicKey,
    });

    try {
      // Manually construct the instruction to pass the wrong mint_authority
      await mintGovernorClient.program.methods
        .mintTokens({ amount: new BN(500) })
        .accounts({
          mintGovernor,
          mintAuthority: wrongMintAuthority,
          mint,
          destinationAta,
          authorizedMinter: authorizedMinter.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .signers([authorizedMinter])
        .rpc();

      assert.fail(
        "Should have failed due to mint_authority.mint_governor mismatch",
      );
    } catch (e) {
      // Anchor's has_one constraint will check that mint_authority.mint_governor == mint_governor
      assert.include(e.message, "A has one constraint was violated");
    }
  });

  it("fails when destination token account has wrong mint", async function () {
    const maxTotal = new BN(1000);

    // Create a different mint
    const wrongMint = await createMintWithAuthority(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
    );

    // Create destination for the WRONG mint
    const wrongDestination = await this.createTokenAccount(
      wrongMint,
      this.payer.publicKey,
    );

    await mintGovernorClient
      .addMintAuthorityIx({
        mintGovernor,
        admin: this.payer.publicKey,
        authorizedMinter: authorizedMinter.publicKey,
        maxTotal,
      })
      .rpc();

    try {
      await mintGovernorClient.program.methods
        .mintTokens({ amount: new BN(500) })
        .accounts({
          mintGovernor,
          mintAuthority: getMintAuthorityAddr({
            mintGovernor,
            authorizedMinter: authorizedMinter.publicKey,
          })[0],
          mint,
          destinationAta: wrongDestination, // Wrong mint!
          authorizedMinter: authorizedMinter.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .signers([authorizedMinter])
        .rpc();

      assert.fail("Should have failed due to destination mint mismatch");
    } catch (e) {
      // Anchor's has_one constraint will check that destination_ata.mint == mint
      assert.include(e.message, "A has one constraint was violated");
    }
  });
}
