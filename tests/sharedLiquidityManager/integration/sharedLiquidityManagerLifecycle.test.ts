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
  await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

  // First, set up a DAO

  let dao = await autocratClient.initializeDao(META, 1000, 10, 10_000, USDC, undefined, new BN(DAY_IN_SLOTS.toString()));
  console.log("DAO", dao.toBase58());

  // Second, set up a Raydium spot pool

  const poolStateKp = Keypair.generate();

  const [lpMint] = getRaydiumCpmmLpMintAddr(poolStateKp.publicKey, false);

  console.log("META", META.toBuffer().toString("hex"));
  console.log("USDC", USDC.toBuffer().toString("hex"));
  console.log("META < USDC", META.toBuffer() < USDC.toBuffer());

  // Determine which token should be token0 (smaller address)
  const [token0Mint, token1Mint] = META.toBuffer() < USDC.toBuffer() 
    ? [META, USDC] 
    : [USDC, META];

  const [amount0, amount1] = META.toBuffer() < USDC.toBuffer()
    ? [new BN(10 * 10 ** 9), new BN(1000 * 10 ** 6)]  // META is token0
    : [new BN(1000 * 10 ** 6), new BN(10 * 10 ** 9)]; // USDC is token0

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
  const [pool] = getSharedLiquidityPoolAddr(
    sharedLiquidityManagerClient.getProgramId(),
    dao,
    poolStateKp.publicKey
  );


  // Deposit 10 META and 10,000 USDC
  await sharedLiquidityManagerClient.depositSharedLiquidityIx(
    dao,
    poolStateKp.publicKey,
    META,
    USDC,
    new BN(3162258560), // Let Raydium calculate the LP token amount
    new BN(10 * 10 ** 9), // 10 META
    new BN(10_000 * 10 ** 6) // 10,000 USDC
  ).preInstructions([ComputeBudgetProgram.requestHeapFrame({ bytes: 1024 * 256 })]).rpc();


  const storedUnderlyingPool = await cpSwap.account.poolState.fetch(poolStateKp.publicKey);
  console.log("storedUnderlyingPool", storedUnderlyingPool);
  console.log("token0Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token0Vault));
  console.log("token1Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token1Vault));

  console.log("lp balance", await this.getTokenBalance(lpMint, this.payer.publicKey));

  // Fifth, have a proposer come along and create a proposal through the SharedLiquidityManager

    const nonce = new BN(Math.random() * 2 ** 50);

    let [proposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      pool,
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
  await this.createTokenAccount(passLp, pool, true);
  await this.createTokenAccount(failLp, pool, true);

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
    proposal,
  ).transaction();

  const slot = await this.banksClient.getSlot();
  const [createTableIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    recentSlot: slot - 1n,
  });

  const accountsToAdd = initProposalWithLiquidityTx.instructions.map(instruction => instruction.keys.map(key => key.pubkey));
  const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];


  const extendTableIx = AddressLookupTableProgram.extendLookupTable({
    authority: this.payer.publicKey,
    payer: this.payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: uniqueAccounts.slice(0, 20),
  });

  let lutTx = new Transaction().add(createTableIx, extendTableIx);
  lutTx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  lutTx.feePayer = this.payer.publicKey;
  lutTx.sign(this.payer);

  await this.banksClient.processTransaction(lutTx);

  await this.advanceBySlots(1n);

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
      ComputeBudgetProgram.requestHeapFrame({ bytes: 32 * 1024 }),
    ].concat(initProposalWithLiquidityTx.instructions)
  }).compileToV0Message([storedLookupTable]);


  console.log("messageV0", messageV0);

  let tx = new VersionedTransaction(messageV0);
  tx.sign([this.payer]);



  console.log("tx size", tx.serialize().length);

  await this.banksClient.processTransaction(tx);

  console.log("token0Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token0Vault));
  console.log("token1Vault balance", await getAccount(this.banksClient, storedUnderlyingPool.token1Vault));
  console.log("token0PassMint balance", await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(token0PassMint, pool, true)));
  console.log("token0FailMint balance", await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(token0FailMint, pool, true)));

  // Sixth, someone bids in pass market

  // Seventh, proposal is finalized and passes


  // Eighth, we merge liquidity back into main pool. Check that k has increased
}
