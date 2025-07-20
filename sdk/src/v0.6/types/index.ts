import { Autocrat as AutocratProgram } from "./autocrat.js";
export { AutocratProgram };

import { ConditionalVault as ConditionalVaultProgram } from "./conditional_vault.js";
export { ConditionalVaultProgram };

export { LowercaseKeys } from "./utils.js";

import type { IdlAccounts, IdlTypes, IdlEvents } from "@coral-xyz/anchor";

export type Question = IdlAccounts<ConditionalVaultProgram>["question"];
export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["initializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["updateDaoParams"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];
export type Side = IdlTypes<AutocratProgram>["side"];

export type AddMetadataToConditionalTokensEvent =
  IdlEvents<ConditionalVaultProgram>["addMetadataToConditionalTokensEvent"];
export type InitializeConditionalVaultEvent =
  IdlEvents<ConditionalVaultProgram>["initializeConditionalVaultEvent"];
export type InitializeQuestionEvent =
  IdlEvents<ConditionalVaultProgram>["initializeQuestionEvent"];
export type MergeTokensEvent =
  IdlEvents<ConditionalVaultProgram>["mergeTokensEvent"];
export type RedeemTokensEvent =
  IdlEvents<ConditionalVaultProgram>["redeemTokensEvent"];
export type ResolveQuestionEvent =
  IdlEvents<ConditionalVaultProgram>["resolveQuestionEvent"];
export type SplitTokensEvent =
  IdlEvents<ConditionalVaultProgram>["splitTokensEvent"];
export type ConditionalVaultEvent =
  | AddMetadataToConditionalTokensEvent
  | InitializeConditionalVaultEvent
  | InitializeQuestionEvent
  | MergeTokensEvent
  | RedeemTokensEvent
  | ResolveQuestionEvent
  | SplitTokensEvent;

export type InitializeDaoEvent =
  IdlEvents<AutocratProgram>["initializeDaoEvent"];
export type UpdateDaoEvent = IdlEvents<AutocratProgram>["updateDaoEvent"];
export type InitializeProposalEvent =
  IdlEvents<AutocratProgram>["initializeProposalEvent"];
export type FinalizeProposalEvent =
  IdlEvents<AutocratProgram>["finalizeProposalEvent"];
export type ExecuteProposalEvent =
  IdlEvents<AutocratProgram>["executeProposalEvent"];
export type AutocratEvent =
  | InitializeDaoEvent
  | UpdateDaoEvent
  | InitializeProposalEvent
  | FinalizeProposalEvent
  | ExecuteProposalEvent;
