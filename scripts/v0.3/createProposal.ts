import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AmmClient,
  ConditionalVault,
  ConditionalVaultClient,
  AutocratClient,
  getAmmAddr,
  getVaultAddr,
} from "@metadaoproject/futarchy/v0.3";
import { BN } from "bn.js";
import { META } from "./consts.js";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const vaultProgram: ConditionalVaultClient =
  ConditionalVaultClient.createClient({ provider });
const ammProgram: AmmClient = AmmClient.createClient({ provider });
const autocratProgram: AutocratClient = AutocratClient.createClient({
  provider,
});
const USDC = new PublicKey("CRWxbGNtVrTr9FAJX6SZpsvPZyi9R7VetuqecoZ1jCdD");

async function main() {
  const dao = new PublicKey("33Pi6Dxur8Q87K7DmG8JAdZoiTwSRi2HCP6ZjLAPn2sE");

  const storedDao = await autocratProgram.getDao(dao);

  console.log(storedDao.tokenMint);
  console.log(storedDao.usdcMint);
  console.log(storedDao);
  return;

  const myTokenAccount = token.getAssociatedTokenAddressSync(
    storedDao.tokenMint,
    payer.publicKey
  );

  const mintToIx = token.createMintToInstruction(
    storedDao.tokenMint,
    myTokenAccount,
    storedDao.treasury,
    1000 * 10 ** 6
  );

  const ix = {
    programId: mintToIx.programId,
    data: mintToIx.data,
    accounts: mintToIx.keys,
  };

  const proposal = await autocratProgram.initializeProposal(
    dao,
    "https://www.google.com",
    ix,
    storedDao.minBaseFutarchicLiquidity,
    storedDao.minQuoteFutarchicLiquidity
  );

  // console.log(proposal);

  // const metaAccount = await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, META, payer.publicKey);
  // console.log(metaAccount);

  return;

  // const outcomeQuestionId = sha256(
  //   new TextEncoder().encode(
  //     "Will Futarded Foundation fund a Go SDK for Anchor?/No/Yes"
  //   )
  // );
  // const metricQuestionId = sha256(
  //   new TextEncoder().encode(
  //     "How effective will the Go SDK for Anchor be deemed?/Down/Up"
  //   )
  // );

  // await token.createAssociatedTokenAccount(provider.connection, payer, USDC, payer.publicKey);

  let tokenAccount = token.getAssociatedTokenAddressSync(USDC, payer.publicKey);
  // await token.mintTo(provider.connection, payer, USDC, tokenAccount,payer, 10 ** 6);

  // let storedQuestion: Question | null = await vaultProgram.fetchQuestion(outcomeQuestion);

  // for (const questionId of [outcomeQuestionId, metricQuestionId]) {
  //     const question = getQuestionAddr(vaultProgram.vaultProgram.programId, questionId, payer.publicKey, 2)[0];
  //     let storedQuestion: Question | null = await vaultProgram.fetchQuestion(question);
  //     if (!storedQuestion) {
  //         await vaultProgram.initializeQuestionIx(questionId, payer.publicKey, 2).rpc();
  //         storedQuestion = await vaultProgram.fetchQuestion(question);
  //         console.log(storedQuestion);
  //     }
  // }

  const outcomeQuestion = getQuestionAddr(
    vaultProgram.vaultProgram.programId,
    outcomeQuestionId,
    payer.publicKey,
    2
  )[0];
  const metricQuestion = getQuestionAddr(
    vaultProgram.vaultProgram.programId,
    metricQuestionId,
    payer.publicKey,
    2
  )[0];

  let storedOutcomeQuestion: Question | null = await vaultProgram.fetchQuestion(
    outcomeQuestion
  );
  if (!storedOutcomeQuestion) {
    await vaultProgram
      .initializeQuestionIx(outcomeQuestionId, payer.publicKey, 2)
      .rpc();
    storedOutcomeQuestion = await vaultProgram.fetchQuestion(outcomeQuestion);
  }

  let storedMetricQuestion: Question | null = await vaultProgram.fetchQuestion(
    metricQuestion
  );
  if (!storedMetricQuestion) {
    await vaultProgram
      .initializeQuestionIx(metricQuestionId, payer.publicKey, 2)
      .rpc();
    storedMetricQuestion = await vaultProgram.fetchQuestion(metricQuestion);
  }

  console.log("OUTCOME QUESTION");
  console.log(outcomeQuestion);
  console.log(storedOutcomeQuestion);

  console.log("METRIC QUESTION");
  console.log(metricQuestion);
  console.log(storedMetricQuestion);

  const outcomeVault = getVaultAddr(
    vaultProgram.vaultProgram.programId,
    outcomeQuestion,
    USDC
  )[0];
  let storedOutcomeVault: ConditionalVault | null =
    await vaultProgram.fetchVault(outcomeVault);

  if (!storedOutcomeVault) {
    await vaultProgram.initializeVaultIx(outcomeQuestion, USDC, 2).rpc();
    storedOutcomeVault = await vaultProgram.fetchVault(outcomeVault);
  }

  const pUSDC = storedOutcomeVault.conditionalTokenMints[1];

  const metricVault = getVaultAddr(
    vaultProgram.vaultProgram.programId,
    metricQuestion,
    pUSDC
  )[0];
  let storedMetricVault: ConditionalVault | null =
    await vaultProgram.fetchVault(metricVault);

  if (!storedMetricVault) {
    await vaultProgram.initializeVaultIx(metricQuestion, pUSDC, 2).rpc();
    storedMetricVault = await vaultProgram.fetchVault(metricVault);
  }

  console.log("Outcome Vault");
  console.log(outcomeVault);
  console.log(storedOutcomeVault);
  console.log("Metric Vault");
  console.log(metricVault);
  console.log(storedMetricVault);

  // await vaultProgram.splitTokensIx(outcomeQuestion, outcomeVault, USDC, new BN(1000 * 10 ** 6), 2).rpc();
  // await vaultProgram.splitTokensIx(metricQuestion, metricVault, pUSDC, new BN(1000 * 10 ** 6), 2).rpc();

  const pDown = storedMetricVault.conditionalTokenMints[0];
  const pUp = storedMetricVault.conditionalTokenMints[1];

  const amm = getAmmAddr(ammProgram.program.programId, pUp, pDown)[0];

  console.log("AMM");
  console.log(amm);

  return;

  let storedAmm: Amm | null = await ammProgram.fetchAmm(amm);
  console.log(storedAmm);
  if (!storedAmm) {
    await ammProgram.initializeAmmIx(pUp, pDown, new BN(0), new BN(0)).rpc();
    storedAmm = await ammProgram.fetchAmm(amm);
  }

  await vaultProgram
    .splitTokensIx(
      outcomeQuestion,
      outcomeVault,
      USDC,
      new BN(1001 * 10 ** 6),
      2,
      payer.publicKey
    )
    .rpc();
  await vaultProgram
    .splitTokensIx(
      metricQuestion,
      metricVault,
      pUSDC,
      new BN(1001 * 10 ** 6),
      2,
      payer.publicKey
    )
    .rpc();

  await ammProgram.addLiquidity(amm, 1000, 1000);
  console.log("utc millis", new Date().getTime());

  // const amm = await ammProgram.fetchAmm(ammProgram.ammProgram.programId, pDown, pUp);

  // console.log(storedVault);

  // console.log(await vaultProgram.fetchVault(vault));
}

main();
