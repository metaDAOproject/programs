import * as token from "@solana/spl-token";
import { Keypair, PublicKey, AddressLookupTableProgram, Transaction, AddressLookupTableAccount, TransactionMessage, VersionedTransaction, MessageV0, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  AUTOCRAT_PROGRAM_ID,
  AutocratIDL,
  PriceMath,
} from "@metadaoproject/futarchy/v0.4";
import { IDL as StreamflowEscrowIDL } from "../tests/fixtures/streamflow_escrow.js";
import { BN } from "bn.js";
import * as fs from "fs";
import { assert } from "console";
import { USDC } from "./consts.js";

const STREAMFLOW_ESCROW_PROGRAM_ID = new PublicKey("ESCRoWj8QUJ5cTXCBWbGpW6AzaaEAtRbZuwKp8c4YYGs");
const STREAMFLOW_VESTING_PROGRAM_ID = new PublicKey("strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m");

const ORDER_PUBKEY = new PublicKey("AS9b7ZQ89DZDdzE3y7mTqHFxoxEJp3gGR2UTRbAVHiFE");
const MTNCAP_DAO = new PublicKey("6uY9NohsBFGF1BafttPNZtJ4uyNbYKaNToL169nEegox");
const RAY = new PublicKey("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R");
const LUT = new PublicKey("5m1KBVQBrWbpX3qe8AG7tUzrV4yLdMPGbDkHNN9cZ7Z1");
const PROPOSAL_NONCE = new BN(1337);

export const ORDER_PREFIX = Buffer.from('order', 'utf-8');
export const EXECUTION_RECORD_PREFIX = Buffer.from('execution-record', 'utf-8');
export const ESCROW_PREFIX = Buffer.from('strm', 'utf-8');

export const deriveOrderPDA = (
  programId: anchor.web3.PublicKey,
  creator: anchor.web3.PublicKey,
  baseMint: anchor.web3.PublicKey,
  nonce: number,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [ORDER_PREFIX, creator.toBuffer(), baseMint.toBuffer(), new BN(nonce).toArrayLike(Buffer, 'le', 4)],
    programId,
  )[0];
};

export const deriveExecutionRecordPDA = (
  programId: anchor.web3.PublicKey,
  order: anchor.web3.PublicKey,
  executor: anchor.web3.PublicKey,
  nonce: number,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [EXECUTION_RECORD_PREFIX, order.toBuffer(), executor.toBuffer(), new BN(nonce).toArrayLike(Buffer, 'le', 4)],
    programId,
  )[0];
};

export const deriveEscrowPDA = (
  programId: anchor.web3.PublicKey,
  contractKey: anchor.web3.PublicKey,
): anchor.web3.PublicKey => {
  return anchor.web3.PublicKey.findProgramAddressSync([ESCROW_PREFIX, contractKey.toBuffer()], programId)[0];
};

