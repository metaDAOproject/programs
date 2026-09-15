import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { FUTARCHY_V0_6_PROGRAM_ID } from "@metadaoproject/programs";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { expectError } from "../../utils.js";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey, ammPosition: PublicKey;

  const [eventAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("__event_authority")],
    FUTARCHY_V0_6_PROGRAM_ID,
  );

  // 1,000 base / 1,000 quote at 6 decimals. The pool's first provision mints
  // quote_amount * 1e9 liquidity, so all pool state is exactly known.
  const INITIAL_BASE = new BN(1_000_000_000);
  const INITIAL_QUOTE = new BN(1_000_000_000);
  const INITIAL_LIQUIDITY = INITIAL_QUOTE.mul(new BN(1_000_000_000));

  function withdrawIx(
    ctx: any,
    {
      liquidityToWithdraw,
      minBaseAmount = new BN(0),
      minQuoteAmount = new BN(0),
      positionAuthority,
      position,
    }: {
      liquidityToWithdraw: typeof BN.prototype;
      minBaseAmount?: typeof BN.prototype;
      minQuoteAmount?: typeof BN.prototype;
      positionAuthority?: PublicKey;
      position?: PublicKey;
    },
  ) {
    const authority = positionAuthority ?? ctx.payer.publicKey;

    return ctx.futarchy.futarchy.methods
      .withdrawLiquidity({
        liquidityToWithdraw,
        minBaseAmount,
        minQuoteAmount,
      })
      .accounts({
        dao,
        positionAuthority: authority,
        liquidityProviderBaseAccount: getAssociatedTokenAddressSync(
          META,
          authority,
          true,
        ),
        liquidityProviderQuoteAccount: getAssociatedTokenAddressSync(
          USDC,
          authority,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(META, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, dao, true),
        ammPosition: position ?? ammPosition,
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_V0_6_PROGRAM_ID,
      });
  }

  async function getSpotPool(ctx: any) {
    const amm = (await ctx.futarchy.getDao(dao)).amm;
    return {
      totalLiquidity: amm.totalLiquidity,
      baseReserves: amm.state.spot.spot.baseReserves,
      quoteReserves: amm.state.spot.spot.quoteReserves,
    };
  }

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    await this.mintTo(META, this.payer.publicKey, this.payer, 1_000 * 10 ** 6);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1_000 * 10 ** 6);

    dao = await this.setupBasicDao({ baseMint: META, quoteMint: USDC });

    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: INITIAL_QUOTE,
        maxBaseAmount: INITIAL_BASE,
      })
      .rpc();

    [ammPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_V0_6_PROGRAM_ID,
    );
  });

  it("withdraws the full position and empties the pool", async function () {
    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY,
      minBaseAmount: INITIAL_BASE,
      minQuoteAmount: INITIAL_QUOTE,
    }).rpc();

    assert.equal(
      await this.getTokenBalance(META, this.payer.publicKey),
      1_000_000_000n,
    );
    assert.equal(
      await this.getTokenBalance(USDC, this.payer.publicKey),
      1_000_000_000n,
    );
    assert.equal(await this.getTokenBalance(META, dao), 0n);
    assert.equal(await this.getTokenBalance(USDC, dao), 0n);

    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(position.liquidity.toString(), "0");

    const { totalLiquidity, baseReserves, quoteReserves } =
      await getSpotPool(this);
    assert.equal(totalLiquidity.toString(), "0");
    assert.equal(baseReserves.toString(), "0");
    assert.equal(quoteReserves.toString(), "0");
  });

  it("withdraws half the position pro rata", async function () {
    const half = INITIAL_LIQUIDITY.divn(2);

    await withdrawIx(this, {
      liquidityToWithdraw: half,
      minBaseAmount: new BN(500_000_000),
      minQuoteAmount: new BN(500_000_000),
    }).rpc();

    assert.equal(
      await this.getTokenBalance(META, this.payer.publicKey),
      500_000_000n,
    );
    assert.equal(
      await this.getTokenBalance(USDC, this.payer.publicKey),
      500_000_000n,
    );
    assert.equal(await this.getTokenBalance(META, dao), 500_000_000n);
    assert.equal(await this.getTokenBalance(USDC, dao), 500_000_000n);

    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(position.liquidity.toString(), half.toString());

    const { totalLiquidity, baseReserves, quoteReserves } =
      await getSpotPool(this);
    assert.equal(totalLiquidity.toString(), half.toString());
    assert.equal(baseReserves.toString(), "500000000");
    assert.equal(quoteReserves.toString(), "500000000");
  });

  it("fails when withdrawing more liquidity than the position holds", async function () {
    const callbacks = expectError(
      "InsufficientBalance",
      "withdraw should fail when exceeding the position's liquidity",
    );

    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY.addn(1),
    })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails when withdrawing zero liquidity", async function () {
    const callbacks = expectError(
      "ZeroLiquidityRemove",
      "withdraw should fail for zero liquidity",
    );

    await withdrawIx(this, { liquidityToWithdraw: new BN(0) })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("fails and reverts state when min base amount is not met", async function () {
    const callbacks = expectError(
      "SwapSlippageExceeded",
      "withdraw should fail when the base payout is below the minimum",
    );

    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY.divn(2),
      minBaseAmount: new BN(500_000_001),
    })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // A slippage failure must revert every mutation made before the check
    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(position.liquidity.toString(), INITIAL_LIQUIDITY.toString());

    const { totalLiquidity, baseReserves, quoteReserves } =
      await getSpotPool(this);
    assert.equal(totalLiquidity.toString(), INITIAL_LIQUIDITY.toString());
    assert.equal(baseReserves.toString(), INITIAL_BASE.toString());
    assert.equal(quoteReserves.toString(), INITIAL_QUOTE.toString());
    assert.equal(await this.getTokenBalance(META, this.payer.publicKey), 0n);
    assert.equal(await this.getTokenBalance(USDC, this.payer.publicKey), 0n);
  });

  it("fails and reverts state when min quote amount is not met", async function () {
    const callbacks = expectError(
      "SwapSlippageExceeded",
      "withdraw should fail when the quote payout is below the minimum",
    );

    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY.divn(2),
      minQuoteAmount: new BN(500_000_001),
    })
      .rpc()
      .then(callbacks[0], callbacks[1]);

    // A slippage failure must revert every mutation made before the check
    const position =
      await this.futarchy.futarchy.account.ammPosition.fetch(ammPosition);
    assert.equal(position.liquidity.toString(), INITIAL_LIQUIDITY.toString());

    const { totalLiquidity, baseReserves, quoteReserves } =
      await getSpotPool(this);
    assert.equal(totalLiquidity.toString(), INITIAL_LIQUIDITY.toString());
    assert.equal(baseReserves.toString(), INITIAL_BASE.toString());
    assert.equal(quoteReserves.toString(), INITIAL_QUOTE.toString());
    assert.equal(await this.getTokenBalance(META, this.payer.publicKey), 0n);
    assert.equal(await this.getTokenBalance(USDC, this.payer.publicKey), 0n);
  });

  it("fails while the pool is in conditional state during a proposal", async function () {
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

    const callbacks = expectError(
      "PoolNotInSpotState",
      "withdraw should fail while the pool is not in spot state",
    );

    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY.divn(2),
    })
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });

  it("prevents an attacker from withdrawing another user's position", async function () {
    const attacker = Keypair.generate();

    // The attacker's own token accounts pass the token constraints, so the
    // position PDA seeds check is what must reject
    await this.mintTo(META, attacker.publicKey, this.payer, 100 * 10 ** 6);
    await this.mintTo(USDC, attacker.publicKey, this.payer, 100 * 10 ** 6);

    const callbacks = expectError(
      "ConstraintSeeds",
      "withdraw should reject a signer that is not the position authority",
    );

    await withdrawIx(this, {
      liquidityToWithdraw: INITIAL_LIQUIDITY.divn(2),
      positionAuthority: attacker.publicKey,
      position: ammPosition, // the victim's position
    })
      .signers([attacker])
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
