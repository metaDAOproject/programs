import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, createAssociatedTokenAccount, mintTo, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { expectError } from "../../utils.js";

export default function suite() {
  let inboundTokenMint: PublicKey;
  let outboundTokenMint: PublicKey;
  let tokenConverter: PublicKey;
  let inboundTokenVault: PublicKey;
  let outboundTokenVault: PublicKey;
  let userInboundTokenAccount: PublicKey;
  let userOutboundTokenAccount: PublicKey;

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

    // Derive token converter PDA
    const nonce = new BN(1754430104587);
    [tokenConverter] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
        this.payer.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8),
      ],
      anchor.workspace.TokenConverter.programId
    );

    // Create user token accounts
    userInboundTokenAccount = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      inboundTokenMint,
      this.payer.publicKey
    );

    userOutboundTokenAccount = await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      outboundTokenMint,
      this.payer.publicKey
    );

    // Initialize token converter
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

    await anchor.workspace.TokenConverter.methods
      .initializeTokenConverter(new BN(1000000000000), nonce) // 1:1 conversion ratio (CONVERSION_RATIO_SCALE)
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

    // Mint some tokens to user
    await mintTo(
      this.banksClient,
      this.payer,
      inboundTokenMint,
      userInboundTokenAccount,
      this.payer,
      1000000 // 1 token with 6 decimals
    );

    // Mint outbound tokens to the converter's vault
    await mintTo(
      this.banksClient,
      this.payer,
      outboundTokenMint,
      outboundTokenVault,
      this.payer,
      1000000000 // 1 token with 9 decimals
    );
  });

  it("should fail to convert with insufficient balance", async function () {
    const largeAmount = new BN(10000000); // 10 tokens, more than user has

    const callbacks = expectError(
      "InsufficientBalance",
      "convert succeeded despite insufficient balance"
    );

    await anchor.workspace.TokenConverter.methods
      .convert(largeAmount)
      .accounts({
        tokenConverter,
        authority: this.payer.publicKey,
        from: userInboundTokenAccount,
        to: userOutboundTokenAccount,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail to convert with zero amount", async function () {
    const callbacks = expectError(
      "InvalidAmount",
      "convert succeeded despite zero amount"
    );

    await anchor.workspace.TokenConverter.methods
      .convert(new BN(0))
      .accounts({
        tokenConverter,
        authority: this.payer.publicKey,
        from: userInboundTokenAccount,
        to: userOutboundTokenAccount,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("should fail to convert with insufficient converter balance", async function () {
    // First, mint more tokens to the user so they have enough for the conversion
    await mintTo(
      this.banksClient,
      this.payer,
      inboundTokenMint,
      userInboundTokenAccount,
      this.payer,
      10000000000 // 10 tokens with 6 decimals
    );

    // Try to convert more than the converter has
    const largeAmount = new BN(10000000000); // 10 tokens, more than converter has

    const callbacks = expectError(
      "InsufficientConverterBalance",
      "convert succeeded despite insufficient converter balance"
    );

    await anchor.workspace.TokenConverter.methods
      .convert(largeAmount)
      .accounts({
        tokenConverter,
        authority: this.payer.publicKey,
        from: userInboundTokenAccount,
        to: userOutboundTokenAccount,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
} 