import BN from "bn.js";
import { DEFAULT_FUNDING_FEE_BPS } from "../constants.js";

export function applyFundingFee(
  amount: BN,
  feeBps: BN = DEFAULT_FUNDING_FEE_BPS,
): { amountAfterFees: BN; totalFees: BN } {
  const numerator = amount.mul(feeBps);

  const totalFees = numerator.div(new BN(10_000));

  const totalFeesRounded = totalFees.mod(new BN(10_000)).gt(new BN(0))
    ? totalFees.add(new BN(1))
    : totalFees;

  return {
    amountAfterFees: amount.add(totalFeesRounded),
    totalFees: totalFeesRounded,
  };
}

export function applyFundingFeeInverse(
  amount: BN,
  feeBps: BN = DEFAULT_FUNDING_FEE_BPS,
): { amountAfterFees: BN; totalFees: BN } {
  const numerator = amount.mul(new BN(10_000));
  const divisor = new BN(10_000).sub(feeBps);

  const amountAfterFees = numerator.div(divisor);

  const amountAfterFeesRounded = numerator.mod(divisor).gt(new BN(0))
    ? amountAfterFees.add(new BN(1))
    : amountAfterFees;

  return {
    amountAfterFees: amountAfterFeesRounded,
    totalFees: amountAfterFeesRounded.sub(amount),
  };
}
