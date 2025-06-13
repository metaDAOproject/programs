import sharedLiquidityManagerLifecycle from "./integration/sharedLiquidityManagerLifecycle.test.js";

// TODO add a many-outcome integration test
export default function suite() {
  it.only("shared liquidity manager lifecycle", sharedLiquidityManagerLifecycle);
}
