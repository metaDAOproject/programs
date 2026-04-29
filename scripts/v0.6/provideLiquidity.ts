import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { MAINNET_USDC, DEVNET_USDC } from "@metadaoproject/programs";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";

// The DAO address to provide liquidity to
const DAO = new PublicKey("DAO_ADDRESS_HERE");

// Initial liquidity amounts
const INITIAL_BASE_AMOUNT = 1000; // in tokens (will be multiplied by decimals)
const INITIAL_QUOTE_AMOUNT = 1000; // in USDC (6 decimals)

// ============================================

const provider = anchor.AnchorProvider.env();

const futarchy: FutarchyClient = FutarchyClient.createClient({ provider });

const isMainnet = provider.connection.rpcEndpoint.includes("mainnet");

export const provideLiquidity = async () => {
  const quoteMint = isMainnet ? MAINNET_USDC : DEVNET_USDC;

  // Fetch the DAO to get the base mint
  const dao = await futarchy.getDao(DAO);
  const baseMint = dao.baseMint;

  // Get base mint info for decimals
  const mintInfo = await token.getMint(provider.connection, baseMint);
  console.log(
    `Base mint: ${baseMint.toString()} (${mintInfo.decimals} decimals)`,
  );

  const baseAmount = new BN(INITIAL_BASE_AMOUNT * 10 ** mintInfo.decimals);
  const quoteAmount = new BN(INITIAL_QUOTE_AMOUNT * 10 ** 6);

  const derivedPrice = INITIAL_QUOTE_AMOUNT / INITIAL_BASE_AMOUNT;

  console.log("\n=== Liquidity Provision ===");
  console.log(`Network: ${isMainnet ? "mainnet" : "devnet"}`);
  console.log(`DAO: ${DAO.toString()}`);
  console.log(`Base Mint: ${baseMint.toString()}`);
  console.log(`Quote Mint: ${quoteMint.toString()}`);
  console.log(`Base Amount: ${INITIAL_BASE_AMOUNT} tokens`);
  console.log(`Quote Amount: ${INITIAL_QUOTE_AMOUNT} USDC`);
  console.log(`Implied Price: $${derivedPrice}`);
  console.log("===========================\n");

  console.log("Providing liquidity...");

  await futarchy
    .provideLiquidityIx({
      dao: DAO,
      baseMint,
      quoteMint,
      quoteAmount,
      maxBaseAmount: baseAmount,
    })
    .rpc();

  console.log("\n=== Liquidity Provided Successfully ===");
  console.log(`DAO: ${DAO.toString()}`);
  console.log(`Base Amount: ${INITIAL_BASE_AMOUNT} tokens`);
  console.log(`Quote Amount: ${INITIAL_QUOTE_AMOUNT} USDC`);
};

provideLiquidity().catch(console.error);
