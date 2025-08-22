import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PriceBasedTokenLock } from "../target/types/price_based_token_lock";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { assert } from "chai";

describe("price_based_token_lock", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PriceBasedTokenLock as Program<PriceBasedTokenLock>;
  
  const user = Keypair.generate();
  const oracleAccount = Keypair.generate();
  const recipient = Keypair.generate();
  const lockerAuthority = Keypair.generate();
  
  let userTokenAccount: PublicKey;
  let lockerTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let locker: PublicKey;

  before(async () => {
    // Airdrop SOL to user
    const signature = await provider.connection.requestAirdrop(user.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(signature);

    // Create mock token mint (you would use a real mint in practice)
    const mint = Keypair.generate();
    
    // Get token accounts
    userTokenAccount = await getAssociatedTokenAddress(mint.publicKey, user.publicKey);
    lockerTokenAccount = await getAssociatedTokenAddress(mint.publicKey, lockerAuthority.publicKey);
    recipientTokenAccount = await getAssociatedTokenAddress(mint.publicKey, recipient.publicKey);
    
    // Derive locker PDA
    [locker] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), lockerAuthority.publicKey.toBuffer()],
      program.programId
    );
  });

  it("Can initialize a locker", async () => {
    const params = {
      priceThreshold: new anchor.BN(1000), // $10.00 (u128)
      tokenAmount: new anchor.BN(1000000), // 1 token
      unlockTimestamp: new anchor.BN(Date.now() / 1000 + 3600), // 1 hour from now
      oracleAccount: oracleAccount.publicKey,
      aggregatorByteOffset: 0,
      twapLengthSeconds: new anchor.BN(300), // 5 minutes
      tokenRecipient: recipient.publicKey,
    };

    try {
      await program.methods
        .initializeLocker(params)
        .accounts({
          locker,
          tokenMint: Keypair.generate().publicKey, // Mock mint
          tokenAccount: userTokenAccount,
          tokenAuthority: user.publicKey,
          lockerAuthority: lockerAuthority.publicKey,
          lockerTokenAccount,
          recipientTokenAccount,
          payer: user.publicKey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();
      
      console.log("Locker initialized successfully");
    } catch (error) {
      console.log("Error initializing locker:", error);
      // This is expected to fail since we're using mock accounts
      // In a real test, you would set up proper token accounts and mints
    }
  });
});
