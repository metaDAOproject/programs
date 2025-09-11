import BN from "bn.js";
import { Amm } from "../types/index.js";
import { SwapType } from "../AmmClient.js";
import { AmmMath as V3AmmMath } from "../../v0.3/utils/ammMath.js";

const BN_TEN = new BN(10);
const PRICE_SCALE = BN_TEN.pow(new BN(12));
const PRICE_SCALE_NUMBER = 1e12;

export type AddLiquiditySimulation = {
  baseAmount: BN;
  quoteAmount: BN;
  expectedLpTokens: BN;
  minLpTokens?: BN;
  maxBaseAmount?: BN;
};

export type SwapSimulation = {
  expectedOut: BN;
  newBaseReserves: BN;
  newQuoteReserves: BN;
  minExpectedOut?: BN;
};

export type RemoveLiquiditySimulation = {
  expectedBaseOut: BN;
  expectedQuoteOut: BN;
  minBaseOut?: BN;
  minQuoteOut?: BN;
};

export class AmmMath {
  // Re-export common methods from v0.3
  public static getHumanPriceFromReserves = V3AmmMath.getHumanPriceFromReserves;
  public static getAmmPriceFromReserves = V3AmmMath.getAmmPriceFromReserves;
  public static getChainAmount = V3AmmMath.getChainAmount;
  public static getHumanAmount = V3AmmMath.getHumanAmount;
  public static getAmmPrice = V3AmmMath.getAmmPrice;
  public static getAmmPrices = V3AmmMath.getAmmPrices;
  public static scale = V3AmmMath.scale;
  public static addSlippage = V3AmmMath.addSlippage;
  public static subtractSlippage = V3AmmMath.subtractSlippage;
  public static simulateAddLiquidity = V3AmmMath.simulateAddLiquidity;
  public static simulateRemoveLiquidity = V3AmmMath.simulateRemoveLiquidity;

  public static getHumanPrice(
    ammPrice: BN,
    baseDecimals: number,
    quoteDecimals: number
  ): number {
    const decimalScalar = BN_TEN.pow(
      new BN(quoteDecimals - baseDecimals).abs()
    );
    const price1e12 =
      quoteDecimals > baseDecimals
        ? ammPrice.div(decimalScalar)
        : ammPrice.mul(decimalScalar);

    // in case the BN is too large to cast to number, we try
    try {
      return price1e12.toNumber() / 1e12;
    } catch (e) {
      // BN tried to cast into number larger than 53 bits so we we do division via BN methods first, then cast to number(so it is smaller before the cast)
      return price1e12.div(new BN(1e12)).toNumber();
    }
  }

  public static getTwap(amm: Amm): BN {
    return amm.oracle.aggregator.div(
      amm.oracle.lastUpdatedSlot.sub(amm.createdAtSlot)
    );
  }

  public static simulateSwapInner(
    inputAmount: BN,
    inputReserves: BN,
    outputReserves: BN
  ): BN {
    if (inputReserves.eqn(0) || outputReserves.eqn(0)) {
      throw new Error("reserves must be non-zero");
    }

    let inputAmountWithFee: BN = inputAmount.muln(990);

    let numerator: BN = inputAmountWithFee.mul(outputReserves);
    let denominator: BN = inputReserves.muln(1000).add(inputAmountWithFee);

    return numerator.div(denominator);
  }

