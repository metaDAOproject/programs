import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, createAssociatedTokenAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export default function suite() {
  let inboundTokenMint: PublicKey;
  let outboundTokenMint: PublicKey;
  let tokenConverterConfig: PublicKey;
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

    // Derive token converter config PDA
    [tokenConverterConfig] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter_config"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
      ],
      anchor.workspace.TokenConverter.programId
    );

    // Derive token converter PDA
    [tokenConverter] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
      ],
      anchor.workspace.TokenConverter.programId
    );

    // Initialize token converter config first
    const maxInboundTokenAmount = new BN(1000000); // 1 token with 6 decimals
    const maxOutboundTokenAmount = new BN(1000000000); // 1 token with 9 decimals
    const burnInboundToken = false;

    await anchor.workspace.TokenConverter.methods
      .initializeTokenConverterConfig(
        maxInboundTokenAmount,
        maxOutboundTokenAmount,
        burnInboundToken
      )
      .accounts({
        tokenConverterConfig,
        inboundTokenMint,
        outboundTokenMint,
        authority: this.payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("should initialize token converter", async function () {
    await anchor.workspace.TokenConverter.methods
      .initializeTokenConverter()
      .accounts({
        tokenConverter,
        tokenConverterConfig,
        inboundTokenVault: await createAssociatedTokenAccount(
          this.banksClient,
          this.payer,
          inboundTokenMint,
          tokenConverter
        ),
        outboundTokenVault: await createAssociatedTokenAccount(
          this.banksClient,
          this.payer,
          outboundTokenMint,
          tokenConverter
        ),
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

    assert.equal(converterAccount.tokenConverterConfig.toString(), tokenConverterConfig.toString());
    assert.equal(converterAccount.seqNum, 0);
    assert.equal(converterAccount.inboundTokenAmount.toString(), "0");
    assert.equal(converterAccount.outboundTokenAmount.toString(), "0");
    assert.equal(converterAccount.maxInboundTokenAmount.toString(), "1000000");
    assert.equal(converterAccount.maxOutboundTokenAmount.toString(), "1000000000");
    assert.equal(converterAccount.burnInboundToken, false);
    assert.equal(converterAccount.inboundTokenDecimals, 6);
    assert.equal(converterAccount.outboundTokenDecimals, 9);
  });
} 