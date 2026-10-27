import type { SharedLiquidityManager as SharedLiquidityManagerProgram } from "./shared_liquidity_manager.js";
import sharedLiquidityManagerIdl from "./shared_liquidity_manager.json" with { type: "json" };
export type { SharedLiquidityManagerProgram };
export const SharedLiquidityManagerIDL =
  sharedLiquidityManagerIdl as SharedLiquidityManagerProgram;
