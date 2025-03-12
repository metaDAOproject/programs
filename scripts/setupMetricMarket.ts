import * as token from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AmmClient,
  ConditionalVault,
  ConditionalVaultClient,
  getAmmAddr,
  getDownAndUpMintAddrs,
  getEventAuthorityAddr,
  getFailAndPassMintAddrs,
  getQuestionAddr,
  getVaultAddr,
  MAINNET_USDC,
} from "@metadaoproject/futarchy/v0.4";
import { sha256 } from "@metadaoproject/futarchy";
import { Question, Amm } from "@metadaoproject/futarchy/v0.4";
import { BN } from "bn.js";
import { homedir } from 'os';
import { join } from 'path';

import { input, select } from '@inquirer/prompts';

const network = await select({
  message: 'Which network do you want to use?',
  choices: [
    { value: 'devnet', name: 'devnet - https://api.devnet.solana.com' },
    { value: 'mainnet', name: 'mainnet - https://api.mainnet-beta.solana.com' },
    { value: 'custom', name: 'custom RPC URL' }
  ]
});

const rpcUrl = network === 'custom'
  ? await input({ message: 'Enter your custom RPC URL:' })
  : network === 'devnet'
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";

// Add default oracle addresses
const DEFAULT_ORACLE = "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf";

const oracleAddress = await input({ 
  message: 'Enter the oracle address', 
  default: DEFAULT_ORACLE 
});

const walletPath = await input({ message: 'Enter the path to your wallet file', default: join(homedir(), '.config/solana/id.json') });
process.env.ANCHOR_WALLET = walletPath;
const provider = anchor.AnchorProvider.local(rpcUrl, { commitment: "confirmed" });
const payer = provider.wallet["payer"];

const vaultProgram: ConditionalVaultClient =
  ConditionalVaultClient.createClient({ provider });
const ammProgram: AmmClient = AmmClient.createClient({ provider });

const outcomeQuestionText = await input({ message: 'Enter the outcome question text (example: Will Jito approve Switchboard\'s 300k JTO NCN Grant?/No/Yes):\n' });
const metricQuestionText = await input({ message: 'Enter the metric question text (example: Will Switchboard\'s NCN generate more than $1M by 12/01/25?/No/Yes):\n' });

const liquidityAmount = await input({ message: 'Enter the amount of USDC to provide as liquidity (example: 1000, must be at least 100):\n' });

// const USDC = new PublicKey("CRWxbGNtVrTr9FAJX6SZpsvPZyi9R7VetuqecoZ1jCdD");
const USDC = MAINNET_USDC;

async function sendAndConfirmTransaction(
  tx: Transaction,
  label: string
) {
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
  tx.partialSign(payer);
  const txHash = await provider.connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
  console.log(`${label} transaction sent:`, txHash);
  
  await provider.connection.confirmTransaction(txHash, "confirmed");
  const txStatus = await provider.connection.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });
  if (txStatus?.meta?.err) {
    throw new Error(`Transaction failed: ${txHash}\nError: ${JSON.stringify(txStatus?.meta?.err)}`);
  }
  console.log(`${label} transaction confirmed`);
  return txHash;
}

