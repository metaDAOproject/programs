import { assert } from "chai";
import { Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { advanceBySlots, DAY_IN_SLOTS, toBN } from "../utils.js";
import { AmmMath } from "@metadaoproject/futarchy/v0.4";

export default async function test() {
    // Create META and USDC mints
    const META = await this.createMint(this.payer.publicKey, 9);
    const USDC = await this.createMint(this.payer.publicKey, 6);

    // Create token accounts and mint tokens
    await this.createTokenAccount(META, this.payer.publicKey);
    await this.createTokenAccount(USDC, this.payer.publicKey);
    
    await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
    await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

    // Create AMM with TWAP parameters
    const twapStartDelaySlots = DAY_IN_SLOTS;
    const twapInitialObservation = 500;
    const proposal = Keypair.generate().publicKey;
    const amm = await this.ammClient.createAmm(
        proposal,
        META,
        USDC,
        toBN(twapStartDelaySlots),
        twapInitialObservation
    );

    // Add initial liquidity
    await this.ammClient.addLiquidity(amm, 500, 1);

    // Check initial AMM state
    const initialAmm = await this.ammClient.getAmm(amm);
    const initialLastUpdatedSlot = initialAmm.oracle.lastUpdatedSlot;
    
    // Try to crank before delay - should remain at initial state
    await this.ammClient
        .crankThatTwapIx(amm)
        .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
                units: 100_000,
            }),
        ])
        .rpc();
    
    const ammBeforeDelay = await this.ammClient.getAmm(amm);
    assert.isTrue(
        ammBeforeDelay.oracle.lastUpdatedSlot.eq(initialLastUpdatedSlot),
        "Should not update lastUpdatedSlot before delay"
    );

    // Advance slots to get past the delay period
    await advanceBySlots(this.context, twapStartDelaySlots);
    
    // Crank the TWAP - should update now
    await this.ammClient
        .crankThatTwapIx(amm)
        .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
                units: 100_001,
            }),
        ])
        .rpc();

    // Verify TWAP updated
    const ammAfterDelay = await this.ammClient.getAmm(amm);
    assert.isTrue(
        ammAfterDelay.oracle.lastUpdatedSlot.gt(initialLastUpdatedSlot),
        "TWAP should be updated after delay slots"
    );

    // Get initial TWAP value
    const initialTwap = AmmMath.getTwap(ammAfterDelay);

    // Perform some swaps
    await this.ammClient.swap(amm, { buy: {} }, 200, 0.2);
    await this.ammClient.swap(amm, { sell: {} }, 0.2, 100);
    
    // Advance slots and crank again
    await advanceBySlots(this.context, 150n);
    await this.ammClient
        .crankThatTwapIx(amm)
        .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({
                units: 100_002,
            }),
        ])
        .rpc();

    // Verify TWAP updated
    const ammAfterSwap = await this.ammClient.getAmm(amm);
    assert.isTrue(
        ammAfterSwap.oracle.lastUpdatedSlot.gt(ammAfterDelay.oracle.lastUpdatedSlot),
        "TWAP should update after swap and crank"
    );

    // Verify TWAP value changed after swaps
    const finalTwap = AmmMath.getTwap(ammAfterSwap);
    assert.isTrue(
        !finalTwap.eq(initialTwap),
        "TWAP value should change after swaps and crank"
    );

    // Verify that the TWAP is calculated correctly
    const expectedTwap = ammAfterSwap.oracle.aggregator.div(
        ammAfterSwap.oracle.lastUpdatedSlot.sub(ammAfterSwap.createdAtSlot)
    );
    assert.isTrue(
        finalTwap.eq(expectedTwap),
        "Calculated TWAP should match the expected value"
    );
}