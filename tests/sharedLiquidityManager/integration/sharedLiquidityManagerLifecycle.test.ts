import {
  AmmClient,
  AutocratClient,
  getAmmAddr,
  getAmmLpMintAddr,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getRaydiumCpmmObservationStateAddr,
  getRaydiumCpmmPoolVaultAddr,
  LOW_FEE_RAYDIUM_CONFIG,
  RAYDIUM_AUTHORITY,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
} from "@metadaoproject/futarchy/v0.4";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError, toBN } from "../../utils.js";
import { BN } from "bn.js";
import { IDL } from "../../fixtures/raydium_cpmm.js";

export default async function () {
  let ammClient: AmmClient;
  let autocratClient: AutocratClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  let cpSwap = new anchor.Program(IDL, new PublicKey(RAYDIUM_CP_SWAP_PROGRAM_ID));

  ammClient = this.ammClient;
  autocratClient = this.autocratClient;

  META = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    9
  );
  USDC = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    6
  );


  await this.createTokenAccount(META, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

  // First, set up a DAO

  let dao = await autocratClient.initializeDao(META, 1000, 10, 10_000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));
  console.log("DAO", dao.toBase58());

  // Second, set up a Raydium spot pool

  const poolStateKp = Keypair.generate();

  const [lpMint] = getRaydiumCpmmLpMintAddr(poolStateKp.publicKey, false);

  // Determine which token should be token0 (smaller address)
  const [token0Mint, token1Mint] = META.toBase58() < USDC.toBase58() 
    ? [META, USDC] 
    : [USDC, META];

  const [amount0, amount1] = META.toBase58() < USDC.toBase58()
    ? [new BN(10 * 10 ** 9), new BN(1000 * 10 ** 6)]  // META is token0
    : [new BN(1000 * 10 ** 6), new BN(10 * 10 ** 9)]; // USDC is token0

  // Proph3t: I changed the RaydiumCpmm type to have poolState to be a signer so
  // anchor doesn't complain about passing poolStateKp as a signer
  await cpSwap.methods.initialize(amount0, amount1, new BN(0)).accounts({
    creator: this.payer.publicKey,
    ammConfig: LOW_FEE_RAYDIUM_CONFIG,
    authority: RAYDIUM_AUTHORITY,
    createPoolFee: RAYDIUM_CREATE_POOL_FEE_RECEIVE,
    token0Mint,
    token1Mint,
    poolState: poolStateKp.publicKey,
    token0Vault: getRaydiumCpmmPoolVaultAddr(poolStateKp.publicKey, token0Mint, false)[0],
    token1Vault: getRaydiumCpmmPoolVaultAddr(poolStateKp.publicKey, token1Mint, false)[0],
    lpMint,
    creatorToken0: token.getAssociatedTokenAddressSync(token0Mint, this.payer.publicKey),
    creatorToken1: token.getAssociatedTokenAddressSync(token1Mint, this.payer.publicKey),
    creatorLpToken: token.getAssociatedTokenAddressSync(lpMint, this.payer.publicKey),
    observationState: getRaydiumCpmmObservationStateAddr(poolStateKp.publicKey, false)[0],
    token0Program: token.TOKEN_PROGRAM_ID,
    token1Program: token.TOKEN_PROGRAM_ID
  }).signers([poolStateKp]).rpc({ skipPreflight: true });

  // Third, initialize a SharedLiquidityManager for the DAO / Raydium spot pool

  // Fourth, have the DAO provide liquidity to the pool

  // Fifth, have a proposer come along and create a proposal through the SharedLiquidityManager

  // Sixth, someone bids in pass market

  // Seventh, proposal is finalized and passes

  // Eighth, we merge liquidity back into main pool. Check that k has increased

}
