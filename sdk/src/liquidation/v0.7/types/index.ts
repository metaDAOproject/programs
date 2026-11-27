import { IdlAccounts } from "@anchor-lang/core";

import type { Liquidation as LiquidationProgram } from "./liquidation.js";
import liquidationIdl from "./liquidation.json" with { type: "json" };
export type { LiquidationProgram };
export const LiquidationIDL = liquidationIdl as LiquidationProgram;

export type LiquidationAccount = IdlAccounts<LiquidationProgram>["liquidation"];
export type RefundRecordAccount =
  IdlAccounts<LiquidationProgram>["refundRecord"];
