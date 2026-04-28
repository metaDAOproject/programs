import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import type { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";

export type Amm = IdlAccounts<AmmProgram>["amm"];

export type SwapEvent = IdlEvents<AmmProgram>["SwapEvent"];
export type AddLiquidityEvent = IdlEvents<AmmProgram>["AddLiquidityEvent"];
export type RemoveLiquidityEvent =
  IdlEvents<AmmProgram>["RemoveLiquidityEvent"];
export type CreateAmmEvent = IdlEvents<AmmProgram>["CreateAmmEvent"];
export type CrankThatTwapEvent = IdlEvents<AmmProgram>["CrankThatTwapEvent"];
export type AmmEvent =
  | SwapEvent
  | AddLiquidityEvent
  | RemoveLiquidityEvent
  | CreateAmmEvent
  | CrankThatTwapEvent;
