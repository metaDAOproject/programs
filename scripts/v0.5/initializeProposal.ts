import { ConditionalVaultClient } from "@metadaoproject/programs/conditional_vault/v0.4";
import { AmmClient } from "@metadaoproject/programs/amm/v0.5";
import {
  AutocratClient,
  getProposalAddr,
} from "@metadaoproject/programs/autocrat/v0.5";
import {
  AUTOCRAT_V0_5_PROGRAM_ID,
  InstructionUtils,
} from "@metadaoproject/programs";
import {
  LAMPORTS_PER_SOL,
  Message,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { assert } from "chai";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import {
  convertTransactionInstruction,
  convertCompiledInstruction,
  getTipAccounts,
  sendBundle,
  getTipFloor,
  getBundleStatuses,
} from "../utils/bundles.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocratClient = AutocratClient.createClient({ provider });
const vaultClient = ConditionalVaultClient.createClient({ provider });
const ammClient = AmmClient.createClient({ provider });

const DAO_KEY = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");
const SQUADS_PROPOSAL_PDA = new PublicKey(
  "HDyg2gbibGfDf672KN9MU38Z5dnNVaSiTsVQw33WnY5Q",
); // NOTE: This is NOT the transaction PDA (eg the URL in squads)

async function main() {
  if (!process.env.JITO_AUTH_TOKEN) {
    console.log("No Jito auth token provided, results may be unreliable");
  }

  const dao = await autocratClient.getDao(DAO_KEY);

  console.log("dao.squadsMultisig", dao.squadsMultisig.toBase58());
  console.log("dao.baseMint", dao.baseMint.toBase58());

  const multisigPda = dao.squadsMultisig;

  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);

  const [proposalKey, proposalBump] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: BigInt(currentTransactionIndex),
  });

  console.log("Squads proposal key", proposalKey.toBase58());
  console.log("Squads proposal bump", proposalBump);

  assert(
    proposalKey.equals(SQUADS_PROPOSAL_PDA),
    "Proposal PDA does not match",
  );

  const minBaseLiquidity = dao.minBaseFutarchicLiquidity;
  let minQuoteLiquidity = dao.minQuoteFutarchicLiquidity;

  console.log("minBaseLiquidity", minBaseLiquidity.toString());
  console.log("minQuoteLiquidity", minQuoteLiquidity.toString());
  console.log("dao.baseMint", dao.baseMint.toBase58());
  console.log("dao.quoteMint", dao.quoteMint.toBase58());

  const payerBaseTokenAccount = getAssociatedTokenAddressSync(
    dao.baseMint,
    payer.publicKey,
  );
  const payerQuoteTokenAccount = getAssociatedTokenAddressSync(
    dao.quoteMint,
    payer.publicKey,
  );

  try {
    const baseTokenAccount = await provider.connection.getTokenAccountBalance(
      payerBaseTokenAccount,
    );
    console.log("baseTokenAccount", baseTokenAccount.value);
    assert(
      Number(baseTokenAccount.value.amount.toString()) >=
        Number(minBaseLiquidity.toString()),
      "Base token account balance does not match minBaseLiquidity",
    );
  } catch (error) {
    console.log(error);
    console.log("baseTokenAccount not found");
  }

  try {
    const quoteTokenAccount = await provider.connection.getTokenAccountBalance(
      payerQuoteTokenAccount,
    );
    console.log("quoteTokenAccount", quoteTokenAccount.value);
    assert(
      Number(quoteTokenAccount.value.amount.toString()) >=
        Number(minQuoteLiquidity.toString()),
      "You don't have enough quote tokens to create a market",
    );
    assert(
      Number(quoteTokenAccount.value.amount.toString()) >= Number(100_000_001),
      "Cannot create market with less than 100 USDC",
    );
  } catch (error) {
    console.log(error);
    console.log("quoteTokenAccount not found");
  }

  minQuoteLiquidity =
    Number(minQuoteLiquidity.toString()) < Number(100_000_001)
      ? new BN(100_000_001)
      : minQuoteLiquidity;

  console.log("minQuoteLiquidity", minQuoteLiquidity.toString());

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

  const txns = [];

  // it's important that these happen in a single atomic transaction
  const questionIx = await vaultClient
    .initializeQuestionIx(
      sha256(`Will ${metaDaoProposal} pass?/FAIL/PASS`),
      metaDaoProposal,
      2,
    )
    .transaction();
  txns.push(questionIx);
  const vaultTx = await vaultClient
    .initializeVaultIx(question, dao.baseMint, 2)
    .postInstructions(
      await InstructionUtils.getInstructions(
        vaultClient.initializeVaultIx(question, dao.quoteMint, 2),
        ammClient.initializeAmmIx(
          passBaseMint,
          passQuoteMint,
          dao.twapStartDelaySlots,
          dao.twapInitialObservation,
          dao.twapMaxObservationChangePerUpdate,
        ),
        ammClient.initializeAmmIx(
          failBaseMint,
          failQuoteMint,
          dao.twapStartDelaySlots,
          dao.twapInitialObservation,
          dao.twapMaxObservationChangePerUpdate,
        ),
      ),
    )
    .transaction();
  txns.push(vaultTx);
  const splitTokensTx = await vaultClient
    .splitTokensIx(question, baseVault, dao.baseMint, minBaseLiquidity, 2)
    .postInstructions(
      await InstructionUtils.getInstructions(
        vaultClient.splitTokensIx(
          question,
          quoteVault,
          dao.quoteMint,
          minQuoteLiquidity,
          2,
        ),
      ),
    )
    .transaction();
  txns.push(splitTokensTx);
  const addLiquidityTx = await ammClient
    .addLiquidityIx(
      passAmm,
      passBaseMint,
      passQuoteMint,
      minQuoteLiquidity,
      minBaseLiquidity,
      new BN(0),
    )
    .postInstructions(
      await InstructionUtils.getInstructions(
        ammClient.addLiquidityIx(
          failAmm,
          failBaseMint,
          failQuoteMint,
          minQuoteLiquidity,
          minBaseLiquidity,
          new BN(0),
        ),
      ),
    )
    .transaction();
  txns.push(addLiquidityTx);
  // this is how many original tokens are created
  const lpTokens = minQuoteLiquidity;
  const proposalTx = await autocratClient
    .initializeProposalIx(
      "",
      proposalKey,
      DAO_KEY,
      dao.baseMint,
      dao.quoteMint,
      lpTokens,
      lpTokens,
      question,
    )
    .transaction();
  txns.push(proposalTx);

  const signedTxns = await prepareBundle(txns);
  const bundle = await sendBundle(signedTxns);

  console.log("Proposal created:", bundle);
  const fetchBundle = await getBundleStatuses(bundle.result);
  console.log("Bundle status:", fetchBundle);
}

