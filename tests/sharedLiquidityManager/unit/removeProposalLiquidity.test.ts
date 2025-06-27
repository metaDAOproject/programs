import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getSharedLiquidityPoolAddr,
  getSpotPoolAddr,
  getDraftProposalAddr,
  getProposalAddr,
  AmmClient,
  ConditionalVaultClient,
  getSharedLiquidityPoolSignerAddr,
  InstructionUtils,
  getDaoTreasuryAddr,
} from "@metadaoproject/futarchy/v0.5";
import { sha256 } from "@metadaoproject/futarchy";
import {
  PublicKey,
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import {
  DAY_IN_SLOTS,
  expectError,
  createLookupTableForTransaction,
} from "../../utils.js";

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
  let proposal: PublicKey;
  let draftProposal: PublicKey;
  let draftProposalNonce;
  let proposalNonce;

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

    // Initialize proposal with liquidity, crank TWAP, and finalize
    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      sharedLiquidityManagerClient.getProgramId(),
      slPool
    );

    draftProposalNonce = new BN(Math.floor(Math.random() * 1000000));
    [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposalNonce
    );

    // Create a draft proposal
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
            { pubkey: this.payer.publicKey, isSigner: true, isWritable: false },
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
    const stakeAmount = new BN(10 * 10 ** 9);
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        stakeAmount,
        this.payer.publicKey
      )
      .rpc();

    // Initialize proposal with liquidity
    proposalNonce = new BN(Math.floor(Math.random() * 1000000));
    [proposal] = getProposalAddr(
      autocratClient.getProgramId(),
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

    // Initialize proposal with liquidity
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

    const [daoTreasury] = getDaoTreasuryAddr(
      autocratClient.getProgramId(),
      dao
    );

    await this.createTokenAccount(passLp, daoTreasury);
    await this.createTokenAccount(failLp, daoTreasury);

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
  });

  it("removes proposal liquidity successfully", async function () {
    // Get initial pool state
    const initialSlPool = await sharedLiquidityManagerClient.getSlPool(slPool);
    assert.isNotNull(initialSlPool.activeProposal);

    // Remove proposal liquidity using lookup table pattern
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

    const lookupTable = await createLookupTableForTransaction(
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

    // Check that the shared liquidity pool was updated
    const finalSlPool = await sharedLiquidityManagerClient.getSlPool(slPool);
    assert.isNull(finalSlPool.activeProposal);
  });
}
