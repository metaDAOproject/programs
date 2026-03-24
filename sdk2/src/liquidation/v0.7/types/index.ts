import { IdlAccounts } from "@coral-xyz/anchor";

import {
  Liquidation as LiquidationProgram,
  IDL as LiquidationIDL,
} from "./liquidation.js";

export { LiquidationProgram, LiquidationIDL };

export type LiquidationAccount = IdlAccounts<LiquidationProgram>["liquidation"];
export type RefundRecordAccount =
  IdlAccounts<LiquidationProgram>["refundRecord"];
