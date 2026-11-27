import type { ConditionalVault as ConditionalVaultProgram } from "./conditional_vault.js";
import conditionalVaultIdl from "./conditional_vault.json" with { type: "json" };
export type { ConditionalVaultProgram };
export const ConditionalVaultIDL =
  conditionalVaultIdl as ConditionalVaultProgram;

import type { IdlAccounts } from "@anchor-lang/core";

export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];
