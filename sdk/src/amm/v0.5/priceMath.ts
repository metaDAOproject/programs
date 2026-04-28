import BN from "bn.js";
import { PriceMath } from "../../priceMath.js";
import { SwapType } from "./AmmClient.js";

export type SwapSimulation = {
  expectedOut: BN;
  newBaseReserves: BN;
  newQuoteReserves: BN;
  minExpectedOut?: BN;
};

// Only applies to legacy v0.4/v0.5 AMMs (1% fee, simple x*y=k).
// The v0.6+ on-DAO conditional AMM uses different mechanics.
export function simulateSwap(
  inputAmount: BN,
  swapType: SwapType,
  baseReserves: BN,
  quoteReserves: BN,
  slippageBps?: BN,
): SwapSimulation {
  let inputReserves: BN;
  let outputReserves: BN;
  if (swapType.buy) {
    inputReserves = quoteReserves;
    outputReserves = baseReserves;
  } else {
    inputReserves = baseReserves;
    outputReserves = quoteReserves;
  }

  const expectedOut = PriceMath.simulateSwapInner(
    inputAmount,
    inputReserves,
    outputReserves,
  );

  const minExpectedOut = slippageBps
    ? PriceMath.subtractSlippage(expectedOut, slippageBps)
    : undefined;

  let newBaseReserves: BN;
  let newQuoteReserves: BN;
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
