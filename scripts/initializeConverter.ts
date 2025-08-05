import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TokenConverter } from "../target/types/token_converter.js";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from "@solana/spl-token";
import BN from "bn.js";

// Constants
const CONVERSION_RATIO_SCALE = new BN(1_000_000_000_000); // 1e12

async function main() {
  // Configure the client
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TokenConverter as Program<TokenConverter>;
  const wallet = provider.wallet as anchor.Wallet;

  // Configuration
  const INBOUND_MINT = new PublicKey("HdABxaTrV276SM8F9tud1fnEmyigeHHkttwbKHekMYNx");
  const OUTBOUND_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
  const CONVERSION_RATIO = 2; // 2:1 ratio (2 outbound tokens per 1 inbound token)
  const NONCE = new BN(Date.now()); 

  const scaledConversionRatio = new BN(CONVERSION_RATIO).mul(CONVERSION_RATIO_SCALE);

  const [tokenConverterPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("token_converter"),
      INBOUND_MINT.toBuffer(),
      OUTBOUND_MINT.toBuffer(),
      wallet.publicKey.toBuffer(),
      NONCE.toArrayLike(Buffer, "le", 8)
    ],
    program.programId
  );

  console.log("Token Converter PDA:", tokenConverterPda.toString());

  // Get vault addresses
  const inboundVault = await getAssociatedTokenAddress(
    INBOUND_MINT,
    tokenConverterPda,
    true
  );

  const outboundVault = await getAssociatedTokenAddress(
    OUTBOUND_MINT,
    tokenConverterPda,
    true
  );

  try {
    const tx = await program.methods
      .initializeTokenConverter(
        scaledConversionRatio,
        NONCE
      )
      .accounts({
        tokenConverter: tokenConverterPda,
        inboundTokenVault: inboundVault,
        outboundTokenVault: outboundVault,
        inboundTokenMint: INBOUND_MINT,
        outboundTokenMint: OUTBOUND_MINT,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Token Converter initialized successfully!");
    console.log("Transaction signature:", tx);
    console.log("\nConverter Details:");
    console.log("- Inbound Token:", INBOUND_MINT.toString());
    console.log("- Outbound Token:", OUTBOUND_MINT.toString());
    console.log("- Conversion Ratio:", CONVERSION_RATIO, ":1");
    console.log("- Authority:", wallet.publicKey.toString());
    console.log("- Nonce:", NONCE.toString());

    // Fetch and display the created account
    const converterAccount = await program.account.tokenConverter.fetch(tokenConverterPda);
    console.log("\nOn-chain data:", converterAccount);

  } catch (error) {
    console.error("Error initializing token converter:", error);
    if (error.logs) {
      console.error("Program logs:", error.logs);
    }
  }
}

main().catch(console.error);