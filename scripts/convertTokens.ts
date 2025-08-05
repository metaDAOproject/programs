import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenConverter } from "../target/types/token_converter.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import BN from "bn.js";

async function main() {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenConverter as Program<TokenConverter>;
  const wallet = provider.wallet as anchor.Wallet;

  // Configuration - MUST MATCH YOUR INITIALIZATION VALUES
  const INBOUND_MINT = new PublicKey("HdABxaTrV276SM8F9tud1fnEmyigeHHkttwbKHekMYNx");
  const OUTBOUND_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
  const CONVERTER_AUTHORITY = wallet.publicKey; // The authority from initialization
  const NONCE = new BN("1754430104587"); 
  const AMOUNT_TO_CONVERT = new BN(1_000_000); // 1 token with 6 decimals

  // Derive PDA for token converter
  const [tokenConverterPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("token_converter"),
      INBOUND_MINT.toBuffer(),
      OUTBOUND_MINT.toBuffer(),
      CONVERTER_AUTHORITY.toBuffer(),
      NONCE.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );

  console.log("Token Converter PDA:", tokenConverterPda.toString());

  // Get user token accounts
  const userInboundAta = getAssociatedTokenAddressSync(
    INBOUND_MINT,
    wallet.publicKey,
    true
  );

  const userOutboundAta = getAssociatedTokenAddressSync(
    OUTBOUND_MINT,
    wallet.publicKey,
    true
  );

  // Get vault addresses
  const inboundVault = getAssociatedTokenAddressSync(
    INBOUND_MINT,
    tokenConverterPda,
    true
  );

  const outboundVault = getAssociatedTokenAddressSync(
    OUTBOUND_MINT,
    tokenConverterPda,
    true
  );

  console.log("\n📍 Vault Addresses:");
  console.log("- Inbound Token Vault:", inboundVault.toString());
  console.log("  (Receives inbound tokens from users during conversion)");
  console.log("- Outbound Token Vault:", outboundVault.toString());
  console.log("  (NEEDS LIQUIDITY: Send outbound tokens here before converting)");
  
  try {
    // Fetch converter details to show conversion info
    const converterAccount = await program.account.tokenConverter.fetch(tokenConverterPda);
    const conversionRatio = converterAccount.conversionRatio.toNumber() / 1e12;
    const expectedOutput = AMOUNT_TO_CONVERT.toNumber() * conversionRatio;

    console.log("🔄 Converting tokens...");
    console.log("- Amount to convert:", AMOUNT_TO_CONVERT.toNumber() / 1e6, "tokens");
    console.log("- Conversion ratio:", conversionRatio);
    console.log("- Expected output:", expectedOutput / 1e6, "tokens");

    // Check user balances before
    let userInboundBefore, userOutboundBefore;
    try {
      const inboundAccount = await getAccount(provider.connection, userInboundAta);
      userInboundBefore = inboundAccount.amount;
      console.log("\nInbound token balance:", Number(userInboundBefore) / 1e6, "tokens");
    } catch (e) {
      console.log("\nNo inbound token account found. You need some inbound tokens first!");
      return;
    }

    try {
      const outboundAccount = await getAccount(provider.connection, userOutboundAta);
      userOutboundBefore = outboundAccount.amount;
      console.log("Outbound token balance:", Number(userOutboundBefore) / 1e6, "tokens");
    } catch (e) {
      console.log("Outbound token account will be created");
      userOutboundBefore = BigInt(0);
    }

    // Check both vault balances
    try {
      const vaultAccount = await getAccount(provider.connection, outboundVault);
      console.log("Outbound vault balance:", Number(vaultAccount.amount) / 1e6, "tokens");
      if (vaultAccount.amount < BigInt(expectedOutput)) {
        console.error("\n❌ Insufficient liquidity in OUTBOUND vault!");
        console.error(`   Vault needs at least ${expectedOutput / 1e6} tokens to complete this conversion`);
        console.error(`   Send ${OUTBOUND_MINT.toString()} tokens to:`);
        console.error(`   ${outboundVault.toString()}`);
        return;
      }
    } catch (e) {
      console.error("\n❌ OUTBOUND vault not initialized or has no tokens!");
      console.error(`   Send ${OUTBOUND_MINT.toString()} tokens to:`);
      console.error(`   ${outboundVault.toString()}`);
      return;
    }

    // Execute conversion
    const tx = await program.methods
      .convert(AMOUNT_TO_CONVERT)
      .accounts({
        tokenConverter: tokenConverterPda,
        authority: wallet.publicKey,
        from: userInboundAta,
        to: userOutboundAta,
        inboundTokenVault: inboundVault,
        outboundTokenVault: outboundVault,
        inboundTokenMint: INBOUND_MINT,
        outboundTokenMint: OUTBOUND_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("\n✅ Tokens converted successfully!");
    console.log("Transaction signature:", tx);

    // Wait for confirmation
    await provider.connection.confirmTransaction(tx, "confirmed");

    // Check balances after
    const userInboundAfter = await getAccount(provider.connection, userInboundAta);
    const userOutboundAfter = await getAccount(provider.connection, userOutboundAta);

    console.log("\nFinal balances:");
    console.log("- Inbound tokens:", Number(userInboundAfter.amount) / 1e6);
    console.log("- Outbound tokens:", Number(userOutboundAfter.amount) / 1e6);
    
    console.log("\nTokens transferred:");
    console.log("- Sent:", Number(userInboundBefore - userInboundAfter.amount) / 1e6, "inbound tokens");
    console.log("- Received:", Number(userOutboundAfter.amount - userOutboundBefore) / 1e6, "outbound tokens");

  } catch (error) {
    console.error("Error converting tokens:", error);
    
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
  }
}

main().catch(console.error);