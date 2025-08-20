import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AutocratClient, PriceMath } from "@metadaoproject/futarchy/v0.4";
import { BN } from "bn.js";
import { DEVNET_USDC } from "../consts.js";
import { unpackMint } from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  const autocratProgram = AutocratClient.createClient({ provider });
  const payer = provider.wallet["payer"];

  const metaMint = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta");
  
  // Initialize the DAO
  const tokenPriceUiAmount = 1.0; // Initial token price in USDC
  const minBaseFutarchicLiquidity = 5; // Lower minimum requirement (5 META)
  const minQuoteFutarchicLiquidity = 101; // Lower minimum requirement (5 USDC)
  const daoKeypair = Keypair.generate();

  let tokenDecimals = unpackMint(metaMint, await provider.connection.getAccountInfo(metaMint)).decimals;
  let scaledPrice = PriceMath.getAmmPrice(tokenPriceUiAmount, tokenDecimals, 6);

  const dao = await autocratProgram.initializeDaoIx(
    daoKeypair,
    metaMint,
    {
      twapStartDelaySlots: new BN(0),
      twapInitialObservation: scaledPrice,
      twapMaxObservationChangePerUpdate: scaledPrice.divn(50),
      minQuoteFutarchicLiquidity: new BN(minQuoteFutarchicLiquidity).mul(new BN(10).pow(new BN(6))),
      minBaseFutarchicLiquidity: new BN(minBaseFutarchicLiquidity).mul(new BN(10).pow(new BN(tokenDecimals))),
      passThresholdBps: 0,
      slotsPerProposal: new BN(9500),
    },
    DEVNET_USDC
  ).rpc();

  console.log("DAO created with address:", dao.toString());
  console.log("DAO keypair public key:", daoKeypair.publicKey.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
