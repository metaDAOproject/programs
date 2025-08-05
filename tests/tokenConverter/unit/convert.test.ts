import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, createAssociatedTokenAccount, mintTo, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

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
      6 // 6 decimals
    );

    // Derive PDA for token converter
    const nonce = new BN(1754430104587);
    const [tokenConverterPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_converter"),
        inboundTokenMint.toBuffer(),
        outboundTokenMint.toBuffer(),
        this.payer.publicKey.toBuffer(),
        nonce.toArrayLike(Buffer, "le", 8)
      ],
      anchor.workspace.TokenConverter.programId
    );
    tokenConverter = tokenConverterPda;

    // Initialize token converter first
    await anchor.workspace.TokenConverter.methods
      .initializeTokenConverter(
        new BN(1000000000000), // conversion ratio (1:1 scaled by 1e12)
        nonce
      )
      .accounts({
        tokenConverter,
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

    // Get the vault addresses from the initialized token converter
    const tokenConverterAccount = await anchor.workspace.TokenConverter.account.tokenConverter.fetch(tokenConverter);
    inboundTokenVault = tokenConverterAccount.inboundTokenVault;
    outboundTokenVault = tokenConverterAccount.outboundTokenVault;

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

    // Mint some tokens to the user
    await mintTo(
      this.banksClient,
      this.payer,
      inboundTokenMint,
      userInboundTokenAccount,
      this.payer,
      1000000000 // 1000 tokens with 6 decimals
    );

    // Mint some tokens to the vault
    await mintTo(
      this.banksClient,
      this.payer,
      outboundTokenMint,
      outboundTokenVault,
      this.payer,
      1000000000 // 1000 tokens with 6 decimals
    );
  });

  it("should convert tokens successfully", async function () {
    const convertAmount = new BN(100000000); // 100 tokens with 6 decimals

    // Get initial balances
    const initialInboundBalance = new BN((await getAccount(this.banksClient, userInboundTokenAccount)).amount);
    const initialOutboundBalance = new BN((await getAccount(this.banksClient, userOutboundTokenAccount)).amount);
    const initialVaultInboundBalance = new BN((await getAccount(this.banksClient, inboundTokenVault)).amount);
    const initialVaultOutboundBalance = new BN((await getAccount(this.banksClient, outboundTokenVault)).amount);

    // Perform conversion
    await anchor.workspace.TokenConverter.methods
      .convert(convertAmount)
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
      .rpc();

    // Get final balances
    const finalInboundBalance = new BN((await getAccount(this.banksClient, userInboundTokenAccount)).amount);
    const finalOutboundBalance = new BN((await getAccount(this.banksClient, userOutboundTokenAccount)).amount);
    const finalVaultInboundBalance = new BN((await getAccount(this.banksClient, inboundTokenVault)).amount);
    const finalVaultOutboundBalance = new BN((await getAccount(this.banksClient, outboundTokenVault)).amount);

    // Verify the conversion worked correctly
    assert.equal(
      finalInboundBalance.toString(),
      initialInboundBalance.sub(convertAmount).toString(),
      "User's inbound balance should be reduced by the converted amount"
    );

    assert.equal(
      finalOutboundBalance.toString(),
      initialOutboundBalance.add(convertAmount).toString(),
      "User's outbound balance should be increased by the converted amount"
    );

    assert.equal(
      finalVaultInboundBalance.toString(),
      initialVaultInboundBalance.add(convertAmount).toString(),
      "Vault's inbound balance should be increased by the converted amount"
    );

    assert.equal(
      finalVaultOutboundBalance.toString(),
      initialVaultOutboundBalance.sub(convertAmount).toString(),
      "Vault's outbound balance should be reduced by the converted amount"
    );
  });
} 