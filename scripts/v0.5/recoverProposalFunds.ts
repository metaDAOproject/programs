import { AUTOCRAT_V0_5_PROGRAM_ID } from "@metadaoproject/programs";
import {
  AutocratClient,
  getProposalAddr,
} from "@metadaoproject/programs/autocrat/v0.5";
import { AmmClient } from "@metadaoproject/programs/amm/v0.5";
import { ConditionalVaultClient } from "@metadaoproject/programs/conditional_vault/v0.4";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

const DAO_KEY = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");
const SQUADS_PROPOSAL_PDA = new PublicKey(
  "CPXTJyYueptiLL5WAqXoC1SHnZvkq1hUAMw3qSv4bdxu",
);

async function main() {
  const dao = await autocratClient.getDao(DAO_KEY);

  const [metaDaoProposal] = getProposalAddr(
    AUTOCRAT_V0_5_PROGRAM_ID,
    SQUADS_PROPOSAL_PDA,
  );

  const {
    baseVault,
    quoteVault,
    passAmm,
    failAmm,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
    question,
    passLp,
    failLp,
  } = autocratClient.getProposalPdas(
    metaDaoProposal,
    dao.baseMint,
    dao.quoteMint,
    DAO_KEY,
  );

  try {
    const passLpAmount = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(passLp, payer.publicKey, true),
    );
    const failLpAmount = await provider.connection.getTokenAccountBalance(
      getAssociatedTokenAddressSync(failLp, payer.publicKey, true),
    );

    // TODO: Get balance of LP so we can withdraw it
    const withdrawLP = await ammClient
      .removeLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        new BN(passLpAmount.value.amount.toString()),
        new BN(0),
        new BN(0),
      )
      .rpc();
    const withdrawLpQuote = await ammClient
      .removeLiquidityIx(
        failAmm,
        failBaseMint,
        failQuoteMint,
        new BN(failLpAmount.value.amount.toString()),
        new BN(0),
        new BN(0),
      )
      .rpc();

    console.log("withdrawLP", withdrawLP);
    console.log("withdrawLpQuote", withdrawLpQuote);
  } catch (error) {
    console.log(error);
  }

  const baseVaultUserTokenAccount = getAssociatedTokenAddressSync(
    passBaseMint,
    payer.publicKey,
  );
  const quoteVaultUserTokenAccount = getAssociatedTokenAddressSync(
    passQuoteMint,
    payer.publicKey,
  );

  const baseTokensToMerge = await provider.connection.getTokenAccountBalance(
    baseVaultUserTokenAccount,
  );
  const quoteTokensToMerge = await provider.connection.getTokenAccountBalance(
    quoteVaultUserTokenAccount,
  );

  const baseTokensToMergeAmount = new BN(
    baseTokensToMerge.value.amount.toString(),
  );
  const quoteTokensToMergeAmount = new BN(
    Number(quoteTokensToMerge.value.amount.toString()),
  );

  console.log("baseTokensToMerge", baseTokensToMerge.value.amount.toString());
  console.log("quoteTokensToMerge", quoteTokensToMerge.value.amount.toString());

  const mergeTokens = await vaultClient
    .mergeTokensIx(
      question,
      baseVault,
      dao.baseMint,
      baseTokensToMergeAmount,
      2,
      payer.publicKey,
    )
    .rpc();
  const mergeTokensQuote = await vaultClient
    .mergeTokensIx(
      question,
      quoteVault,
      dao.quoteMint,
      quoteTokensToMergeAmount,
      2,
      payer.publicKey,
    )
    .rpc();

  // const withdraw = await vaultClient.redeemTokensIx(question, baseVault, dao.baseMint, 2, payer.publicKey).rpc();
  // const withdrawQuote = await vaultClient.redeemTokensIx(question, quoteVault, dao.quoteMint, 2, payer.publicKey).rpc();

  console.log("withdraw", mergeTokens);
  console.log("withdrawQuote", mergeTokensQuote);
}

main();
