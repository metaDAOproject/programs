import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ConditionalVaultClient,
} from "@metadaoproject/futarchy/v0.4";

const provider = anchor.AnchorProvider.env();
const autocrat: AutocratClient = AutocratClient.createClient({ provider });
const vaultProgram: ConditionalVaultClient =
  ConditionalVaultClient.createClient({ provider });

const PROPOSAL = new PublicKey("3kfEHobCtMn4rDCXmo2H735xX6oEacVN1DBuL41wj7az");
const baseSymbol = "FAF";

async function main() {
  const proposal = await autocrat.getProposal(PROPOSAL);
  const baseVault: PublicKey = proposal.baseVault;
  const quoteVault: PublicKey = proposal.quoteVault;

  const quoteFail = await vaultProgram
    .addMetadataToConditionalTokensIx(
      quoteVault,
      0,
      "Fail USDC",
      "fUSDC",
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/fUSDC.json",
    )
    .transaction();

  const quotePass = await vaultProgram
    .addMetadataToConditionalTokensIx(
      quoteVault,
      1,
      "Pass USDC",
      "pUSDC",
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/pUSDC.json",
    )
    .transaction();

  const baseFail = await vaultProgram
    .addMetadataToConditionalTokensIx(
      baseVault,
      0,
      `Fail ${baseSymbol}`,
      `f${baseSymbol}`,
      `https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/${baseSymbol}/f${baseSymbol}.json`,
    )
    .transaction();

  const basePass = await vaultProgram
    .addMetadataToConditionalTokensIx(
      baseVault,
      1,
      `Pass ${baseSymbol}`,
      `p${baseSymbol}`,
      `https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/${baseSymbol}/p${baseSymbol}.json`,
    )
    .transaction();

  const tx = new Transaction().add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
    quoteFail,
    quotePass,
    baseFail,
    basePass,
  );

  const sig = await provider.sendAndConfirm(tx, undefined, {
    commitment: "confirmed",
  });

  console.log(sig);
}

main();