async function main() {
  if (!outcomeQuestionText) {
    throw new Error("Outcome question text cannot be empty");
  }

  if (!metricQuestionText) {
    throw new Error("Metric question text cannot be empty");
  }

  let tx = new Transaction();

  let oracle = new PublicKey(oracleAddress);

  const outcomeQuestionId = sha256(
    new TextEncoder().encode(outcomeQuestionText)
  );

  const metricQuestionId = sha256(
    new TextEncoder().encode(metricQuestionText)
  );

  const outcomeQuestion = getQuestionAddr(
    vaultProgram.vaultProgram.programId,
    outcomeQuestionId,
    oracle,
    2
  )[0];
  const metricQuestion = getQuestionAddr(
    vaultProgram.vaultProgram.programId,
    metricQuestionId,
    oracle,
    2
  )[0];

  let storedOutcomeQuestion: Question | null = await vaultProgram.fetchQuestion(
    outcomeQuestion
  );
  if (!storedOutcomeQuestion) {
    tx.add(await vaultProgram
      .initializeQuestionIx(outcomeQuestionId, oracle, 2)
      .transaction()
    );
    storedOutcomeQuestion = await vaultProgram.fetchQuestion(outcomeQuestion);
  }

  let storedMetricQuestion: Question | null = await vaultProgram.fetchQuestion(
    metricQuestion
  );
  if (!storedMetricQuestion) {
    tx.add(await vaultProgram
      .initializeQuestionIx(metricQuestionId, oracle, 2)
      .transaction()
    );
    storedMetricQuestion = await vaultProgram.fetchQuestion(metricQuestion);
  }


  console.log("OUTCOME QUESTION");
  console.log(outcomeQuestion.toBase58());
  // console.log(storedOutcomeQuestion);

  console.log("METRIC QUESTION");
  console.log(metricQuestion.toBase58());
  // console.log(storedMetricQuestion);

  const outcomeVault = getVaultAddr(
    vaultProgram.vaultProgram.programId,
    outcomeQuestion,
    USDC
  )[0];
  let storedOutcomeVault: ConditionalVault | null =
    await vaultProgram.fetchVault(outcomeVault);

  if (!storedOutcomeVault) {
    tx.add(await vaultProgram.initializeVaultIx(outcomeQuestion, USDC, 2).transaction());
  }

  const pUSDC = getFailAndPassMintAddrs(
    vaultProgram.vaultProgram.programId,
    outcomeVault
  ).pass;

  const metricVault = getVaultAddr(
    vaultProgram.vaultProgram.programId,
    metricQuestion,
    pUSDC
  )[0];
  let storedMetricVault: ConditionalVault | null =
    await vaultProgram.fetchVault(metricVault);

  if (!storedMetricVault) {
    tx.add(await vaultProgram.initializeVaultIx(metricQuestion, pUSDC, 2).transaction());
    storedMetricVault = await vaultProgram.fetchVault(metricVault);
  }

  console.log("Outcome Vault");
  console.log(outcomeVault.toBase58());
  // console.log(storedOutcomeVault);
  console.log("Metric Vault");
  console.log(metricVault.toBase58());
  // console.log(storedMetricVault);

  const { down: pDown, up: pUp } = getDownAndUpMintAddrs(
    vaultProgram.vaultProgram.programId,
    metricVault
  );

  await sendAndConfirmTransaction(tx, "First");
  
  // NOW ADD METADATA TO THE VAULTS
  tx = new Transaction();

  tx.add(await vaultProgram.addMetadataToConditionalTokensIx(
    outcomeVault,
    0,
    "Fail USDC",
    "fUSDC",
    "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/fUSDC.json",
  ).transaction());

  tx.add(await vaultProgram.addMetadataToConditionalTokensIx(
    outcomeVault,
    1,
    "Pass USDC",
    "pUSDC",
    "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/USDC/pUSDC.json",
  ).transaction());

  tx.add(await vaultProgram.addMetadataToConditionalTokensIx(
    metricVault,
    0,
    "NO",
    "pNO",
    "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/Binary/NO.json",
  ).transaction());

  tx.add(await vaultProgram.addMetadataToConditionalTokensIx(
    metricVault,
    1,
    "YES",
    "pYES",
    "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/Binary/YES.json",
  ).transaction());


  await sendAndConfirmTransaction(tx, "Second");

  const liquidityAmountNum = Number(liquidityAmount);

  tx = new Transaction();
  const amm = getAmmAddr(ammProgram.program.programId, pUp, pDown)[0];
  let storedAmm: Amm | null = await ammProgram.fetchAmm(amm);

  console.log("AMM");
  console.log(amm.toBase58());

  if (!storedAmm) {
    tx.add(await ammProgram.initializeAmmIx(pUp, pDown, new BN(0), new BN(10 ** 12), new BN(10 ** 10)).transaction());
    storedAmm = await ammProgram.fetchAmm(amm);
  }

  tx.add(await vaultProgram
    .splitTokensIx(
      outcomeQuestion,
      outcomeVault,
      USDC,
      new BN(liquidityAmountNum * 10 ** 6),
      2,
      payer.publicKey
    )
    .transaction()
  );
  tx.add(await vaultProgram
    .splitTokensIx(
      metricQuestion,
      metricVault,
      pUSDC,
      new BN(liquidityAmountNum * 10 ** 6),
      2,
      payer.publicKey
    )
    .transaction()
  );

  tx.add(await ammProgram.addLiquidityIx(amm, pUp, pDown,
    new BN(liquidityAmountNum * 10 ** 6),
    new BN(liquidityAmountNum * 10 ** 6),
    new BN(0),
    payer.publicKey
  ).transaction());

  await sendAndConfirmTransaction(tx, "Third");
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
