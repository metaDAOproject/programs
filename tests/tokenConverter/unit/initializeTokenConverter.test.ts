import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, createAssociatedTokenAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export default function suite() {
  let inboundTokenMint: PublicKey;
  let outboundTokenMint: PublicKey;
  let tokenConverter: PublicKey;
  let inboundTokenVault: PublicKey;
  let outboundTokenVault: PublicKey;

  before(async function () {
    // Create token mints
    inboundTokenMint = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      6 // 6 decimals
    );

    outboundTokenMint = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      9 // 9 decimals
    );

    const nonce = new BN(1754430104587);

    // Derive token converter PDA
    [tokenConverter] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
        this.payer.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8)
      ],
      anchor.workspace.TokenConverter.programId
    );

    // Create associated token accounts for the token converter
    inboundTokenVault = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      inboundTokenMint,
      tokenConverter
    );

    outboundTokenVault = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      outboundTokenMint,
      tokenConverter
    );
  });

  it("should initialize token converter", async function () {
    const nonce = new BN(1754430104587);
    
    await anchor.workspace.TokenConverter.methods
      .initializeTokenConverter(
        new BN(1000000), // 1000000 * 1e12 = 1 META
        nonce,
      )
      .accounts({
        tokenConverter,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        authority: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .rpc();

    // Verify the token converter was created
    const converterAccount = await anchor.workspace.TokenConverter.account.tokenConverter.fetch(
      tokenConverter
    );

    assert.equal(converterAccount.authority.toString(), this.payer.publicKey.toString());
    assert.equal(converterAccount.inboundTokenMint.toString(), inboundTokenMint.toString());
    assert.equal(converterAccount.outboundTokenMint.toString(), outboundTokenMint.toString());
    assert.equal(converterAccount.inboundTokenVault.toString(), inboundTokenVault.toString());
    assert.equal(converterAccount.outboundTokenVault.toString(), outboundTokenVault.toString());
    assert.equal(converterAccount.inboundTokenDecimals, 6);
    assert.equal(converterAccount.outboundTokenDecimals, 9);
    assert.equal(converterAccount.conversionRatio.toString(), "1000000");
    assert.equal(converterAccount.nonce.toString(), nonce.toString());
  });
} 