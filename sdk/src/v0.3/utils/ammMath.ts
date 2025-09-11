import BN from "bn.js";
import { AmmAccount } from "../types/index.js";
import { SwapType } from "../AmmClient.js";

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
  public static getHumanPriceFromReserves(
    baseReserves: BN,
    quoteReserves: BN,
    baseDecimals: number,
    quoteDecimals: number
  ): number {
    return this.getHumanPrice(
      this.getAmmPriceFromReserves(baseReserves, quoteReserves),
      baseDecimals,
      quoteDecimals
    );
  }

  public static getAmmPriceFromReserves(
    baseReserves: BN,
    quoteReserves: BN
  ): BN {
    return quoteReserves.mul(PRICE_SCALE).div(baseReserves);
  }

  public static getChainAmount(humanAmount: number, decimals: number): BN {
    // you have to do it this weird way because BN can't be constructed with
    // numbers larger than 2**50
    const [integerPart, fractionalPart = ""] = humanAmount
      .toString()
      .split(".");
    return new BN(integerPart + fractionalPart)
      .mul(new BN(10).pow(new BN(decimals)))
      .div(new BN(10).pow(new BN(fractionalPart.length)));
  }

  public static getHumanAmount(chainAmount: BN, decimals: number): number {
    return chainAmount.toNumber() / 10 ** decimals;
  }

  public static getHumanPrice(
    ammPrice: BN,
    baseDecimals: number,
    quoteDecimals: number
  ): number {
    let decimalScalar = BN_TEN.pow(new BN(quoteDecimals - baseDecimals).abs());

    let price1e12 =
      quoteDecimals > baseDecimals
        ? ammPrice.div(decimalScalar)
        : ammPrice.mul(decimalScalar);

    return price1e12.toNumber() / 1e12;
  }

  public static getAmmPrice(
    humanPrice: number,
    baseDecimals: number,
    quoteDecimals: number
  ): BN {
    let price1e12 = new BN(humanPrice * PRICE_SCALE_NUMBER);

    let decimalScalar = BN_TEN.pow(new BN(quoteDecimals - baseDecimals).abs());

    let scaledPrice =
      quoteDecimals > baseDecimals
        ? price1e12.mul(decimalScalar)
        : price1e12.div(decimalScalar);

    return scaledPrice;
  }

  public static getAmmPrices(
    baseDecimals: number,
    quoteDecimals: number,
    ...prices: number[]
  ): BN[] {
    // Map through each price, scaling it using the scalePrice method
    return prices.map((price) =>
      this.getAmmPrice(price, baseDecimals, quoteDecimals)
    );
  }

  public static scale(number: number, decimals: number): BN {
    return new BN(number * 10 ** decimals);
    // return new BN(number).mul(new BN(10).pow(new BN(decimals)));
  }

  public static addSlippage(chainAmount: BN, slippageBps: BN): BN {
    return chainAmount.mul(slippageBps.addn(10_000)).divn(10_000);
  }

  public static subtractSlippage(chainAmount: BN, slippageBps: BN): BN {
    return chainAmount.mul(new BN(10_000).sub(slippageBps)).divn(10_000);
  }

  public static getTwap(amm: AmmAccount): BN {
    return amm.oracle.aggregator.div(
      amm.oracle.lastUpdatedSlot.sub(amm.createdAtSlot)
    );
  }

  public static simulateAddLiquidity(
    baseReserves: BN,
    quoteReserves: BN,
    lpMintSupply: number,
    baseAmount?: BN,
    quoteAmount?: BN,
    slippageBps?: BN
  ): AddLiquiditySimulation {
    if (lpMintSupply == 0) {
      throw new Error(
        "This AMM doesn't have existing liquidity so we can't fill in the blanks"
      );
    }

    if (baseAmount == undefined && quoteAmount == undefined) {
      throw new Error("Must specify either a base amount or a quote amount");
    }

    let expectedLpTokens: BN;

    if (quoteAmount == undefined) {
      quoteAmount = baseAmount?.mul(quoteReserves).div(baseReserves);
    }
    baseAmount = quoteAmount?.mul(baseReserves).div(quoteReserves).addn(1);

    expectedLpTokens = quoteAmount
      ?.mul(new BN(lpMintSupply))
      .div(quoteReserves) as BN;

    let minLpTokens, maxBaseAmount;
    if (slippageBps) {
      minLpTokens = AmmMath.subtractSlippage(expectedLpTokens, slippageBps);
      maxBaseAmount = AmmMath.addSlippage(baseAmount as BN, slippageBps);
    }

    return {
      quoteAmount: quoteAmount as BN,
      baseAmount: baseAmount as BN,
      expectedLpTokens,
      minLpTokens,
      maxBaseAmount,
    };
  }

  public static simulateSwap(
    inputAmount: BN,
    swapType: SwapType,
    baseReserves: BN,
    quoteReserves: BN,
    slippageBps?: BN
  ): SwapSimulation {
    if (baseReserves.eqn(0) || quoteReserves.eqn(0)) {
      throw new Error("reserves must be non-zero");
    }

    let inputReserves, outputReserves: BN;
    if (swapType.buy) {
      inputReserves = quoteReserves;
      outputReserves = baseReserves;
    } else {
      inputReserves = baseReserves;
      outputReserves = quoteReserves;
    }

    let inputAmountWithFee: BN = inputAmount.muln(990);

    let numerator: BN = inputAmountWithFee.mul(outputReserves);
    let denominator: BN = inputReserves.muln(1000).add(inputAmountWithFee);

    let expectedOut = numerator.div(denominator);
    let minExpectedOut;
    if (slippageBps) {
      minExpectedOut = AmmMath.subtractSlippage(expectedOut, slippageBps);
    }

    let newBaseReserves, newQuoteReserves: BN;
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

  public static simulateRemoveLiquidity(
    lpTokensToBurn: BN,
    baseReserves: BN,
    quoteReserves: BN,
    lpTotalSupply: BN,
    slippageBps?: BN
  ): RemoveLiquiditySimulation {
    const expectedBaseOut = lpTokensToBurn.mul(baseReserves).div(lpTotalSupply);
    const expectedQuoteOut = lpTokensToBurn
      .mul(quoteReserves)
      .div(lpTotalSupply);

    let minBaseOut, minQuoteOut;
    if (slippageBps) {
      minBaseOut = AmmMath.subtractSlippage(expectedBaseOut, slippageBps);
      minQuoteOut = AmmMath.subtractSlippage(expectedQuoteOut, slippageBps);
    }

    return {
      expectedBaseOut,
      expectedQuoteOut,
      minBaseOut,
      minQuoteOut,
    };
  }
}

// Add backwards compatibility alias
export { AmmMath as PriceMath };
