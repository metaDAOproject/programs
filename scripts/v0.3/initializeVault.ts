import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import {
  ConditionalVaultClient,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "@metadaoproject/futarchy/v0.3";

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4nCk4qKJSJf8pzJadMnr9LubA6Y7Zw3EacsVqH1TwVXH"
);

console.log("hello, world");
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const vaultProgram = ConditionalVaultClient.createClient({ provider });

async function main() {
  //console.log(vaultProgram);
  console.log(provider.wallet.publicKey);
  const settlementAuthority = provider.wallet.publicKey;

  const payer = provider.wallet["payer"];

  const underlyingTokenMint = await token.createMint(
    provider.connection,
    payer,
    settlementAuthority,
    settlementAuthority,
    8
  );

  const nonce = new BN(1337);

  const [vault] = getVaultAddr(
    vaultProgram.vaultProgram.programId,
    settlementAuthority,
    underlyingTokenMint
  );

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );

  const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
    vaultProgram.vaultProgram.programId,
    vault
  );

  const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
    vaultProgram.vaultProgram.programId,
    vault
  );

  await vaultProgram.vaultProgram.methods
    .initializeConditionalVault({ settlementAuthority })
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalOnFinalizeTokenMint,
      conditionalOnRevertTokenMint,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  const storedVault = await vaultProgram.getVault(vault);
  console.log(storedVault);

  //await vaultProgram.methods.initializeConditionalVault
}

main();

//vaultProgram.methods.initializeVault