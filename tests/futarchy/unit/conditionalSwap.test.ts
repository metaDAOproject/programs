import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import { expectError, setupBasicDao } from "../../utils.js";
import { BN } from "bn.js";
import { assert } from "chai";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.6";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { ComputeBudget } from "litesvm";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(USDC, this.payer.publicKey, this.payer, 100 * 10 ** 6);
    await this.mintTo(META, this.payer.publicKey, this.payer, 10 * 10 ** 6);

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("does conditional swaps", async function () {
    const { proposal, question, quoteVault, squadsProposal } =
      await this.initializeAndLaunchProposal({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("hello, world"),
          },
        ],
      });

    const { passBaseMint, passQuoteMint, failBaseMint, failQuoteMint } =
      this.futarchy.getProposalPdas(proposal, META, USDC, dao);

    // Split some tokens to have conditional tokens to trade
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(50 * 10 ** 6), 2)
      .rpc();

    const preAmmState = (await this.futarchy.getDao(dao)).amm;

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(10 * 10 ** 6), // 1 USDC
      })
      .rpc();

    const postAmmState = (await this.futarchy.getDao(dao)).amm;
    const postPassQuoteBalance = await this.getTokenBalance(
      passQuoteMint,
      this.payer.publicKey,
    );
    const postPassBaseBalance = await this.getTokenBalance(
      passBaseMint,
      this.payer.publicKey,
    );

    assert.ok(postAmmState.totalLiquidity.eq(preAmmState.totalLiquidity));

    // First check all the fees
    assert.equal(
      postAmmState.state.futarchy.spot.quoteProtocolFeeBalance.toString(),
      "0",
    );
    assert.equal(
      postAmmState.state.futarchy.spot.baseProtocolFeeBalance.toString(),
      "0",
    );
    assert.equal(
      postAmmState.state.futarchy.pass.quoteProtocolFeeBalance.toString(),
      "25000",
    ); // 2.5 cent fee on $100 swap
    assert.equal(
      postAmmState.state.futarchy.pass.baseProtocolFeeBalance.toString(),
      "0",
    );
    assert.equal(
      postAmmState.state.futarchy.fail.quoteProtocolFeeBalance.toString(),
      "0",
    );
    assert.equal(
      postAmmState.state.futarchy.fail.baseProtocolFeeBalance.toString(),
      "0",
    );

    // I ran the math by hand assuming 50k reserves on each side and got these results
    assert.equal(postPassQuoteBalance, 40_000_000n);
    assert.equal(postPassBaseBalance, 9_948_082n);

    // now we do a swap that should trigger arbitrage

    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "fail",
        swapType: "buy",
        inputAmount: new BN(10 * 10 ** 6), // 1 META
      })
      .rpc();

    const postFailQuoteBalance = await this.getTokenBalance(
      failQuoteMint,
      this.payer.publicKey,
    );
    const postFailBaseBalance = await this.getTokenBalance(
      failBaseMint,
      this.payer.publicKey,
    );

    assert.equal(postFailQuoteBalance, 40_000_000n);
    assert.equal(postFailBaseBalance, 9_948_082n + 991n); // extra profit
  });

  it("fails when user has insufficient balance", async function () {
    const { proposal, question, quoteVault, squadsProposal } =
      await this.initializeAndLaunchProposal({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("hello, world"),
          },
        ],
      });

    // Split some tokens to have conditional tokens to trade
    await this.conditionalVault
      .splitTokensIx(question, quoteVault, USDC, new BN(5 * 10 ** 6), 2)
      .rpc();

    const callbacks = expectError(
      "InsufficientBalance",
      "conditional swap should fail with insufficient balance",
    );

    // Try to swap more USDC than we have
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "buy",
        inputAmount: new BN(1000 * 10 ** 6), // 1000 USDC (more than we have)
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when proposal is not in pending state", async function () {
    const { proposal, question, baseVault, squadsProposal } =
      await this.initializeAndLaunchProposal({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("hello, world"),
          },
        ],
      });

    // Split some tokens to have conditional tokens to trade
    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(5 * 10 ** 6), 2)
      .rpc();

    this.advanceBySeconds(60 * 60 * 24 * 3);

    await this.futarchy
      .spotSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        swapType: "buy",
        inputAmount: new BN(100 * 10 ** 6),
      })
      .rpc();

    // Ensure user has USDC token account for input (already created in beforeEach)
    // await this.createTokenAccount(USDC, this.payer.publicKey);

    // Finalize the proposal first
    await this.futarchy
      .finalizeProposalIxV2({
        squadsProposal,
        dao,
        baseMint: META,
        quoteMint: USDC,
      })
      .rpc();

    const callbacks = expectError(
      "ProposalNotActive",
      "conditional swap should fail when proposal is not active",
    );

    // Try to swap after proposal is finalized
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "sell",
        inputAmount: new BN(1 * 10 ** 6),
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("respects minimum output amount", async function () {
    const { proposal, question, baseVault, squadsProposal } =
      await this.initializeAndLaunchProposal({
        dao,
        instructions: [
          {
            programId: MEMO_PROGRAM_ID,
            keys: [],
            data: Buffer.from("hello, world"),
          },
        ],
      });

    // Split some tokens to have conditional tokens to trade
    await this.conditionalVault
      .splitTokensIx(question, baseVault, META, new BN(5 * 10 ** 6), 2)
      .rpc();

    // Ensure user has USDC token account for input (already created in beforeEach)
    // await this.createTokenAccount(USDC, this.payer.publicKey);

    const callbacks = expectError(
      "SwapSlippageExceeded",
      "conditional swap should fail when slippage is too high",
    );

    // Try to swap with an unreasonably high minimum output amount
    await this.futarchy
      .conditionalSwapIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        proposal,
        market: "pass",
        swapType: "sell",
        inputAmount: new BN(1 * 10 ** 6), // 1 META
        minOutputAmount: new BN(1000 * 10 ** 6), // Expect 1000 USDC (unrealistic)
      })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
