import {
  AmmClient,
  AUTOCRAT_PROGRAM_ID,
  AutocratClient,
  getAmmAddr,
  getAmmLpMintAddr,
} from "@metadaoproject/futarchy/v0.4";
import { Keypair, PublicKey, AddressLookupTableProgram, Transaction, AddressLookupTableAccount, TransactionMessage, VersionedTransaction, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError, toBN } from "../../utils.js";
import { BN } from "bn.js";

import { StreamflowEscrow, IDL as StreamflowEscrowIDL } from "../../fixtures/streamflow_escrow.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { STREAMFLOW_VESTING_PROGRAM_ID } from "../../main.test.js";
import { Clock } from "solana-bankrun";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { ConditionalVaultClient } from "@metadaoproject/futarchy/v0.4";
// import { IDL as StreamflowEscrowIDL } from "../../fixtures/streamflow_escrow.json";


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


export default async function () {
  let ammClient: AmmClient;
  let autocratClient: AutocratClient;
  let vaultClient: ConditionalVaultClient;
  let RAY: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  RAY = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    9
  );
  USDC = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    6
  );

  await this.createTokenAccount(RAY, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(RAY, this.payer.publicKey, this.payer, 10000000 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 100000000000 * 10 ** 6);

  autocratClient = this.autocratClient;
  ammClient = this.ammClient;
  vaultClient = this.vaultClient;

  const STREAMFLOW_ESCROW_PROGRAM_ID = new PublicKey("ESCRoWj8QUJ5cTXCBWbGpW6AzaaEAtRbZuwKp8c4YYGs");
  const escrow = new anchor.Program(StreamflowEscrowIDL as anchor.Idl, STREAMFLOW_ESCROW_PROGRAM_ID);

  const authority = this.payer.publicKey;
  // const baseMint = new PublicKey(baseAddr);
  // const quoteMint = new PublicKey(quoteAddr);
  const amount = new BN(1000000);
  const price = new BN(5000000);
  const orderNonce = 0;
  const vestingStartTs = new BN(Math.floor(Date.now() / 1000) + 3600);
  const vestingPeriod = new BN(30);
  const vestingAmountPerPeriod = new BN(1);
  const vestingCliffAmount = new BN(500000);

  const orderKey = deriveOrderPDA(STREAMFLOW_ESCROW_PROGRAM_ID, authority, RAY, orderNonce);
  const vaultKey = token.getAssociatedTokenAddressSync(RAY, orderKey, true);

  // const treasury = Keypair.generate();

  // // Send 1 SOL to treasury
  // const tx = new anchor.web3.Transaction();
  // tx.add(
  //   anchor.web3.SystemProgram.transfer({
  //     fromPubkey: this.payer.publicKey,
  //     toPubkey: treasury.publicKey,
  //     lamports: 1_000_000_000, // 1 SOL = 1 billion lamports
  //   })
  // );
  // tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  // console.log('recentBlockhash', tx.recentBlockhash);
  // tx.feePayer = this.payer.publicKey;
  // tx.sign(this.payer);
  // await this.banksClient.processTransaction(tx);

  console.log('Creating vested order:', orderKey.toBase58());
  await escrow.methods
    .createOrderFixed({
      nonce: orderNonce,
      amount,
      startPrice: price,
      partialAllowed: false,
      expiryTs: new BN(0),
      claimType: { vested: {} },
      vestingStartTs,
      vestingPeriod,
      vestingAmountPerPeriod,
      vestingCliffAmount,
    })
    .accounts({
      creator: authority,
      baseMint: RAY,
      quoteMint: USDC,
      order: orderKey,
      vault: vaultKey,
      from: token.getAssociatedTokenAddressSync(RAY, authority),
      executor: null,
      partner: null,
    })
    .rpc();

  const fillNonce = 0;

  // await this.createTokenAccount(RAY, treasury.publicKey);
  // await this.createTokenAccount(USDC, treasury.publicKey);
  // await this.mintTo(USDC, treasury.publicKey, this.payer, 1000000 * 10 ** 6);


  // Create a lookup table for the accounts
  const slot = await this.banksClient.getSlot();
  const [lookupTableInst, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    recentSlot: slot - 1n,
  });

  const daoKeypair = Keypair.generate();
  const dao = await autocratClient.initializeDao(
    RAY,
    1000, // tokenPriceUiAmount
    5, // minBaseFutarchicLiquidity
    5000, // minQuoteFutarchicLiquidity
    USDC,
    daoKeypair,
    new BN(Number(DAY_IN_SLOTS))
  );

  // Add all the accounts needed for fillOrderVested to the lookup table
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [
      // authority,
      token.getAssociatedTokenAddressSync(USDC, authority),
      token.getAssociatedTokenAddressSync(RAY, authority),
      // orderKey,
      token.getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
      token.TOKEN_PROGRAM_ID,
      // vaultKey,
      // RAY,
      // USDC,
      this.payer.publicKey,
      daoKeypair.publicKey,
      // contractKey,
      // new PublicKey("wdrwhnCv4pzW8beKsbPa4S2UDZrXenjg16KJdKSpb5u"),
      // new PublicKey("B743wFVk2pCYhV91cn287e1xY7f1vt4gdY48hhNiuQmT"),
      // escrowKey,
      // recordKey,
      // STREAMFLOW_VESTING_PROGRAM_ID,
      // AUTOCRAT_PROGRAM_ID,
    ],
  });

  await this.advanceBySlots(1n)

  // Create and extend the lookup table
  let tx = new Transaction().add(lookupTableInst, extendInstruction);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer);
  await this.banksClient.processTransaction(tx);

  await this.advanceBySlots(1n)

  const extentIx2 = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [
      this.payer.publicKey,
    ],
  });

  tx = new Transaction().add(extentIx2);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer);
  await this.banksClient.processTransaction(tx);


  let lookupTable = await this.banksClient.getAccount(lookupTableAddress);

  console.log(lookupTable);
  let acc = new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(lookupTable.data),
  });

  // Create a DAO if it doesn't exist

  const daoTreasury = await autocratClient.getDao(dao).then(dao => dao.treasury);

  await this.createTokenAccount(RAY, daoTreasury);
  await this.createTokenAccount(USDC, daoTreasury);
  await this.mintTo(USDC, daoTreasury, this.payer, 10000000000 * 10 ** 6);


  const contractKeypair = Keypair.generate();
  const contractKey = contractKeypair.publicKey;
  const escrowKey = deriveEscrowPDA(STREAMFLOW_VESTING_PROGRAM_ID, contractKey);
  const recordKey = deriveExecutionRecordPDA(STREAMFLOW_ESCROW_PROGRAM_ID, orderKey, daoTreasury, fillNonce);


  // Create the fillOrderVested instruction
  const fillOrderIx = await escrow.methods
    .fillOrderVested(fillNonce, amount, price, false)
    .accounts({
      common: {
        executor: daoTreasury,
        from: token.getAssociatedTokenAddressSync(USDC, daoTreasury, true),
        toBase: token.getAssociatedTokenAddressSync(RAY, daoTreasury, true),
        order: orderKey,
        toQuote: token.getAssociatedTokenAddressSync(USDC, this.payer.publicKey),
        baseTokenProgram: token.TOKEN_PROGRAM_ID,
        quotaTokenProgram: token.TOKEN_PROGRAM_ID,
        vault: vaultKey,
        creator: authority,
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

  fillOrderIx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  fillOrderIx.feePayer = this.payer.publicKey;
  fillOrderIx.sign(this.payer, contractKeypair);

  // console.log(fillOrderIx.serialize().length)


  // console.log(fillOrderIx.keys.length)
  // console.log(fillOrderIx.data.length)

  // Create a new transaction that uses the lookup table
  // const lookupTableAccount = await this.banksClient.getAddressLookupTable(lookupTableAddress);
  // const lookupTableAddresses = lookupTableAccount.value?.state.addresses || [];

  // Create a proposal with the fillOrderVested instruction using lookup table addresses
  const { proposal, tx: proposalTx } = await autocratClient.initializeProposal(
    dao,
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
    new BN(5 * 10 ** 9), // baseTokensToLP
    new BN(5000 * 10 ** 6),  // quoteTokensToLP
    acc
  ) as any as { tx: Transaction, proposal: PublicKey };

  const transferIx = SystemProgram.transfer({
    fromPubkey: this.payer.publicKey,
    toPubkey: daoTreasury,
    lamports: 2282880 + 8574720,
  });


  const transferTx = new Transaction().add(transferIx);
  transferTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  transferTx.feePayer = this.payer.publicKey;
  transferTx.sign(this.payer);
  await this.banksClient.processTransaction(transferTx);

  await this.advanceBySlots(1n)


  console.log(proposalTx);
  // Extract unique accounts from the instruction to add to lookup table
  const accountsToAdd = proposalTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
  // accountsToAdd.push(proposal.instructions[0].programId);

  // Remove duplicates
  const uniqueAccounts = [...new Set(accountsToAdd.flat())];

  // Create extend instruction
  const extendInstruction3 = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: acc.key,
    addresses: uniqueAccounts
  });

  // Execute extend instruction
  let extendTx = new Transaction().add(extendInstruction3);
  extendTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  extendTx.feePayer = this.payer.publicKey;
  extendTx.sign(this.payer);
  await this.banksClient.processTransaction(extendTx);

  await this.advanceBySlots(1n)

  const extendInstruction4 = AddressLookupTableProgram.extendLookupTable({
    payer: this.payer.publicKey,
    authority: this.payer.publicKey,
    lookupTable: acc.key,
    addresses: uniqueAccounts
  });

  // Execute extend instruction
  let extendTx4 = new Transaction().add(extendInstruction4);
  extendTx4.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  extendTx4.feePayer = this.payer.publicKey;
  extendTx4.sign(this.payer);
  await this.banksClient.processTransaction(extendTx4);

  await this.advanceBySlots(1n)



  // // Advance clock by 1 slot to allow lookup table to be used
  // const currentClock = await this.banksClient.getClock();
  // this.context.setClock(
  //   new Clock(
  //     currentClock.slot + 1n,
  //     currentClock.epochStartTimestamp,
  //     currentClock.epoch,
  //     currentClock.leaderScheduleEpoch,
  //     currentClock.unixTimestamp
  //   )
  // );

  lookupTable = await this.banksClient.getAccount(lookupTableAddress);

  console.log(lookupTable);
  let acc2 = new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(lookupTable.data),
  });

  console.log(proposal);

  const messageV0 = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: (proposalTx as any).instructions,
  }).compileToV0Message([acc2]);

  console.log(messageV0.addressTableLookups);
  // console.log(messageV0.serialize().length);

  const transactionV0 = new VersionedTransaction(messageV0);

  transactionV0.sign([this.payer]);

  console.log(transactionV0.serialize().length);

  await this.banksClient.processTransaction(transactionV0);

  console.log(await autocratClient.getProposal(proposal));

  // Wait for proposal to be old enough
  const storedProposal = await autocratClient.getProposal(proposal);
  const storedDao = await autocratClient.getDao(dao);
  const slotsToWait = Number(storedDao.slotsPerProposal) + 1;
  await this.advanceBySlots(BigInt(slotsToWait + 100));

  // Get the AMMs and vaults for the proposal
  const { passAmm, failAmm, passBaseMint, passQuoteMint, baseVault, quoteVault, question } = autocratClient.getProposalPdas(
    proposal,
    RAY,
    USDC,
    dao
  );

  // Split tokens in the vaults
  await vaultClient
    .splitTokensIx(question, baseVault, RAY, new BN(10 * 10 ** 9), 2)
    .rpc();
  await vaultClient
    .splitTokensIx(question, quoteVault, USDC, new BN(10_000 * 1_000_000), 2)
    .rpc();

  // Swap in the pass market to make it pass
  await ammClient
    .swapIx(
      passAmm,
      passBaseMint,
      passQuoteMint,
      { buy: {} },
      new BN(1000).muln(1_000_000), // Swap $1 worth
      new BN(0)
    )
    .rpc();

  // Crank the TWAP multiple times to ensure good price data
  for (let i = 0; i < 50; i++) {
    await this.advanceBySlots(20_000n);

    await ammClient
      .crankThatTwapIx(passAmm)
      .preInstructions([
        // this is to get around bankrun thinking we've processed the same transaction multiple times
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: i,
        }),
        await ammClient.crankThatTwapIx(failAmm).instruction(),
      ])
      .rpc();
  }

  // Finalize the proposal
  await autocratClient.finalizeProposal(proposal);

  // Check if proposal passed and execute if it did
  const updatedProposal = await autocratClient.getProposal(proposal);
  console.log(updatedProposal);
  // if (updatedProposal.state.passed) {
  await autocratClient.executeProposalIx(proposal, dao, updatedProposal.instruction).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 })]).signers([contractKeypair]).rpc();
  // }

  // transactionV0.sign([(this.payer as any).payer as any]);

  // this.banksClient.sendRawTransaction(transactionV0.serialize());

  // console.log(transactionV0.serialize().length);



  // Execute the proposal
  // await autocratClient.executeProposal(proposal);
}