main();

const prepareBundle = async (transactions: Transaction[]) => {
  console.log("Preparing bundle");
  console.log("Number of transactions", transactions.length);
  const tipAccounts = await getTipAccounts();

  const tipFloor = await getTipFloor();

  console.log("Tip floor", Math.round(tipFloor * LAMPORTS_PER_SOL).toString());

  const tipAccount =
    tipAccounts[Math.floor(Math.random() * tipAccounts.length)];

  console.log("Tip account", tipAccount);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: new PublicKey(tipAccount),
    lamports: Math.round(tipFloor * LAMPORTS_PER_SOL), // TODO: Fetch the tip amount from the tip account
  });

  const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  console.log("Blockhash", blockhash);

  for (const transaction of transactions) {
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = payer.publicKey;
  }

  const lastTransaction = transactions[transactions.length - 1];

  if (lastTransaction instanceof VersionedTransaction) {
    console.log("Last transaction is a VersionedTransaction");
    const msg = Message.from(lastTransaction.serialize());
    msg.instructions.push(
      convertTransactionInstruction(
        transferInstruction,
        msg.getAccountKeys().staticAccountKeys,
      ),
    );
    const newMsg = new TransactionMessage({
      instructions: msg.instructions.map((instruction) =>
        convertCompiledInstruction(
          instruction,
          msg.programIds()[instruction.programIdIndex],
          msg.accountKeys,
        ),
      ),
      payerKey: payer.publicKey,
      recentBlockhash: msg.recentBlockhash,
    }).compileToV0Message();
    lastTransaction.message = newMsg;
  } else {
    console.log("Last transaction is not a VersionedTransaction");
    lastTransaction.add(transferInstruction);
    lastTransaction.feePayer = payer.publicKey;
    lastTransaction.recentBlockhash = blockhash;
  }

  try {
    console.log("Signing transactions");

    // const signedTxns = transactions.map((tx) => {
    //   try {
    //     tx.sign(payer);
    //     return tx;
    //   } catch (error) {
    //     console.log(tx);
    //     console.log("Error signing transaction", error);
    //     throw error;
    //   }
    // });

    const signedTxns = await provider.wallet.signAllTransactions([
      ...transactions,
    ]);

    console.log("Signed transactions");

    return signedTxns;
  } catch (error) {
    console.log("Error signing transactions", error);
    throw error;
  }
};
