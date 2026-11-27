import type { ConditionalVault as ConditionalVaultProgram } from "./conditional_vault.js";
import conditionalVaultIdl from "./conditional_vault.json" with { type: "json" };
export type { ConditionalVaultProgram };
export const ConditionalVaultIDL =
  conditionalVaultIdl as ConditionalVaultProgram;

import type { IdlAccounts, IdlEvents } from "@anchor-lang/core";

export type Question = IdlAccounts<ConditionalVaultProgram>["question"];
export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];

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
