import {
  AmmClient,
  AutocratClient,
  getAmmAddr,
  getAmmLpMintAddr,
  getLiquidityPoolAddr,
  getRaydiumCpmmLpMintAddr,
  getRaydiumCpmmObservationStateAddr,
  getRaydiumCpmmPoolVaultAddr,
  LOW_FEE_RAYDIUM_CONFIG,
  RAYDIUM_AUTHORITY,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  SharedLiquidityManagerClient,
  getSharedLiquidityPoolAddr,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  getProposalAddr,
  ConditionalVaultClient,
  InstructionUtils,
  getDaoTreasuryAddr,
  getEventAuthorityAddr,
  getSharedLiquidityPoolSignerAddr,
  getDraftProposalAddr,
  getStakeRecordAddr,
  getSpotPoolAddr,
} from "@metadaoproject/futarchy/v0.4";
import { AddressLookupTableAccount, AddressLookupTableProgram, ComputeBudgetProgram, Keypair, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
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
import { IDL } from "../../fixtures/raydium_cpmm.js";
import { sha256 } from "@metadaoproject/futarchy";

export default async function () {
  const ammClient = this.ammClient;
  const autocratClient = this.autocratClient;
  const vaultClient = this.vaultClient;
  const sharedLiquidityManagerClient = this.sharedLiquidityManagerClient;
  const cpSwap = new anchor.Program(IDL, new PublicKey(RAYDIUM_CP_SWAP_PROGRAM_ID));

  // First, set up tokens and a DAO

  const META = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    9
  );
  const USDC = await createMint(
    this.banksClient,
    this.payer,
    this.payer.publicKey,
    this.payer.publicKey,
    6
  );

  await this.createTokenAccount(META, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 100_000 * 10 ** 6);

  const dao = await autocratClient.initializeDao(META, 1000, 10, 10_000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));

  // Second, set up a shared liquidity pool

  await sharedLiquidityManagerClient.initializeSharedLiquidityPoolIx(dao, META, USDC, new BN(25 * 10 ** 9), new BN(25_000 * 10 ** 6)).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })]).rpc();

  const [slPool] = getSharedLiquidityPoolAddr(
    sharedLiquidityManagerClient.getProgramId(),
    dao,
    this.payer.publicKey,
    100
  );

  const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
    sharedLiquidityManagerClient.getProgramId(),
    slPool
  );

  const storedSlPool = await sharedLiquidityManagerClient.program.account.sharedLiquidityPool.fetch(slPool);

  // Third, initialize a draft proposal

  await sharedLiquidityManagerClient.initializeDraftProposalIx(slPool, META, {
    programId: META,
    accounts: [],
    data: Buffer.from([])
  }, new BN(1338)).rpc();

  const [draftProposal] = getDraftProposalAddr(
    sharedLiquidityManagerClient.getProgramId(),
    new BN(1338)
  );

  let storedDraftProposal = await sharedLiquidityManagerClient.program.account.draftProposal.fetch(draftProposal);
  assert.equal(storedDraftProposal.stakedTokenAmount.toString(), "0");

  // Fourth, stake to the draft proposal

  await sharedLiquidityManagerClient.stakeToDraftProposalIx(draftProposal, META, new BN(1_000_000_000)).rpc();

  storedDraftProposal = await sharedLiquidityManagerClient.program.account.draftProposal.fetch(draftProposal);

  const [stakeRecord] = getStakeRecordAddr(
    sharedLiquidityManagerClient.getProgramId(),
    draftProposal,
    this.payer.publicKey
  );
  const storedStakeRecord = await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(stakeRecord);

  assert.equal(storedStakeRecord.staker.toString(), this.payer.publicKey.toString());
  assert.equal(storedStakeRecord.amount.toString(), 1_000_000_000n.toString());
  assert.equal(storedDraftProposal.stakedTokenAmount.toString(), 1_000_000_000n.toString());

  // Fifth, initialize a proposal with liquidity

  const nonce = new BN(12329);

  let [proposal] = getProposalAddr(
    AUTOCRAT_PROGRAM_ID,
    slPoolSigner,
    nonce
  );

  await vaultClient.initializeQuestion(
    sha256(`Will ${proposal} pass?/FAIL/PASS`),
    proposal,
    2
  );

  const {
    passAmm,
    failAmm,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
    passLp,
    failLp,
    question,
  } = autocratClient.getProposalPdas(
    proposal,
    META,
    USDC,
    dao
  );

  const storedDao = await autocratClient.fetchDao(dao);

  await vaultClient
    .initializeVaultIx(question, META, 2)
    .postInstructions(
      await InstructionUtils.getInstructions(
        vaultClient.initializeVaultIx(question, USDC, 2),
        ammClient.initializeAmmIx(
          passBaseMint,
          passQuoteMint,
          storedDao.twapStartDelaySlots,
          storedDao.twapInitialObservation,
          storedDao.twapMaxObservationChangePerUpdate
        ),
        ammClient.initializeAmmIx(
          failBaseMint,
          failQuoteMint,
          storedDao.twapStartDelaySlots,
          storedDao.twapInitialObservation,
          storedDao.twapMaxObservationChangePerUpdate
        )
      )
    )
    .rpc();

  let initProposalWithLiquidityTx = await sharedLiquidityManagerClient.initializeProposalWithLiquidityIx(
    dao,
    META,
    USDC,
    nonce,
    draftProposal
  ).transaction();

  const slot = await this.banksClient.getSlot();
  const [createTableIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    recentSlot: slot - 1n,
  });

  const accountsToAdd = initProposalWithLiquidityTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
  const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];

  // Create the lookup table first
  let createLutTx = new Transaction().add(createTableIx);
  createLutTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  createLutTx.feePayer = this.payer.publicKey;
  createLutTx.sign(this.payer);

  await this.banksClient.processTransaction(createLutTx);

  await this.advanceBySlots(1n);

  // Extend the lookup table with all unique accounts
  // Raydium allows up to 20 addresses per extend instruction
  const addressesPerExtend = 20;
  for (let i = 0; i < uniqueAccounts.length; i += addressesPerExtend) {
    const batch = uniqueAccounts.slice(i, i + addressesPerExtend);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: this.payer.publicKey,
      payer: this.payer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: batch,
    });

    let extendLutTx = new Transaction().add(extendTableIx);
    extendLutTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    extendLutTx.feePayer = this.payer.publicKey;
    extendLutTx.sign(this.payer);

    await this.banksClient.processTransaction(extendLutTx);
    await this.advanceBySlots(1n);
  }

  console.log("UNIQUE ACCOUNTS", uniqueAccounts.length);


  // Create and process second extension transaction
  const extendTableIx2 = AddressLookupTableProgram.extendLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: [ComputeBudgetProgram.programId],
  });

  let lutTx2 = new Transaction().add(extendTableIx2);
  lutTx2.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  lutTx2.feePayer = this.payer.publicKey;
  lutTx2.sign(this.payer);

  await this.banksClient.processTransaction(lutTx2);

  await this.advanceBySlots(1n);

  let rawStoredLookupTable = await this.banksClient.getAccount(lookupTableAddress);

  let storedLookupTable = new AddressLookupTableAccount({
    key: lookupTableAddress,
    state: AddressLookupTableAccount.deserialize(rawStoredLookupTable.data),
  });

  const messageV0 = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
    ].concat(initProposalWithLiquidityTx.instructions)
  }).compileToV0Message([storedLookupTable]);


  console.log("messageV0", messageV0);

  let tx = new VersionedTransaction(messageV0);
  tx.sign([this.payer]);

  const [daoTreasury] = getDaoTreasuryAddr(AUTOCRAT_PROGRAM_ID, dao);

  await this.createTokenAccount(passLp, daoTreasury, true);
  await this.createTokenAccount(failLp, daoTreasury, true);

  console.log("tx size", tx.serialize().length);

  await this.banksClient.processTransaction(tx);

  await this.advanceBySlots(DAY_IN_SLOTS);

  // Crank TWAPs multiple times to ensure markets are mature enough
  // The markets need to have been updated for at least proposal.duration_in_slots
  for (let i = 0; i < 50; i++) {
    await this.advanceBySlots(20_000n);

    await ammClient
      .crankThatTwapIx(passAmm)
      .preInstructions([
        // Add compute unit price to avoid bankrun thinking we've processed the same transaction multiple times
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: i,
        }),
        await ammClient.crankThatTwapIx(failAmm).instruction(),
      ])
      .rpc();
  }

  // Finalize the proposal with a pass outcome
  await autocratClient.finalizeProposal(proposal);

  // Test unstaking from the draft proposal
  const initialStakerBalance = (await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(META, this.payer.publicKey))).amount;
  
  await sharedLiquidityManagerClient.unstakeFromDraftProposalIx(draftProposal, META, new BN(500_000_000)).rpc();

  const updatedStakeRecord = await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(stakeRecord);
  const updatedDraftProposal = await sharedLiquidityManagerClient.program.account.draftProposal.fetch(draftProposal);
  const finalStakerBalance = (await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(META, this.payer.publicKey))).amount;

  assert.equal(updatedStakeRecord.amount.toString(), 500_000_000n.toString());
  assert.equal(updatedDraftProposal.stakedTokenAmount.toString(), 500_000_000n.toString());
  assert.equal(finalStakerBalance, initialStakerBalance + 500_000_000n);

  // Remove proposal liquidity
  let removeProposalLiquidityTx = await sharedLiquidityManagerClient.removeProposalLiquidityIx(
    dao,
    storedSlPool.activeSpotPool,
    META,
    USDC,
    nonce
  ).transaction();

  // Create a new lookup table for the remove liquidity transaction
  const slot2 = await this.banksClient.getSlot();
  const [createTableIx2, lookupTableAddress2] = AddressLookupTableProgram.createLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    recentSlot: slot2 - 1n,
  });

  const removeAccountsToAdd = removeProposalLiquidityTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
  const removeUniqueAccounts = [...new Set(removeAccountsToAdd.flat())] as PublicKey[];

  // Create the lookup table first
  let createLutTx2 = new Transaction().add(createTableIx2);
  createLutTx2.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  createLutTx2.feePayer = this.payer.publicKey;
  createLutTx2.sign(this.payer);

  await this.banksClient.processTransaction(createLutTx2);

  await this.advanceBySlots(1n);

  // Extend the lookup table with all unique accounts
  // Raydium allows up to 20 addresses per extend instruction
  const addressesPerExtend2 = 20;
  for (let i = 0; i < removeUniqueAccounts.length; i += addressesPerExtend2) {
    const batch = removeUniqueAccounts.slice(i, i + addressesPerExtend2);

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      authority: this.payer.publicKey,
      payer: this.payer.publicKey,
      lookupTable: lookupTableAddress2,
      addresses: batch,
    });

    let extendLutTx = new Transaction().add(extendTableIx);
    extendLutTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
    extendLutTx.feePayer = this.payer.publicKey;
    extendLutTx.sign(this.payer);

    await this.banksClient.processTransaction(extendLutTx);
    await this.advanceBySlots(1n);
  }

  console.log("REMOVE UNIQUE ACCOUNTS", removeUniqueAccounts.length);

  // Create and process second extension transaction for ComputeBudgetProgram
  const extendTableIx3 = AddressLookupTableProgram.extendLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    lookupTable: lookupTableAddress2,
    addresses: [ComputeBudgetProgram.programId],
  });

  let lutTx3 = new Transaction().add(extendTableIx3);
  lutTx3.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  lutTx3.feePayer = this.payer.publicKey;
  lutTx3.sign(this.payer);

  await this.banksClient.processTransaction(lutTx3);

  await this.advanceBySlots(1n);

  let rawStoredLookupTable2 = await this.banksClient.getAccount(lookupTableAddress2);

  let storedLookupTable2 = new AddressLookupTableAccount({
    key: lookupTableAddress2,
    state: AddressLookupTableAccount.deserialize(rawStoredLookupTable2.data),
  });

  const messageV0Remove = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
    ].concat(removeProposalLiquidityTx.instructions)
  }).compileToV0Message([storedLookupTable2]);

  let removeTx = new VersionedTransaction(messageV0Remove);
  removeTx.sign([this.payer]);
  console.log("removeTx size", removeTx.serialize().length);
  await this.banksClient.processTransaction(removeTx);

  const spotPool1 = getSpotPoolAddr(
    sharedLiquidityManagerClient.getProgramId(),
    1
  )[0];


  const storedSpotPool1 = await cpSwap.account.poolState.fetch(spotPool1);
  console.log(storedSpotPool1);

  console.log(await getAccount(this.banksClient, storedSpotPool1.token0Vault));
  console.log(await getAccount(this.banksClient, storedSpotPool1.token1Vault));
}
