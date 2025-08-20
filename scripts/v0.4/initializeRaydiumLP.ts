import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { DEVNET_USDC } from "../consts.js";
import { DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID, DEVNET_RAYDIUM_AUTHORITY, DEVNET_LOW_FEE_RAYDIUM_CONFIG, DEVNET_RAYDIUM_CREATE_POOL_FEE_RECEIVE } from "@metadaoproject/futarchy/v0.4";
import { BN } from "bn.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

// Import the Raydium IDL
import { IDL as RaydiumCpmmIdl } from "../../tests/fixtures/raydium_cpmm.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const main = async () => {
  // Token mints
  const metaMint = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta");
  const usdcMint = DEVNET_USDC;

  // Ensure token mints are in correct order (token0 < token1)
  const [token0Mint, token1Mint] = metaMint.toBuffer().compare(usdcMint.toBuffer()) < 0 
    ? [metaMint, usdcMint] 
    : [usdcMint, metaMint];

  const [token0Amount, token1Amount] = metaMint.toBuffer().compare(usdcMint.toBuffer()) < 0 
    ? [new BN(5 * 10**6), new BN(101 * 10**6)] 
    : [new BN(101 * 10**6), new BN(5 * 10**6)];

  // Create a random keypair for pool state (since it needs to be a signer)
  const poolStateKeypair = anchor.web3.Keypair.generate();

  // Derive LP mint PDA based on the random pool state
  const [lpMint] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_lp_mint"),
      poolStateKeypair.publicKey.toBuffer(),
    ],
    DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
  );

  // Derive token vaults based on the random pool state
  const [token0Vault] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      poolStateKeypair.publicKey.toBuffer(),
      token0Mint.toBuffer(),
    ],
    DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
  );

  const [token1Vault] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      poolStateKeypair.publicKey.toBuffer(),
      token1Mint.toBuffer(),
    ],
    DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
  );

  // Derive observation state PDA based on the random pool state
  const [observationState] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("observation"),
      poolStateKeypair.publicKey.toBuffer(),
    ],
    DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
  );

  // Get creator token accounts
  const creatorToken0 = await getAssociatedTokenAddress(token0Mint, payer.publicKey);
  const creatorToken1 = await getAssociatedTokenAddress(token1Mint, payer.publicKey);
  const creatorLpToken = await getAssociatedTokenAddress(lpMint, payer.publicKey);

  // Create Raydium program instance
  const raydiumProgram = new anchor.Program(
    RaydiumCpmmIdl,
    DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
    provider
  );

  // Create the initialize instruction using the program
  try {
    console.log("Sending pool creation transaction...");
    console.log("Pool address:", poolStateKeypair.publicKey.toString());
    console.log("LP mint:", lpMint.toString());
    console.log("Token 0 vault:", token0Vault.toString());
    console.log("Token 1 vault:", token1Vault.toString());
    
    const signature = await raydiumProgram.methods
      .initialize(token0Amount, token1Amount, new BN(0)) // open_time = 0 for immediate opening
      .accounts({
        creator: payer.publicKey,
        ammConfig: DEVNET_LOW_FEE_RAYDIUM_CONFIG,
        authority: DEVNET_RAYDIUM_AUTHORITY,
        poolState: poolStateKeypair.publicKey,
        lpMint: lpMint,
        creatorToken0: creatorToken0,
        creatorToken1: creatorToken1,
        creatorLpToken: creatorLpToken,
        token0Vault: token0Vault,
        token1Vault: token1Vault,
        createPoolFee: DEVNET_RAYDIUM_CREATE_POOL_FEE_RECEIVE,
        observationState: observationState,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        token0Program: anchor.utils.token.TOKEN_PROGRAM_ID,
        token1Program: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
        token0Mint: token0Mint,
        token1Mint: token1Mint,
      })
      .signers([payer, poolStateKeypair])
      .rpc();
    
    console.log("Pool created successfully! Transaction:", signature);
  } catch (error) {
    console.error("Error creating pool:", error);
  }
}

main();