async function main() {
  // Initialize clients
  const provider = anchor.AnchorProvider.env();
  const payer = provider.wallet["payer"];
  const autocratProgram = AutocratClient.createClient({ provider });
  const escrowProgram = new anchor.Program(StreamflowEscrowIDL as anchor.Idl, STREAMFLOW_ESCROW_PROGRAM_ID, provider);

  const storedDao = await autocratProgram.getDao(MTNCAP_DAO);
  const daoTreasury = storedDao.treasury;

  const storedOrder = await escrowProgram.account.order.fetch(ORDER_PUBKEY);

  const fillNonce = storedOrder.nonce as number + 12345;

  // Import contract keypair from file
  const contractKeypair = Keypair.fromSecretKey(Buffer.from(JSON.parse(fs.readFileSync("../contract-keypair.json", "utf8"))));
  const contractKey = contractKeypair.publicKey;
  const escrowKey = deriveEscrowPDA(STREAMFLOW_VESTING_PROGRAM_ID, contractKey);
  const recordKey = deriveExecutionRecordPDA(STREAMFLOW_ESCROW_PROGRAM_ID, ORDER_PUBKEY, daoTreasury, fillNonce);

  assert(USDC.equals(storedOrder.quoteMint as PublicKey));
  assert(RAY.equals(storedOrder.baseMint as PublicKey));

  const daoUsdc = (await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, USDC, daoTreasury, true)).address;
  const daoRay = (await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, RAY, daoTreasury, true)).address;
  const creatorUsdc = (await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, USDC, storedOrder.creator as PublicKey, true)).address;

  console.log(daoUsdc);
  console.log(daoRay);
  console.log(creatorUsdc);

  console.log(storedDao);
  console.log(storedDao.minBaseFutarchicLiquidity.toString());
  console.log(storedDao.minQuoteFutarchicLiquidity.toString());

  // Create the fillOrderVested instruction
  const fillOrderIx = await escrowProgram.methods
    .fillOrderVested(fillNonce, storedOrder.amount, storedOrder.startPrice, false)
    .accounts({
      common: {
        executor: daoTreasury,
        from: daoUsdc,
        toBase: daoRay,
        order: ORDER_PUBKEY,
        toQuote: creatorUsdc,
        baseTokenProgram: token.TOKEN_PROGRAM_ID,
        quotaTokenProgram: token.TOKEN_PROGRAM_ID,
        vault: storedOrder.vault as PublicKey,
        creator: storedOrder.creator as PublicKey,
        baseMint: RAY,
        quoteMint: USDC,
      },
      streamMetadata: contractKey,
      withdrawor: new PublicKey("wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u"),
      feeOracle: new PublicKey("B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT"),
      escrowTokens: escrowKey,
      executionRecord: recordKey,
      streamflowProgram: STREAMFLOW_VESTING_PROGRAM_ID,
    })
    .transaction();

// console.log()
  const payerUsdcBalance = new BN((await provider.connection.getTokenAccountBalance(token.getAssociatedTokenAddressSync(USDC, payer.publicKey))).value.amount);
  const payerMtnBalance = new BN((await provider.connection.getTokenAccountBalance(token.getAssociatedTokenAddressSync(storedDao.tokenMint, payer.publicKey))).value.amount);

  const { transactions, proposal } = await autocratProgram.initializeProposalTx(
    MTNCAP_DAO,
    "",
    {
      programId: fillOrderIx.instructions[0].programId,
      accounts: fillOrderIx.instructions[0].keys.map(key => ({
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable
      })),
      data: fillOrderIx.instructions[0].data,
    },
    payerMtnBalance,
    payerUsdcBalance,
    PROPOSAL_NONCE
  );

  console.log(proposal);

  let encodedTransactions = [];

  for (let i = 0; i < transactions.length - 1; i++) {
    const tx = transactions[i];
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash("confirmed")).blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    encodedTransactions.push(Buffer.from(tx.serialize()).toString('base64'));
  }
  const initProposalTx = transactions[transactions.length - 1];

  let rawLookupTable = await provider.connection.getAccountInfo(LUT);
  let lookupTable = new AddressLookupTableAccount({
    key: LUT,
    state: AddressLookupTableAccount.deserialize(rawLookupTable!.data),
  });

  let tipee = new PublicKey("ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49");

  const tipIx = SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: tipee,
    lamports: 1000,
  });

  const initProposalMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: initProposalTx.instructions.concat(tipIx),
  }).compileToV0Message([lookupTable]);
  const initProposalTxV0 = new VersionedTransaction(initProposalMessage);
  initProposalTxV0.sign([payer]);
  encodedTransactions.push(Buffer.from(initProposalTxV0.serialize()).toString('base64'));

  console.log(encodedTransactions.map(tx => `"${tx}"`).join(',\n\t'));


//   const accountsToAdd = initProposalTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
//   const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];
//   console.log(uniqueAccounts.length);
// const extendInstruction = AddressLookupTableProgram.extendLookupTable({
//     payer: payer.publicKey,
//     authority: payer.publicKey,
//     lookupTable: LUT,
//     addresses: uniqueAccounts,
//   });

