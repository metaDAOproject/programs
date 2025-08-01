import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, createAssociatedTokenAccount, mintTo, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export default function suite() {
  let inboundTokenMint: PublicKey;
  let outboundTokenMint: PublicKey;
  let tokenConverterConfig: PublicKey;
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

    // Initialize token converter config
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
      .initializeTokenConverter()
      .accounts({
        tokenConverter,
        tokenConverterConfig,
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

    // Verify the vault has tokens
    const vaultBalance = await getAccount(this.banksClient, outboundTokenVault);
    console.log("Vault balance after funding:", vaultBalance.amount.toString());

    // Double-check that the vault account exists and has tokens
    const vaultAccountInfo = await getAccount(this.banksClient, outboundTokenVault);
    console.log("Vault account owner:", vaultAccountInfo.owner.toString());
    console.log("Vault account mint:", vaultAccountInfo.mint.toString());
    console.log("Vault account amount:", vaultAccountInfo.amount.toString());
  });

  it("should convert tokens successfully", async function () {
    const convertAmount = new BN(100000); // 0.1 token with 6 decimals

    // Get initial balances
    const initialUserInboundBalance = await getAccount(this.banksClient, userInboundTokenAccount);
    const initialUserOutboundBalance = await getAccount(this.banksClient, userOutboundTokenAccount);
    const initialVaultOutboundBalance = await getAccount(this.banksClient, outboundTokenVault);

    console.log("Initial balances:");
    console.log("User inbound balance:", initialUserInboundBalance.amount.toString());
    console.log("User outbound balance:", initialUserOutboundBalance.amount.toString());
    console.log("Vault outbound balance:", initialVaultOutboundBalance.amount.toString());

    await anchor.workspace.TokenConverter.methods
      .convert(convertAmount)
      .accounts({
        tokenConverter,
        tokenConverterConfig,
        authority: this.payer.publicKey,
        from: userInboundTokenAccount,
        to: userOutboundTokenAccount,
        inboundTokenVault,
        outboundTokenVault,
        inboundTokenMint,
        outboundTokenMint,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    // Get final balances
    const finalUserInboundBalance = await getAccount(this.banksClient, userInboundTokenAccount);
    const finalUserOutboundBalance = await getAccount(this.banksClient, userOutboundTokenAccount);
    const finalVaultOutboundBalance = await getAccount(this.banksClient, outboundTokenVault);

    // Verify the conversion worked
    // User should have lost the convert amount
    const expectedUserInboundLoss = initialUserInboundBalance.amount - BigInt(convertAmount.toNumber());
    assert.equal(
      finalUserInboundBalance.amount.toString(),
      expectedUserInboundLoss.toString()
    );

    // User should have gained the converted amount (calculated based on conversion ratio)
    const expectedOutboundAmount = convertAmount.toNumber() * 1000; // 1:1000 ratio
    const expectedUserOutboundGain = initialUserOutboundBalance.amount + BigInt(expectedOutboundAmount);
    assert.equal(
      finalUserOutboundBalance.amount.toString(),
      expectedUserOutboundGain.toString()
    );

    // Vault should have lost the converted amount
    const expectedVaultLoss = initialVaultOutboundBalance.amount - BigInt(expectedOutboundAmount);
    assert.equal(
      finalVaultOutboundBalance.amount.toString(),
      expectedVaultLoss.toString()
    );
  });
} 