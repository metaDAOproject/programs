import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { FUTARCHY_PROGRAM_ID } from "@metadaoproject/futarchy/v0.7";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export default function suite() {
  let META: PublicKey, USDC: PublicKey, dao: PublicKey;

  beforeEach(async function () {
    META = await this.createMint(this.payer.publicKey, 6);
    USDC = await this.createMint(this.payer.publicKey, 6);

    // Mint extra tokens for test (on top of what setupBasicDaoWithLiquidity mints)
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 1000 * 10 ** 6);
    await this.mintTo(META, this.payer.publicKey, this.payer, 1000 * 10 ** 6);

    dao = await this.setupBasicDaoWithLiquidity({
      baseMint: META,
      quoteMint: USDC,
    });
  });

  it("allows providing additional liquidity to existing position", async function () {
    // Derive ammPosition PDA
    const [ammPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_PROGRAM_ID,
    );

    // Fetch position before
    const positionBefore =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);

    // Call provideLiquidityIx to add more liquidity
    // maxBaseAmount needs buffer for rounding (add 1% or more)
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(10 * 10 ** 6),
        maxBaseAmount: new BN(11 * 10 ** 6),
        minLiquidity: new BN(1),
        positionAuthority: this.payer.publicKey,
        liquidityProvider: this.payer.publicKey,
      })
      .rpc();

    // Fetch position after
    const positionAfter =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);

    // Assert liquidity increased
    assert.isTrue(positionAfter.liquidity.gt(positionBefore.liquidity));

    // Assert position_authority unchanged
    assert.isTrue(
      positionAfter.positionAuthority.equals(positionBefore.positionAuthority),
    );
    assert.isTrue(positionAfter.positionAuthority.equals(this.payer.publicKey));
  });

  it("prevents attacker from overwriting victim's position authority", async function () {
    // Create attacker keypair
    const attacker = Keypair.generate();

    // Fund attacker with META and USDC
    await this.mintTo(META, attacker.publicKey, this.payer, 100 * 10 ** 6);
    await this.mintTo(USDC, attacker.publicKey, this.payer, 100 * 10 ** 6);

    // Derive ammPosition PDA using victim's pubkey
    const [ammPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_PROGRAM_ID,
    );

    // Fetch position before attack
    const positionBefore =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);

    // Attacker calls provideLiquidityIx with positionAuthority=victim, liquidityProvider=attacker
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(10 * 10 ** 6),
        maxBaseAmount: new BN(11 * 10 ** 6),
        minLiquidity: new BN(1),
        positionAuthority: this.payer.publicKey, // victim
        liquidityProvider: attacker.publicKey, // attacker
      })
      .signers([attacker])
      .rpc();

    // Fetch position after attack
    const positionAfter =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);

    // Assert position_authority is still victim (not overwritten to attacker)
    assert.isTrue(positionAfter.positionAuthority.equals(this.payer.publicKey));
    assert.isFalse(positionAfter.positionAuthority.equals(attacker.publicKey));

    // Assert liquidity increased (attacker's liquidity was added)
    assert.isTrue(positionAfter.liquidity.gt(positionBefore.liquidity));
  });

  it("victim can still withdraw after attacker's hijack attempt", async function () {
    // Create attacker keypair
    const attacker = Keypair.generate();

    // Fund attacker with META and USDC
    await this.mintTo(META, attacker.publicKey, this.payer, 100 * 10 ** 6);
    await this.mintTo(USDC, attacker.publicKey, this.payer, 100 * 10 ** 6);

    // Derive ammPosition PDA using victim's pubkey (payer is the victim)
    const [ammPositionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        this.payer.publicKey.toBuffer(),
      ],
      FUTARCHY_PROGRAM_ID,
    );

    // Attacker calls provideLiquidityIx attempting hijack
    await this.futarchy
      .provideLiquidityIx({
        dao,
        baseMint: META,
        quoteMint: USDC,
        quoteAmount: new BN(10 * 10 ** 6),
        maxBaseAmount: new BN(11 * 10 ** 6),
        minLiquidity: new BN(1),
        positionAuthority: this.payer.publicKey, // victim
        liquidityProvider: attacker.publicKey, // attacker
      })
      .signers([attacker])
      .rpc();

    // Get victim's token balances before withdrawal
    const victimBaseBalanceBefore = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    const victimQuoteBalanceBefore = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );

    // Fetch position to get current liquidity
    const position =
      await this.futarchy.autocrat.account.ammPosition.fetch(ammPositionPda);

    // Derive event authority
    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      FUTARCHY_PROGRAM_ID,
    );

    // Victim withdraws all liquidity
    await this.futarchy.autocrat.methods
      .withdrawLiquidity({
        liquidityToWithdraw: position.liquidity,
        minBaseAmount: new BN(0),
        minQuoteAmount: new BN(0),
      })
      .accounts({
        dao,
        positionAuthority: this.payer.publicKey,
        liquidityProviderBaseAccount: getAssociatedTokenAddressSync(
          META,
          this.payer.publicKey,
          true,
        ),
        liquidityProviderQuoteAccount: getAssociatedTokenAddressSync(
          USDC,
          this.payer.publicKey,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(META, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(USDC, dao, true),
        ammPosition: ammPositionPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        eventAuthority,
        program: FUTARCHY_PROGRAM_ID,
      })
      .rpc();

    // Get victim's token balances after withdrawal
    const victimBaseBalanceAfter = await this.getTokenBalance(
      META,
      this.payer.publicKey,
    );
    const victimQuoteBalanceAfter = await this.getTokenBalance(
      USDC,
      this.payer.publicKey,
    );

    // Assert victim received tokens back
    assert.isTrue(victimBaseBalanceAfter > victimBaseBalanceBefore);
    assert.isTrue(victimQuoteBalanceAfter > victimQuoteBalanceBefore);
  });
}
