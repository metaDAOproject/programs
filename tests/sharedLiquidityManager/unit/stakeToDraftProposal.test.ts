import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getDraftProposalAddr,
  getStakeRecordAddr,
  getSharedLiquidityPoolAddr,
} from "@metadaoproject/futarchy/v0.5";
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

    // Initialize DAO
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

    [slPool] = getSharedLiquidityPoolAddr(
      sharedLiquidityManagerClient.getProgramId(),
      dao,
      this.payer.publicKey,
      100
    );
  });

  it("stakes tokens to draft proposal", async function () {
    const nonce = new BN(5001);
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

    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );

    const stakeAmount = new BN(1_000_000_000); // 1 META

    const initialBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, stakeAmount)
      .rpc();

    // Check stake record
    const [stakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const storedStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        stakeRecord
      );
    assert.ok(storedStakeRecord.staker.equals(this.payer.publicKey));
    assert.equal(storedStakeRecord.amount.toString(), stakeAmount.toString());

    // Check draft proposal updated
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(
      storedDraftProposal.stakedTokenAmount.toString(),
      stakeAmount.toString()
    );

    // Check user balance decreased
    const finalBalance = (
      await getAccount(
        this.banksClient,
        token.getAssociatedTokenAddressSync(META, this.payer.publicKey)
      )
    ).amount;

    assert.equal(
      Number(finalBalance),
      Number(initialBalance) - Number(stakeAmount)
    );
  });

  it("allows multiple stakes from same user", async function () {
    const nonce = new BN(5002);
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

    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );

    const firstStake = new BN(500_000_000); // 0.5 META
    const secondStake = new BN(300_000_000); // 0.3 META
    const totalStake = firstStake.add(secondStake);

    // First stake
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, firstStake)
      .rpc();

    // Second stake
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, secondStake)
      .rpc();

    // Check accumulated stake record
    const [stakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const storedStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        stakeRecord
      );
    assert.equal(storedStakeRecord.amount.toString(), totalStake.toString());

    // Check draft proposal total
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(
      storedDraftProposal.stakedTokenAmount.toString(),
      totalStake.toString()
    );
  });

  it("fails with insufficient balance", async function () {
    const nonce = new BN(5003);
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

    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );

    const stakeAmount = new BN(200 * 10 ** 9); // More than user has

    const callbacks = expectError(
      "InsufficientFunds",
      "should fail with insufficient balance"
    );

    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, stakeAmount)
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("allows stakes from multiple users", async function () {
    const nonce = new BN(5004);
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

    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );

    // Create second user
    const secondUser = Keypair.generate();
    await this.createTokenAccount(META, secondUser.publicKey);
    await this.mintTo(META, secondUser.publicKey, this.payer, 10 * 10 ** 9);

    const firstUserStake = new BN(1_000_000_000); // 1 META
    const secondUserStake = new BN(2_000_000_000); // 2 META

    // First user stakes
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(draftProposal, META, firstUserStake)
      .rpc();

    // Second user stakes
    await sharedLiquidityManagerClient
      .stakeToDraftProposalIx(
        draftProposal,
        META,
        secondUserStake,
        secondUser.publicKey
      )
      .signers([secondUser])
      .rpc();

    // Check both stake records exist
    const [firstStakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      this.payer.publicKey
    );

    const [secondStakeRecord] = getStakeRecordAddr(
      sharedLiquidityManagerClient.getProgramId(),
      draftProposal,
      secondUser.publicKey
    );

    const storedFirstStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        firstStakeRecord
      );
    const storedSecondStakeRecord =
      await sharedLiquidityManagerClient.program.account.stakeRecord.fetch(
        secondStakeRecord
      );

    assert.equal(
      storedFirstStakeRecord.amount.toString(),
      firstUserStake.toString()
    );
    assert.equal(
      storedSecondStakeRecord.amount.toString(),
      secondUserStake.toString()
    );

    // Check total in draft proposal
    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );
    assert.equal(
      storedDraftProposal.stakedTokenAmount.toString(),
      firstUserStake.add(secondUserStake).toString()
    );
  });
}
