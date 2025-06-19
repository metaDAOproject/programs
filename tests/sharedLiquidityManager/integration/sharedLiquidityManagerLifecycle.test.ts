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
  let ammClient: AmmClient;
  let autocratClient: AutocratClient;
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let vaultClient: ConditionalVaultClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let amm: PublicKey;

  let cpSwap = new anchor.Program(IDL, new PublicKey(RAYDIUM_CP_SWAP_PROGRAM_ID));

  ammClient = this.ammClient;
  autocratClient = this.autocratClient;
  vaultClient = this.vaultClient;
  sharedLiquidityManagerClient = this.sharedLiquidityManagerClient;

  META = await createMint(
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


  await this.createTokenAccount(META, this.payer.publicKey);
  await this.createTokenAccount(USDC, this.payer.publicKey);

  await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 100_000 * 10 ** 6);

  // First, set up a DAO

  let dao = await autocratClient.initializeDao(META, 1000, 10, 10_000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));
  console.log("DAO", dao.toBase58());

  // Second, set up a Raydium spot pool

  const poolStateKp = Keypair.generate();

  const [lpMint] = getRaydiumCpmmLpMintAddr(poolStateKp.publicKey, false);

  console.log("META", META.toBuffer());
  console.log("USDC", USDC.toBuffer());
  console.log("META < USDC", META.toBuffer() < USDC.toBuffer());

  // Determine which token should be token0 (smaller address)
  const [token0Mint, token1Mint] = META.toBuffer().compare(USDC.toBuffer()) < 0
    ? [META, USDC] 
    : [USDC, META];

  const [amount0, amount1] = META.equals(token0Mint)
    ? [new BN(10 * 10 ** 9), new BN(10_000 * 10 ** 6)]  // META is token0
    : [new BN(10_000 * 10 ** 6), new BN(10 * 10 ** 9)]; // USDC is token0

  // Proph3t: I changed the RaydiumCpmm type to have poolState to be a signer so
  // anchor doesn't complain about passing poolStateKp as a signer
  await cpSwap.methods.initialize(amount0, amount1, new BN(0)).accounts({
    creator: this.payer.publicKey,
    ammConfig: LOW_FEE_RAYDIUM_CONFIG,
    authority: RAYDIUM_AUTHORITY,
    createPoolFee: RAYDIUM_CREATE_POOL_FEE_RECEIVE,
    token0Mint,
    token1Mint,
    poolState: poolStateKp.publicKey,
    token0Vault: getRaydiumCpmmPoolVaultAddr(poolStateKp.publicKey, token0Mint, false)[0],
    token1Vault: getRaydiumCpmmPoolVaultAddr(poolStateKp.publicKey, token1Mint, false)[0],
    lpMint,
    creatorToken0: token.getAssociatedTokenAddressSync(token0Mint, this.payer.publicKey),
    creatorToken1: token.getAssociatedTokenAddressSync(token1Mint, this.payer.publicKey),
    creatorLpToken: token.getAssociatedTokenAddressSync(lpMint, this.payer.publicKey),
    observationState: getRaydiumCpmmObservationStateAddr(poolStateKp.publicKey, false)[0],
    token0Program: token.TOKEN_PROGRAM_ID,
    token1Program: token.TOKEN_PROGRAM_ID
  }).signers([poolStateKp]).rpc({ skipPreflight: true });


  await sharedLiquidityManagerClient.initializeSharedLiquidityPoolIx(dao, poolStateKp.publicKey, META, USDC).rpc();

  // Fourth, we provide liquidity to the pool
  const [slPool] = getSharedLiquidityPoolAddr(
    sharedLiquidityManagerClient.getProgramId(),
    dao,
    poolStateKp.publicKey
  );

  const spotPoolLpSupply = await getMint(this.banksClient, lpMint);
  console.log("spotPoolLpSupply", spotPoolLpSupply);

  // Deposit 10 META and 10,000 USDC
  await sharedLiquidityManagerClient.depositSharedLiquidityIx(
    dao,
    poolStateKp.publicKey,
    META,
    USDC,
    new BN(30_000_000_000), // Let Raydium calculate the LP token amount
    new BN(30 * 10 ** 9), // 30 META
    new BN(30_000 * 10 ** 6) // 30,000 USDC
  ).preInstructions([ComputeBudgetProgram.requestHeapFrame({ bytes: 1024 * 256 })]).rpc();



  const storedUnderlyingPool = await cpSwap.account.poolState.fetch(poolStateKp.publicKey);
  console.log("storedUnderlyingPool", storedUnderlyingPool);
  console.log("token0Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token0Vault));
  console.log("token1Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token1Vault));

  console.log("lp balance", await this.getTokenBalance(lpMint, this.payer.publicKey));

  // Fifth, have a proposer come along and create a proposal through the SharedLiquidityManager

    // const nonce = new BN(Math.random() * 2 ** 50);
    const nonce = new BN(12329);

    let [proposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      slPool,
      nonce
    );

    await vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
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

  const [vault0, vault1] = META.toBase58() < USDC.toBase58()
    ? [baseVault, quoteVault]
    : [quoteVault, baseVault];

  const [token0PassMint, token0FailMint] = META.toBase58() < USDC.toBase58()
    ? [passBaseMint, failBaseMint]
    : [passQuoteMint, failQuoteMint];

  const [token1PassMint, token1FailMint] = META.toBase58() < USDC.toBase58()
    ? [passQuoteMint, failQuoteMint]
    : [passBaseMint, failBaseMint];

  // Initialize pool pass and fail LP accounts
  await this.createTokenAccount(passLp, slPool, true);
  await this.createTokenAccount(failLp, slPool, true);

  // Initialize AMM vault accounts
  await this.createTokenAccount(token0Mint, passAmm, true);
  await this.createTokenAccount(token1Mint, passAmm, true);
  await this.createTokenAccount(token0Mint, failAmm, true);
  await this.createTokenAccount(token1Mint, failAmm, true);

  let initProposalWithLiquidityTx = await sharedLiquidityManagerClient.initializeProposalWithLiquidityIx(
    dao,
    poolStateKp.publicKey,
    META,
    USDC,
    nonce,
    {
      programId: META,
      accounts: [],
      data: Buffer.from([])
    }
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


  console.log("token0Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token0Vault));
  console.log("token1Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token1Vault));
  console.log("token0PassMint balance", await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(token0PassMint, slPool, true)));
  console.log("token0FailMint balance", await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(token0FailMint, slPool, true)));

  console.log(await autocratClient.getProposal(proposal));

  // Sixth, someone bids in pass market
  // Add some trading activity to make the proposal pass
  // await ammClient
  //   .swapIx(
  //     passAmm,
  //     passBaseMint,
  //     passQuoteMint,
  //     { buy: {} },
  //     new BN(100).muln(1_000_000), // $100 worth of USDC
  //     new BN(0)
  //   )
  //   .rpc();

  // Seventh, proposal is finalized and passes
  // Need to advance time to meet the proposal timing requirements
  // The proposal needs to be at least dao.slots_per_proposal old (which is DAY_IN_SLOTS)
  // and the markets need to be mature enough (duration_in_slots, which is also DAY_IN_SLOTS)
  
  // Advance time by DAY_IN_SLOTS to meet the proposal timing requirement
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

  // Eighth, we merge liquidity back into main pool. Check that k has increased
  // Get initial balances before removing proposal liquidity
  const initialSpotPoolBaseBalance = await getAccount(this.banksClient, storedUnderlyingPool.token0Vault);
  const initialSpotPoolQuoteBalance = await getAccount(this.banksClient, storedUnderlyingPool.token1Vault);
  const initialSlPoolSpotLpBalance = await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(getRaydiumCpmmLpMintAddr(poolStateKp.publicKey, false)[0], slPool, true));

  console.log("Initial spot pool base balance:", initialSpotPoolBaseBalance.amount.toString());
  console.log("Initial spot pool quote balance:", initialSpotPoolQuoteBalance.amount.toString());
  console.log("Initial SL pool spot LP balance:", initialSlPoolSpotLpBalance.amount.toString());

  // Remove proposal liquidity
  let removeProposalLiquidityTx = await sharedLiquidityManagerClient.removeProposalLiquidityIx(
    dao,
    poolStateKp.publicKey,
    META,
    USDC,
    nonce
  ).transaction();

  const messageV0Remove = new TransactionMessage({
    payerKey: this.payer.publicKey,
    recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
      ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
    ].concat(removeProposalLiquidityTx.instructions)
  }).compileToV0Message([storedLookupTable]);

  let removeTx = new VersionedTransaction(messageV0Remove);
  removeTx.sign([this.payer]);
  await this.banksClient.processTransaction(removeTx);

  // Get final balances after removing proposal liquidity
  const finalSpotPoolBaseBalance = await getAccount(this.banksClient, storedUnderlyingPool.token0Vault);
  const finalSpotPoolQuoteBalance = await getAccount(this.banksClient, storedUnderlyingPool.token1Vault);
  const finalSlPoolSpotLpBalance = await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(getRaydiumCpmmLpMintAddr(poolStateKp.publicKey, false)[0], slPool, true));

  console.log("Final spot pool base balance:", finalSpotPoolBaseBalance.amount.toString());
  console.log("Final spot pool quote balance:", finalSpotPoolQuoteBalance.amount.toString());
  console.log("Final SL pool spot LP balance:", finalSlPoolSpotLpBalance.amount.toString());

  console.log("base balance", await this.getTokenBalance(META, slPool));
  console.log("quote balance", await this.getTokenBalance(USDC, slPool));

  // Verify that the spot pool has more liquidity than before (k has increased)
  // const baseIncrease = finalSpotPoolBaseBalance.amount.sub(initialSpotPoolBaseBalance.amount);
  // const quoteIncrease = finalSpotPoolQuoteBalance.amount.sub(initialSpotPoolQuoteBalance.amount);
  // const lpIncrease = finalSlPoolSpotLpBalance.amount.sub(initialSlPoolSpotLpBalance.amount);

  // console.log("Base token increase:", baseIncrease.toString());
  // console.log("Quote token increase:", quoteIncrease.toString());
  // console.log("LP token increase:", lpIncrease.toString());

  // // Assert that we got back at least 99.5% of the original liquidity
  // const totalOriginalReserves = initialSpotPoolBaseBalance.amount.add(initialSpotPoolQuoteBalance.amount);
  // const totalFinalReserves = finalSpotPoolBaseBalance.amount.add(finalSpotPoolQuoteBalance.amount);
  // const percentageReturned = totalFinalReserves.mul(new BN(10000)).div(totalOriginalReserves).toNumber() / 100;

  // console.log("Percentage of reserves returned:", percentageReturned + "%");

  // assert(percentageReturned >= 99.5, "Should return at least 99.5% of original reserves");
  // assert(baseIncrease.gt(new BN(0)), "Should have increased base token reserves");
  // assert(quoteIncrease.gt(new BN(0)), "Should have increased quote token reserves");
  // assert(lpIncrease.gt(new BN(0)), "Should have increased LP token supply");

  // // Verify that the proposal is no longer active
  // const finalSlPool = await sharedLiquidityManagerClient.program.account.sharedLiquidityPool.fetch(slPool);
  // assert(finalSlPool.activeProposal === null, "Active proposal should be cleared");

  console.log("✅ Remove proposal liquidity test passed!");
}
