import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenConverter } from "../target/types/token_converter.js";
import { PublicKey } from "@solana/web3.js";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenConverter as Program<TokenConverter>;

  const CONVERTER_PDA = new PublicKey("BL98zdKkEkBXKT9nwSnpUQbUFQE1LcJxazyujM8ojDLd");

  try {
    const converterAccount = await program.account.tokenConverter.fetch(CONVERTER_PDA);
    
    console.log("Token Converter Details:");
    console.log("- PDA Address:", CONVERTER_PDA.toString());
    console.log("- Authority:", converterAccount.authority.toString());
    console.log("- Inbound Mint:", converterAccount.inboundTokenMint.toString());
    console.log("- Outbound Mint:", converterAccount.outboundTokenMint.toString());
    console.log("- Conversion Ratio:", converterAccount.conversionRatio.toNumber() / 1e12);
    console.log("- Nonce:", converterAccount.nonce.toString());
    console.log("- Inbound Vault:", converterAccount.inboundTokenVault.toString());
    console.log("- Outbound Vault:", converterAccount.outboundTokenVault.toString());
    
    console.log("\n📋 Use these values in your convertTokens.ts script:");
    console.log(`const NONCE = new BN("${converterAccount.nonce.toString()}");`);
    console.log(`const CONVERTER_AUTHORITY = new PublicKey("${converterAccount.authority.toString()}");`);
  } catch (error) {
    console.error("Error fetching converter:", error);
  }
}

main().catch(console.error);