  public static simulateSwap(
    inputAmount: BN,
    swapType: SwapType,
    baseReserves: BN,
    quoteReserves: BN,
    slippageBps?: BN
  ): SwapSimulation {
    let inputReserves: BN, outputReserves: BN;
    if (swapType.buy) {
      inputReserves = quoteReserves;
      outputReserves = baseReserves;
    } else {
      inputReserves = baseReserves;
      outputReserves = quoteReserves;
    }

    let expectedOut = this.simulateSwapInner(
      inputAmount,
      inputReserves,
      outputReserves
    );

    let minExpectedOut;
    if (slippageBps) {
      minExpectedOut = AmmMath.subtractSlippage(expectedOut, slippageBps);
    }

    let newBaseReserves: BN, newQuoteReserves: BN;
    if (swapType.buy) {
      newBaseReserves = baseReserves.sub(expectedOut);
      newQuoteReserves = quoteReserves.add(inputAmount);
    } else {
      newBaseReserves = baseReserves.add(inputAmount);
      newQuoteReserves = quoteReserves.sub(expectedOut);
    }

    return {
      expectedOut,
      newBaseReserves,
      newQuoteReserves,
      minExpectedOut,
    };
  }

  /**
   * Calculates the optimal swap amount and mergeable tokens without using square roots.
   * @param userBalanceIn BN – Tokens that a user wants to dispose of.
   * @param ammReserveIn BN – Amount of tokens in the AMM of the token that the user wants to dispose of.
   * @param ammReserveOut BN – Amount of tokens in the AMM of the token that the user wants to receive.
   * @returns An object containing the optimal swap amount, expected quote received, and expected mergeable tokens.
   */

  public static calculateOptimalSwapForMerge(
    userBalanceIn: BN,
    ammReserveIn: BN,
    ammReserveOut: BN,
    slippageBps: BN
  ): {
    optimalSwapAmount: BN;
    userInAfterSwap: BN;
    expectedOut: BN;
    minimumExpectedOut: BN;
  } {
    // essentially, we want to calculate the swap amount so that the remaining user balance = received token amount

    // solve this system of equations for swapAmount, outputAmount (we only care about swap amount tho)
    // (baseReserve + swapAmount) * (quoteReserve - outputAmount) = baseReserve * quoteReserve
    // baseAmount - swapAmount = outputAmount

    //solve equation
    // (baseReserve + .99*swapAmount) * (quoteReserve - (userTokens - swapAmount)) = baseReserve * quoteReserve
    // multiplying out the left hand side and subtracting baseReserve * quoteReserve from both sides yields the following:
    // baseReserve*quoteReserve - baseReserve*userTokens + baseReserve*swapAmount + .99*swapAmount*quoteReserve - .99*swapAmount*userTokens + .99*swapAmount^2 = baseReserve*quoteReserve
    // .99*swapAmount^2 + baseReserve*swapAmount + .99*swapAmount*quoteReserve - baseReserve*userTokens - .99*swapAmount*userTokens = 0
    // in the quadratic equation, a = .99, b = (baseReserve + .99*quoteReserve - .99*userTokens), c = -baseReserve*userTokens
    // x = (-b + sqrt(b^2 - 4ac)) / 2a

    let a = 0.99;
    let b =
      Number(ammReserveIn) +
      0.99 * Number(ammReserveOut) -
      0.99 * Number(userBalanceIn);
    let c = -Number(ammReserveIn) * Number(userBalanceIn);

    let x = (-b + Math.sqrt(b ** 2 - 4 * a * c)) / (2 * a);
    //this should mathematically return a positive number assuming userBalanceIn, ammReserveIn, and ammReserveOut are all positive (which they should be)
    // -b + Math.sqrt(b ** 2 - 4 * a * c) > 0 because -4*a*c > 0 and sqrt(b**2 + positive number) > b

    const swapAmount = x;

    let expectedOut = this.simulateSwapInner(
      new BN(swapAmount),
      ammReserveIn,
      ammReserveOut
    );
    let minimumExpectedOut =
      Number(expectedOut) - (Number(expectedOut) * Number(slippageBps)) / 10000;
    return {
      optimalSwapAmount: new BN(swapAmount),
      userInAfterSwap: new BN(Number(userBalanceIn) - swapAmount),
      expectedOut: expectedOut,
      minimumExpectedOut: new BN(minimumExpectedOut),
    };
  }
}

// Add backwards compatibility alias
export { AmmMath as PriceMath };
