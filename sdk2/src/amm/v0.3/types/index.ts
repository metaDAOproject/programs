import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import type { IdlAccounts } from "@coral-xyz/anchor";

export type Amm = IdlAccounts<AmmProgram>["amm"];
