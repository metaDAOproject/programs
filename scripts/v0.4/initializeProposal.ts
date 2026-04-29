import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  AutocratIDL,
} from "@metadaoproject/programs/autocrat/v0.4";
import { PriceMath } from "@metadaoproject/programs";
import { AUTOCRAT_V0_4_PROGRAM_ID } from "@metadaoproject/programs";

async function main() {
  // Initialize clients
  const provider = anchor.AnchorProvider.env();
  const payer = provider.wallet["payer"];
  const autocratProgram = AutocratClient.createClient({ provider });

  // Use the existing DAO address
  const dao = new PublicKey("Hv7b7Kw2Xy7fGZZ8qWiciwfivay2hARmY7qC9HH4qWuS");

  // Get the DAO's data
  const storedDao = await autocratProgram.getDao(dao);
  console.log("DAO Token Mint:", storedDao.tokenMint.toString());
  console.log("DAO USDC Mint:", storedDao.usdcMint.toString());

  // Create or get token accounts for the payer
  const metaAccount = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    storedDao.tokenMint,
    payer.publicKey,
  );
  console.log("META account:", metaAccount.address.toString());

  const usdcAccount = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    storedDao.usdcMint,
    payer.publicKey,
  );
  console.log("USDC account:", usdcAccount.address.toString());

  // Check balances
  const metaBalance = metaAccount.amount;
  const usdcBalance = usdcAccount.amount;
  console.log("Current META balance:", metaBalance.toString());
  console.log("Current USDC balance:", usdcBalance.toString());

  // Ensure we have enough tokens for the proposal
  const requiredMeta = PriceMath.getChainAmount(10, 9); // 10 META for more liquidity
  const requiredUsdc = PriceMath.getChainAmount(10000, 6); // 10000 USDC for more liquidity

  if (
    metaBalance < BigInt(requiredMeta.toString()) ||
    usdcBalance < BigInt(requiredUsdc.toString())
  ) {
    console.log("Insufficient balance for proposal creation");
    console.log("Required META:", requiredMeta.toString());
    console.log("Required USDC:", requiredUsdc.toString());
    return;
  }

  const autocrat = new anchor.Program(
    AutocratIDL,
    AUTOCRAT_V0_4_PROGRAM_ID,
    provider,
  );

  const accounts = [
    {
      pubkey: dao,
      isSigner: true,
      isWritable: true,
    },
  ];

  const data = autocrat.coder.instruction.encode("update_dao", {
    daoParams: {
      passThresholdBps: 500,
      baseBurnLamports: null,
      burnDecayPerSlotLamports: null,
      slotsPerProposal: null,
      marketTakerFee: null,
    },
  });

  const ix = {
    programId: autocratProgram.getProgramId(),
    accounts,
    data,
  };

  // Initialize the proposal
  const proposal = await autocratProgram.initializeProposal(
    dao,
    "https://example.com/proposal", // proposal description URL
    ix,
    PriceMath.getChainAmount(10, 9), // 10 META for more liquidity
    PriceMath.getChainAmount(10000, 6), // 10000 USDC for more liquidity
  );

  console.log("Proposal created with address:", proposal.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
