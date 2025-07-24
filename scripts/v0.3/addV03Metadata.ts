import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ConditionalVaultClient,
} from "@metadaoproject/futarchy/v0.3";
import { BN } from "bn.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const autocrat: AutocratClient = AutocratClient.createClient({ provider });
const vaultProgram: ConditionalVaultClient =
  ConditionalVaultClient.createClient({ provider });

const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const ORE = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");

const PROPOSAL = new PublicKey("A19yLRVqxvUf4cTDm6mKNKadasd7YSYDrzk6AYEyubAC");

async function main() {
  const proposal = await autocrat.getProposal(PROPOSAL);
  const baseVault: PublicKey = proposal.baseVault;
  const quoteVault: PublicKey = proposal.quoteVault;

  console.log(baseVault.toBase58());
  console.log(quoteVault.toBase58());

  const baseVaultInfo = await vaultProgram.getVault(baseVault);
  const quoteVaultInfo = await vaultProgram.getVault(quoteVault);

  console.log(baseVaultInfo);
  console.log(quoteVaultInfo);

  // await vaultProgram
  //     .addMetadataToConditionalTokensIx(baseVault, ORE, 1, "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/ORE/pORE.json", "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/ORE/fORE.json")
  //     .rpc();

  await vaultProgram
    .addMetadataToConditionalTokensIx(
      quoteVault,
      USDC,
      1,
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/pUSDC.json",
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/fUSDC.json"
    )
    .rpc();

  // console.log(vaultProgram.vaultProgram.programId.toBase58());
}

main();
