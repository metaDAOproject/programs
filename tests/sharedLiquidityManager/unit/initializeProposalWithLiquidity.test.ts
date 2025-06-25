import {
  SharedLiquidityManagerClient,
  AutocratClient,
  AmmClient,
  ConditionalVaultClient,
  getSharedLiquidityPoolAddr,
  getSpotPoolAddr,
  getDraftProposalAddr,
  getProposalAddr,
  getDaoTreasuryAddr,
  getSharedLiquidityPoolSignerAddr,
  InstructionUtils,
  AMM_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
} from "@metadaoproject/futarchy/v0.4";
import { PublicKey, ComputeBudgetProgram, Keypair, Transaction, AddressLookupTableProgram, TransactionMessage, VersionedTransaction, AddressLookupTableAccount } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError } from "../../utils.js";
import { sha256 } from "@metadaoproject/futarchy";

export default function suite() {
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let autocratClient: AutocratClient;
  let ammClient: AmmClient;
  let vaultClient: ConditionalVaultClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let dao: PublicKey;
  let slPool: PublicKey;
  let spotPool: PublicKey;

  before(async function () {
    sharedLiquidityManagerClient = this.sharedLiquidityManagerClient;
    autocratClient = this.autocratClient;
    ammClient = this.ammClient;
    vaultClient = this.vaultClient;
  });

  beforeEach(async function () {
    // Create fresh test tokens for each test to avoid address collisions
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

    // Create token accounts and mint tokens
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(
      USDC,
      this.payer.publicKey,
      this.payer,
      100_000 * 10 ** 6
    );

    dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    // Initialize shared liquidity pool
    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(
        dao,
        META,
        USDC,
        new BN(25 * 10 ** 9),
        new BN(25_000 * 10 ** 6)
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .rpc();

    // Calculate pool addresses
    [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    [spotPool] = getSpotPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      0
    );
  });

  it("initializes proposal with liquidity successfully", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(META, proposalCreator.publicKey, this.payer, 100 * 10 ** 9);

    // First create a draft proposal
    const draftProposalNonce = new BN(Math.floor(Math.random() * 1000000));
    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposalNonce
    );

    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(
        slPool,
        META,
        {
          programId: autocratClient.getProgramId(),
          accounts: [
            { pubkey: dao, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: proposalCreator.publicKey, isSigner: true, isWritable: false },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
          ],
          data: Buffer.from([]),
        },
        draftProposalNonce
      )
      .rpc();

    // Stake enough tokens to meet threshold
    const stakeAmount = new BN(10 * 10 ** 9); // 10 META tokens
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        stakeAmount,
        proposalCreator.publicKey
      )
      .signers([proposalCreator])
      .rpc();

    // Get initial pool state
    const initialSlPool = await sharedLiquidityManagerClient.getSlPool(slPool);
    const initialBaseBalance = await this.getTokenBalance(META, this.payer.publicKey);
    const initialQuoteBalance = await this.getTokenBalance(USDC, this.payer.publicKey);

    // Setup required for initializeProposalWithLiquidity
    const nonce = new BN(Math.floor(Math.random() * 1000000));
    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool
    );
    const [proposal] = getProposalAddr(AUTOCRAT_PROGRAM_ID, slPoolSigner, nonce);

    // Initialize question
    await vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    // Get proposal PDAs
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
    } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

    const storedDao = await autocratClient.fetchDao(dao);

    // Initialize vaults and AMMs
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


    // Create lookup table for the transaction
    let initProposalWithLiquidityTx: Transaction =
      await sharedLiquidityManagerClient
        .initializeProposalWithLiquidityIx(dao, META, USDC, nonce, draftProposal)
        .transaction();

    const slot = await this.banksClient.getSlot();
    const [createTableIx, lookupTableAddress] =
      AddressLookupTableProgram.createLookupTable({
        authority: this.payer.publicKey,
        payer: this.payer.publicKey,
        recentSlot: slot - 1n,
      });

    const accountsToAdd = initProposalWithLiquidityTx.instructions.map(
      (instruction) => instruction.keys.map((key) => key.pubkey)
    );
    const uniqueAccounts = [...new Set(accountsToAdd.flat())] as PublicKey[];

    // Create the lookup table
    let createLutTx = new Transaction().add(createTableIx);
    createLutTx.recentBlockhash = (
      await this.banksClient.getLatestBlockhash()
    )[0];
    createLutTx.feePayer = this.payer.publicKey;
    createLutTx.sign(this.payer);

    await this.banksClient.processTransaction(createLutTx);
    await this.advanceBySlots(1n);

    // Extend the lookup table with all unique accounts
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
      extendLutTx.recentBlockhash = (
        await this.banksClient.getLatestBlockhash()
      )[0];
      extendLutTx.feePayer = this.payer.publicKey;
      extendLutTx.sign(this.payer);

      await this.banksClient.processTransaction(extendLutTx);
      await this.advanceBySlots(1n);
    }

    // Add ComputeBudgetProgram to lookup table
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

    let rawStoredLookupTable = await this.banksClient.getAccount(
      lookupTableAddress
    );

    let storedLookupTable = new AddressLookupTableAccount({
      key: lookupTableAddress,
      state: AddressLookupTableAccount.deserialize(rawStoredLookupTable.data),
    });

    // Create DAO treasury token accounts for pass/fail LP tokens
    const [daoTreasury] = getDaoTreasuryAddr(AUTOCRAT_PROGRAM_ID, dao);
    await this.createTokenAccount(passLp, daoTreasury);
    await this.createTokenAccount(failLp, daoTreasury);

    // Create and send the versioned transaction
    const messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initProposalWithLiquidityTx.instructions),
    }).compileToV0Message([storedLookupTable]);

    let tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    // Check that the draft proposal status was updated
    const draftProposalAccount = await sharedLiquidityManagerClient.program.account.draftProposal.fetch(draftProposal);
    assert.exists(draftProposalAccount.status.initialized);

    // Check that the shared liquidity pool was updated
    const finalSlPool = await sharedLiquidityManagerClient.getSlPool(slPool);
    assert.isNotNull(finalSlPool.activeProposal);
  });

  it("fails when stake threshold not met", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(META, proposalCreator.publicKey, this.payer, 100 * 10 ** 9);

    // Create a draft proposal
    const draftProposalNonce = new BN(Math.floor(Math.random() * 1000000));
    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposalNonce
    );

    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(
        slPool,
        META,
        {
          programId: autocratClient.getProgramId(),
          accounts: [
            { pubkey: dao, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: proposalCreator.publicKey, isSigner: true, isWritable: false },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
          ],
          data: Buffer.from([]),
        },
        draftProposalNonce
      )
      .rpc();

    // Stake insufficient tokens (less than threshold)
    const stakeAmount = new BN(1 * 10 ** 9); // Only 1 META token
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        stakeAmount,
        proposalCreator.publicKey
      )
      .signers([proposalCreator])
      .rpc();

    // Try to initialize proposal with liquidity
    const nonce = new BN(Math.floor(Math.random() * 1000000));
    const callbacks = expectError(
      "InsufficientStake",
      "Should have thrown error for insufficient stake"
    );

    await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        nonce,
        draftProposal
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when draft proposal is not in draft status", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(META, proposalCreator.publicKey, this.payer, 100 * 10 ** 9);

    // Create a draft proposal
    const draftProposalNonce = new BN(Math.floor(Math.random() * 1000000));
    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposalNonce
    );

    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(
        slPool,
        META,
        {
          programId: autocratClient.getProgramId(),
          accounts: [
            { pubkey: dao, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: proposalCreator.publicKey, isSigner: true, isWritable: false },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
          ],
          data: Buffer.from([]),
        },
        draftProposalNonce
      )
      .rpc();

    // Stake enough tokens
    const stakeAmount = new BN(10 * 10 ** 9);
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        stakeAmount,
        proposalCreator.publicKey
      )
      .signers([proposalCreator])
      .rpc();

    // Initialize proposal with liquidity once
    const nonce1 = new BN(Math.floor(Math.random() * 1000000));
    await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        nonce1,
        draftProposal
      )
      .rpc();

    // Try to initialize again (should fail as status is no longer draft)
    const nonce2 = new BN(Math.floor(Math.random() * 1000000));
    const callbacks = expectError(
      "InvalidDraftProposalStatus",
      "Should have thrown error for invalid draft proposal status"
    );

    await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        nonce2,
        draftProposal
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when no LP tokens in pool", async function () {
    // Create a new pool with no initial liquidity
    const emptyPoolDao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

    const [emptySlPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      emptyPoolDao,
      this.payer.publicKey,
      100
    );

    // Initialize shared liquidity pool with minimal liquidity
    await sharedLiquidityManagerClient
      .initializeSharedLiquidityPoolIx(
        emptyPoolDao,
        META,
        USDC,
        new BN(1), // Minimal base amount
        new BN(1)  // Minimal quote amount
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .rpc();

    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(META, proposalCreator.publicKey, this.payer, 100 * 10 ** 9);

    // Create a draft proposal
    const draftProposalNonce = new BN(Math.floor(Math.random() * 1000000));
    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposalNonce
    );

    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(
        emptySlPool,
        META,
        {
          programId: autocratClient.getProgramId(),
          accounts: [
            { pubkey: emptyPoolDao, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true },
            { pubkey: proposalCreator.publicKey, isSigner: true, isWritable: false },
            { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
          ],
          data: Buffer.from([]),
        },
        draftProposalNonce
      )
      .signers([proposalCreator])
      .rpc();

    // Stake enough tokens
    const stakeAmount = new BN(10 * 10 ** 9);
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        stakeAmount,
        proposalCreator.publicKey
      )
      .signers([proposalCreator])
      .rpc();

    // Try to initialize proposal with liquidity
    const nonce = new BN(Math.floor(Math.random() * 1000000));
    const callbacks = expectError(
      "NoLpTokensInPool",
      "Should have thrown error for no LP tokens in pool"
    );

    await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        emptyPoolDao,
        META,
        USDC,
        nonce,
        draftProposal
      )
      .signers([proposalCreator])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
} 