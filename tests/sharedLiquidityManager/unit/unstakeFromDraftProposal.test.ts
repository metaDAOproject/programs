import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getDraftProposalAddr,
  getStakeRecordAddr,
  getSharedLiquidityPoolAddr,
} from "@metadaoproject/futarchy/v0.4";
import { PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import * as token from "@solana/spl-token";
import { DAY_IN_SLOTS, expectError } from "../../utils.js";

export default function suite() {
  let sharedLiquidityManagerClient: SharedLiquidityManagerClient;
  let autocratClient: AutocratClient;
  let META: PublicKey;
  let USDC: PublicKey;
  let dao: PublicKey;
  let slPool: PublicKey;
  let draftProposal: PublicKey;

  before(async function () {
    sharedLiquidityManagerClient = this.sharedLiquidityManagerClient;
    autocratClient = this.autocratClient;
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

    // Initialize common components
    dao = await autocratClient.initializeDao(
      META,
      1000,
      10,
      10_000,
      USDC,
      undefined,
      new BN(DAY_IN_SLOTS.toString())
    );

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

    [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );

    const nonce = new BN(Math.floor(Math.random() * 1000000));
    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(
        slPool,
        META,
        {
          programId: META,
          accounts: [],
          data: Buffer.from([]),
        },
        nonce
      )
      .rpc();

    [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );
  });

  it("unstakes partial amount from draft proposal", async function () {
    // Stake initial tokens
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, new BN(5_000_000_000)) // 5 META
      .rpc();

    const unstakeAmount = new BN(2_000_000_000); // 2 META
    const remainingStake = new BN(3_000_000_000); // 3 META

    const initialBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    await sharedLiquidityManagerClient
      .unstakeFromDraftProposalIx(draftProposal, META, unstakeAmount)
      .rpc();

    // Check stake record updated
    const [stakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const storedStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        stakeRecord
      );
    assert.equal(
      storedStakeRecord.amount.toString(),
      remainingStake.toString()
    );

    // Check draft proposal updated
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(
      storedDraftProposal.stakedTokenAmount.toString(),
      remainingStake.toString()
    );

    // Check user balance increased
    const finalBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    assert.equal(
      Number(finalBalance),
      Number(initialBalance) + Number(unstakeAmount)
    );
  });

  it("unstakes full amount from draft proposal", async function () {
    // Stake initial tokens
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, new BN(5_000_000_000)) // 5 META
      .rpc();

    const unstakeAmount = new BN(5_000_000_000); // All 5 META

    const initialBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    await sharedLiquidityManagerClient
      .unstakeFromDraftProposalIx(draftProposal, META, unstakeAmount)
      .rpc();

    // Check stake record updated to zero
    const [stakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const storedStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        stakeRecord
      );
    assert.equal(storedStakeRecord.amount.toString(), "0");

    // Check draft proposal updated to zero
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(storedDraftProposal.stakedTokenAmount.toString(), "0");

    // Check user balance increased by full amount
    const finalBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    assert.equal(
      Number(finalBalance),
      Number(initialBalance) + Number(unstakeAmount)
    );
  });

  it("fails when unstaking more than staked", async function () {
    // Stake initial tokens
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, new BN(5_000_000_000)) // 5 META
      .rpc();

    const unstakeAmount = new BN(6_000_000_000); // More than the 5 META staked

    const callbacks = expectError(
      "InsufficientStake",
      "should fail with insufficient stake"
    );

    await sharedLiquidityManagerClient
      .unstakeFromDraftProposalIx(draftProposal, META, unstakeAmount)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("handles unstaking when multiple users have staked", async function () {
    // Stake initial tokens from first user
    const firstUserStake = new BN(5_000_000_000); // 5 META
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, firstUserStake)
      .rpc();

    // Create second user and have them stake
    const secondUser = Keypair.generate();
    await this.createTokenAccount(META, secondUser.publicKey);
    await this.mintTo(META, secondUser.publicKey, this.payer, 10 * 10 ** 9);

    const secondUserStake = new BN(3_000_000_000); // 3 META
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        secondUserStake,
        secondUser.publicKey
      )
      .signers([secondUser])
      .rpc();

    // Record initial balances
    const firstUserInitialBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    const secondUserInitialBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, secondUser.publicKey)
      )
    ).amount;

    // First user unstakes partially
    const firstUserUnstakeAmount = new BN(2_000_000_000); // 2 META
    await sharedLiquidityManagerClient
      .unstakeFromDraftProposalIx(draftProposal, META, firstUserUnstakeAmount)
      .rpc();

    // Second user unstakes partially
    const secondUserUnstakeAmount = new BN(1_000_000_000); // 1 META
    await sharedLiquidityManagerClient
      .unstakeFromDraftProposalIx(
        draftProposal,
        META,
        secondUserUnstakeAmount,
        secondUser.publicKey
      )
      .signers([secondUser])
      .rpc();

    // Check first user's stake record
    const [firstStakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const storedFirstStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        firstStakeRecord
      );
    assert.equal(storedFirstStakeRecord.amount.toString(), "3000000000"); // 3 META remaining (5 - 2)

    // Check second user's stake record
    const [secondStakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      secondUser.publicKey
    );

    const storedSecondStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        secondStakeRecord
      );
    assert.equal(storedSecondStakeRecord.amount.toString(), "2000000000"); // 2 META remaining (3 - 1)

    // Check total in draft proposal (3 + 2 = 5 META)
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(
      storedDraftProposal.stakedTokenAmount.toString(),
      "5000000000"
    );

    // Check first user's balance increased
    const firstUserFinalBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    assert.equal(
      Number(firstUserFinalBalance),
      Number(firstUserInitialBalance) + Number(firstUserUnstakeAmount)
    );

    // Check second user's balance increased
    const secondUserFinalBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, secondUser.publicKey)
      )
    ).amount;

    assert.equal(
      Number(secondUserFinalBalance),
      Number(secondUserInitialBalance) + Number(secondUserUnstakeAmount)
    );
  });
}
