import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";

export default function suite() {
  let inboundTokenMint: PublicKey;
  let outboundTokenMint: PublicKey;
  let tokenConverterConfig: PublicKey;

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
  });

  it("should initialize token converter config", async function () {
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

    // Verify the config was created
    const configAccount = await anchor.workspace.TokenConverter.account.tokenConverterConfig.fetch(
      tokenConverterConfig
    );

    assert.equal(configAccount.authority.toString(), this.payer.publicKey.toString());
    assert.equal(configAccount.inboundTokenMint.toString(), inboundTokenMint.toString());
    assert.equal(configAccount.outboundTokenMint.toString(), outboundTokenMint.toString());
    assert.equal(configAccount.inboundTokenDecimals, 6);
    assert.equal(configAccount.outboundTokenDecimals, 9);
    assert.equal(configAccount.maxInboundTokenAmount.toString(), maxInboundTokenAmount.toString());
    assert.equal(configAccount.maxOutboundTokenAmount.toString(), maxOutboundTokenAmount.toString());
    assert.equal(configAccount.burnInboundToken, burnInboundToken);
  });
} 