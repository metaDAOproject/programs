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
  getSlPoolPositionAddr,
} from "@metadaoproject/futarchy/v0.5";
import {
  PublicKey,
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import {
  createLookupTableForTransaction,
  DAY_IN_SLOTS,
  expectError,
} from "../../utils.js";
import { sha256 } from "@metadaoproject/futarchy";
import * as anchor from "@coral-xyz/anchor";

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
  let proposalNonce: anchor.BN;
  let proposal: PublicKey;

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
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
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

    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool
    );
    proposalNonce = new BN(Math.floor(Math.random() * 1000000));
    [proposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      slPoolSigner,
      proposalNonce
    );

    // Initialize question
    await vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    // Get proposal PDAs
    const {
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
  });

  it("initializes proposal with liquidity successfully", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(
      META,
      proposalCreator.publicKey,
      this.payer,
      100 * 10 ** 9
    );

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
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: proposalCreator.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: new PublicKey("11111111111111111111111111111111"),
              isSigner: false,
              isWritable: false,
            },
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

    // Setup required for initializeProposalWithLiquidity
    // Create lookup table for the transaction
    let initProposalWithLiquidityTx: Transaction =
      await sharedLiquidityManagerClient
        .initializeProposalWithLiquidityIx(
          dao,
          META,
          USDC,
          proposalNonce,
          draftProposal
        )
        .transaction();

    const lookupTable = await createLookupTableForTransaction(
      initProposalWithLiquidityTx,
      this
    );
    console.log("lookupTable", lookupTable);
    return;

    // Create and send the versioned transaction
    const messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initProposalWithLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);

    let tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    // Check that the draft proposal status was updated
    const draftProposalAccount =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.exists(draftProposalAccount.status.initialized);

    // Check that the shared liquidity pool was updated
    const finalSlPool = await sharedLiquidityManagerClient.getSlPool(slPool);
    assert.isNotNull(finalSlPool.activeProposal);
  });

  it("fails when stake threshold not met", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(
      META,
      proposalCreator.publicKey,
      this.payer,
      100 * 10 ** 9
    );

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
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: proposalCreator.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: new PublicKey("11111111111111111111111111111111"),
              isSigner: false,
              isWritable: false,
            },
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
    const callbacks = expectError(
      "InsufficientStake",
      "Should have thrown error for insufficient stake"
    );

    let initializeProposalWithLiquidityTx = await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        proposalNonce,
        draftProposal
      )
      .transaction();

    const lookupTable = await createLookupTableForTransaction(
      initializeProposalWithLiquidityTx,
      this
    );

    let messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initializeProposalWithLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);

    let tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isTrue(
      result.meta.logMessages.some((log: string) =>
        log.includes("InsufficientStake")
      ),
      "Expected at least one log message to contain 'InsufficientStake'"
    );
  });

  it("fails when draft proposal is not in draft status", async function () {
    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(
      META,
      proposalCreator.publicKey,
      this.payer,
      100 * 10 ** 9
    );

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
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: proposalCreator.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: new PublicKey("11111111111111111111111111111111"),
              isSigner: false,
              isWritable: false,
            },
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

    let initializeProposalWithLiquidityTx = await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        proposalNonce,
        draftProposal
      )
      .transaction();

    let lookupTable = await createLookupTableForTransaction(
      initializeProposalWithLiquidityTx,
      this
    );

    let messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initializeProposalWithLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);
    let tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    await this.banksClient.processTransaction(tx);

    await this.advanceBySlots(DAY_IN_SLOTS);

    let { passAmm, failAmm } = autocratClient.getProposalPdas(
      proposal,
      META,
      USDC,
      dao
    );

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

    let removeProposalLiquidityTx = await sharedLiquidityManagerClient
      .removeProposalLiquidityIx(
        dao,
        spotPool,
        META,
        USDC,
        proposalNonce,
        100,
        0
      )
      .transaction();

    lookupTable = await createLookupTableForTransaction(
      removeProposalLiquidityTx,
      this
    );

    const messageV0Remove = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(removeProposalLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);

    let removeTx = new VersionedTransaction(messageV0Remove);
    removeTx.sign([this.payer]);
    await this.banksClient.processTransaction(removeTx);

    proposalNonce = new BN(Math.floor(Math.random() * 1000000));
    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool
    );

    [proposal] = getProposalAddr(
      AUTOCRAT_PROGRAM_ID,
      slPoolSigner,
      proposalNonce
    );

    // Initialize question
    await vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    // Get proposal PDAs
    const {
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

    initializeProposalWithLiquidityTx = await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        proposalNonce,
        draftProposal,
        1
      )
      .transaction();

    lookupTable = await createLookupTableForTransaction(
      initializeProposalWithLiquidityTx,
      this
    );

    messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initializeProposalWithLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);
    tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isTrue(
      result.meta.logMessages.some((log: string) =>
        log.includes("ProposalNotInDraftStatus")
      ),
      "Expected at least one log message to contain 'ProposalNotInDraftStatus'"
    );
  });

  it("fails when no LP tokens in pool", async function () {
    const [slPoolPosition] = getSlPoolPositionAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool,
      this.payer.publicKey
    );

    const slPoolPositionAccount =
      await sharedLiquidityManagerClient.getSlPoolPosition(slPoolPosition);
    // console.log("slPoolPositionAccount", slPoolPositionAccount);
    // return;

    await sharedLiquidityManagerClient
      .withdrawSharedLiquidityIx(
        slPool,
        spotPool,
        META,
        USDC,
        slPoolPositionAccount.underlyingSpotLpShares,
        new BN(0),
        new BN(0)
      )
      .rpc();

    const proposalCreator = Keypair.generate();
    await this.createTokenAccount(META, proposalCreator.publicKey);
    await this.mintTo(
      META,
      proposalCreator.publicKey,
      this.payer,
      100 * 10 ** 9
    );

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
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: true,
            },
            {
              pubkey: proposalCreator.publicKey,
              isSigner: true,
              isWritable: false,
            },
            {
              pubkey: Keypair.generate().publicKey,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: new PublicKey("11111111111111111111111111111111"),
              isSigner: false,
              isWritable: false,
            },
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

    const initializeProposalWithLiquidityTx = await sharedLiquidityManagerClient
      .initializeProposalWithLiquidityIx(
        dao,
        META,
        USDC,
        proposalNonce,
        draftProposal
      )
      .transaction();

    const lookupTable = await createLookupTableForTransaction(
      initializeProposalWithLiquidityTx,
      this
    );

    let messageV0 = new TransactionMessage({
      payerKey: this.payer.publicKey,
      recentBlockhash: (await this.banksClient.getLatestBlockhash())[0],
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 256 * 1024 }),
      ].concat(initializeProposalWithLiquidityTx.instructions),
    }).compileToV0Message([lookupTable]);
    let tx = new VersionedTransaction(messageV0);
    tx.sign([this.payer]);

    const result = await this.banksClient.tryProcessTransaction(tx);
    assert.isTrue(
      result.meta.logMessages.some((log: string) =>
        log.includes("NoLpTokensInPool")
      ),
      "Expected at least one log message to contain 'NoLpTokensInPool'"
    );
  });
}
