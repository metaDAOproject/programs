import type { Amm as AmmProgram } from "./amm.js";
import ammIdl from "./amm.json" with { type: "json" };
export type { AmmProgram };
export const AmmIDL = ammIdl as AmmProgram;

import type { IdlAccounts } from "@anchor-lang/core";

export type Amm = IdlAccounts<AmmProgram>["amm"];
