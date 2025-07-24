import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AutocratClient } from "@metadaoproject/futarchy/v0.4";
import * as token from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  const autocratProgram = AutocratClient.createClient({ provider });
  const payer = provider.wallet["payer"];

  // Create META token mint
  const metaMint = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    9 // 9 decimals like in tests
  );
  console.log("Created META mint:", metaMint.toString());

  // Create USDC mint
  const usdcMint = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6 // 6 decimals for USDC
  );
  console.log("Created USDC mint:", usdcMint.toString());

  // Create token accounts for the payer
  const metaAccount = await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    metaMint,
    payer.publicKey
  );
  console.log("Created META account:", metaAccount.toString());

  const usdcAccount = await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    usdcMint,
    payer.publicKey
  );
  console.log("Created USDC account:", usdcAccount.toString());

  // Mint initial tokens to the payer
  await token.mintTo(
    provider.connection,
    payer,
    metaMint,
    metaAccount,
    payer,
    1000n * 1_000_000_000n // 1000 META with 9 decimals
  );
  console.log("Minted 1000 META to payer");

  await token.mintTo(
    provider.connection,
    payer,
    usdcMint,
    usdcAccount,
    payer,
    200_000n * 1_000_000n // 200,000 USDC with 6 decimals (like in tests)
  );
  console.log("Minted 200,000 USDC to payer");

  // Initialize the DAO
  const tokenPriceUiAmount = 1.0; // Initial token price in USDC
  const minBaseFutarchicLiquidity = 5; // Lower minimum requirement (5 META)
  const minQuoteFutarchicLiquidity = 5; // Lower minimum requirement (5 USDC)
  const daoKeypair = Keypair.generate();

  const dao = await autocratProgram.initializeDao(
    metaMint,
    tokenPriceUiAmount,
    minBaseFutarchicLiquidity,
    minQuoteFutarchicLiquidity,
    usdcMint,
    daoKeypair
  );

  console.log("DAO created with address:", dao.toString());
  console.log("DAO keypair public key:", daoKeypair.publicKey.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