//   const extendTx = new Transaction().add(extendInstruction);
//   extendTx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
//   extendTx.feePayer = payer.publicKey;
//   extendTx.sign(payer);
//   await provider.sendAndConfirm(extendTx);

  return;
  


  console.log(lookupTable)

  return;

  console.log(initProposalTxV0.message.staticAccountKeys.length);
  initProposalTxV0.sign([payer]);
  console.log(Buffer.from(initProposalTxV0.serialize()).toString('base64'));
  return;

  return;


  console.log(Buffer.from(initProposalTxV0.serialize()).toString('base64'));

  return;


  // Extract unique accounts from the last instruction to add to lookup table
//   const lastTx = transactions[transactions.length - 1];
//   const accountsToAdd = lastTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
//   const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];

//   const slot = await provider.connection.getSlot();
//   const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
//     authority: payer.publicKey,
//     payer: payer.publicKey,
//     recentSlot: slot - 1,
//   });

//   // Create extend instruction for the last transaction's accounts
  

//   // Execute extend instruction
//   let extendTx = new Transaction().add(lookupTableInst, extendInstruction);
//   extendTx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
//   extendTx.feePayer = payer.publicKey;
//   extendTx.sign(payer);
//   await provider.sendAndConfirm(extendTx);







  return;


  // Use the existing DAO address
  console.log(storedDao);
//   console.log("DAO Token Mint:", storedDao.tokenMint.toString());
//   console.log("DAO USDC Mint:", storedDao.usdcMint.toString());

//   // Create or get token accounts for the payer
//   const metaAccount = await token.getOrCreateAssociatedTokenAccount(
//     provider.connection,
//     payer,
//     storedDao.tokenMint,
//     payer.publicKey
//   );
//   console.log("META account:", metaAccount.address.toString());

//   const usdcAccount = await token.getOrCreateAssociatedTokenAccount(
//     provider.connection,
//     payer,
//     storedDao.usdcMint,
//     payer.publicKey
//   );
//   console.log("USDC account:", usdcAccount.address.toString());

//   // Check balances
//   const metaBalance = metaAccount.amount;
//   const usdcBalance = usdcAccount.amount;
//   console.log("Current META balance:", metaBalance.toString());
//   console.log("Current USDC balance:", usdcBalance.toString());

//   // Ensure we have enough tokens for the proposal
//   const requiredMeta = PriceMath.getChainAmount(10, 9); // 10 META for more liquidity
//   const requiredUsdc = PriceMath.getChainAmount(10000, 6); // 10000 USDC for more liquidity

//   if (metaBalance < BigInt(requiredMeta.toString()) || usdcBalance < BigInt(requiredUsdc.toString())) {
//     console.log("Insufficient balance for proposal creation");
//     console.log("Required META:", requiredMeta.toString());
//     console.log("Required USDC:", requiredUsdc.toString());
//     return;
//   }

//   const autocrat = new anchor.Program(
//     AutocratIDL,
//     AUTOCRAT_PROGRAM_ID,
//     provider
//   );

//   const accounts = [
//     {
//       pubkey: dao,
//       isSigner: true,
//       isWritable: true,
//     },
//   ];

//   const data = autocrat.coder.instruction.encode("update_dao", {
//     daoParams: {
//       passThresholdBps: 500,
//       baseBurnLamports: null,
//       burnDecayPerSlotLamports: null,
//       slotsPerProposal: null,
//       marketTakerFee: null,
//     },
//   });

//   const ix = {
//     programId: autocratProgram.getProgramId(),
//     accounts,
//     data,
//   };

//   // Initialize the proposal
//   const proposal = await autocratProgram.initializeProposal(
//     dao,
//     "https://example.com/proposal", // proposal description URL
//     ix,
//     PriceMath.getChainAmount(10, 9), // 10 META for more liquidity
//     PriceMath.getChainAmount(10000, 6) // 10000 USDC for more liquidity
//   );

//   console.log("Proposal created with address:", proposal.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
