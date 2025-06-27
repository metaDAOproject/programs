import {
  SharedLiquidityManagerClient,
  AutocratClient,
  getDraftProposalAddr,
  getSharedLiquidityPoolAddr,
} from "@metadaoproject/futarchy/v0.5";
import { PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { createMint } from "spl-token-bankrun";
import { BN } from "bn.js";
import { DAY_IN_SLOTS } from "../../utils.js";

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

    // Initialize DAO and shared liquidity pool
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

  it("initializes draft proposal with simple instruction", async function () {
    const nonce = new BN(1337);
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

    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );

    assert.ok(storedDraftProposal.sharedLiquidityPool.equals(slPool));
    assert.ok(storedDraftProposal.baseMint.equals(META));
    assert.equal(storedDraftProposal.stakedTokenAmount.toString(), "0");
    assert.equal(storedDraftProposal.nonce.toString(), nonce.toString());
    assert.exists(storedDraftProposal.status.draft);
  });

  it("initializes draft proposal with complex instruction", async function () {
    const complexInstruction = {
      programId: META,
      accounts: [
        { pubkey: META, isSigner: false, isWritable: true },
        { pubkey: USDC, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([1, 2, 3, 4, 5]),
    };

    const nonce = new BN(2468);
    await sharedLiquidityManagerClient
      .initializeDraftProposalIx(slPool, META, complexInstruction, nonce)
      .rpc();

    const [draftProposal] = getDraftProposalAddr(
      sharedLiquidityManagerClient.getProgramId(),
      nonce
    );

    const storedDraftProposal =
      await sharedLiquidityManagerClient.program.account.draftProposal.fetch(
        draftProposal
      );

    assert.ok(storedDraftProposal.instruction.programId.equals(META));
    assert.equal(storedDraftProposal.instruction.accounts.length, 2);
    assert.deepEqual(
      Array.from(storedDraftProposal.instruction.data),
      [1, 2, 3, 4, 5]
    );
  });

  it("fails with duplicate nonce", async function () {
    const nonce = new BN(3691);

    // First proposal should succeed
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

    // Second proposal with same nonce should fail
    try {
      await sharedLiquidityManagerClient
        .initializeDraftProposalIx(
          slPool,
          META,
          {
            programId: META,
            accounts: [],
            data: Buffer.from([1]),
          },
          nonce
        )
        .rpc();
      assert.fail("Should have thrown error");
    } catch (e) {
      // Should fail due to account already existing
      assert.exists(e);
    }
  });
}
