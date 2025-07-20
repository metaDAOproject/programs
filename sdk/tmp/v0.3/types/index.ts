import { Autocrat } from "./autocrat.js";
export { Autocrat, IDL as AutocratIDL } from "./autocrat.js";

import { Amm } from "./amm.js";
export { Amm, IDL as AmmIDL } from "./amm.js";

import { ConditionalVault } from "./conditional_vault.js";
export {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";

export { LowercaseKeys } from "./utils.js";

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type InitializeDaoParams = IdlTypes<Autocrat>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<Autocrat>["UpdateDaoParams"];
export type ProposalInstruction = IdlTypes<Autocrat>["ProposalInstruction"];

export type Proposal = IdlAccounts<Autocrat>["proposal"];
export type ProposalWrapper = {
  account: Proposal;
  publicKey: PublicKey;
};

export type DaoAccount = IdlAccounts<Autocrat>["dao"];
export type ProposalAccount = IdlAccounts<Autocrat>["proposal"];

export type AmmAccount = IdlAccounts<Amm>["amm"];

export type ConditionalVaultAccount =
  IdlAccounts<ConditionalVault>["conditionalVault"];
