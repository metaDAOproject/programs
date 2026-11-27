import type { Amm as AmmProgram } from "./amm.js";
import ammIdl from "./amm.json" with { type: "json" };
export type { AmmProgram };
export const AmmIDL = ammIdl as AmmProgram;

import type { IdlAccounts, IdlEvents } from "@anchor-lang/core";

export type Amm = IdlAccounts<AmmProgram>["amm"];

export type SwapEvent = IdlEvents<AmmProgram>["swapEvent"];
export type AddLiquidityEvent = IdlEvents<AmmProgram>["addLiquidityEvent"];
export type RemoveLiquidityEvent =
  IdlEvents<AmmProgram>["removeLiquidityEvent"];
export type CreateAmmEvent = IdlEvents<AmmProgram>["createAmmEvent"];
export type CrankThatTwapEvent = IdlEvents<AmmProgram>["crankThatTwapEvent"];
export type AmmEvent =
  | SwapEvent
  | AddLiquidityEvent
  | RemoveLiquidityEvent
  | CreateAmmEvent
  | CrankThatTwapEvent;
