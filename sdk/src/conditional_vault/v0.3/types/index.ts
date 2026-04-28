import {
  ConditionalVault as ConditionalVaultProgram,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";
export { ConditionalVaultProgram, ConditionalVaultIDL };

import type { IdlAccounts } from "@coral-xyz/anchor";

export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];
