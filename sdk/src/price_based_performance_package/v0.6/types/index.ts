import { IdlAccounts, IdlEvents, IdlTypes } from "@anchor-lang/core";

import type { PriceBasedPerformancePackage as PriceBasedPerformancePackageProgram } from "./price_based_performance_package.js";
import priceBasedPerformancePackageIdl from "./price_based_performance_package.json" with { type: "json" };
export type { PriceBasedPerformancePackageProgram };
export const PriceBasedPerformancePackageIDL =
  priceBasedPerformancePackageIdl as PriceBasedPerformancePackageProgram;

export type InitializePerformancePackageParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["initializePerformancePackageParams"];
export type PerformancePackage =
  IdlAccounts<PriceBasedPerformancePackageProgram>["performancePackage"];
export type OracleConfig =
  IdlTypes<PriceBasedPerformancePackageProgram>["oracleConfig"];
export type Tranche = IdlTypes<PriceBasedPerformancePackageProgram>["tranche"];
export type WithdrawTokensParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["withdrawTokensParams"];
export type WithdrawViaSellParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["withdrawViaSellParams"];
export type WithdrawalPolicy =
  IdlTypes<PriceBasedPerformancePackageProgram>["withdrawalPolicy"];
export type CappedWithdrawal =
  IdlTypes<PriceBasedPerformancePackageProgram>["cappedWithdrawal"];
export type WithdrawalLimits =
  IdlTypes<PriceBasedPerformancePackageProgram>["withdrawalLimits"];
export type WindowUsage =
  IdlTypes<PriceBasedPerformancePackageProgram>["windowUsage"];
export type WithdrawalMode =
  IdlTypes<PriceBasedPerformancePackageProgram>["withdrawalMode"];
export type LimitsParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["limitsParams"];
export type InitializePerformancePackageWithLimitsParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["initializePerformancePackageWithLimitsParams"];
export type ChangeType =
  IdlTypes<PriceBasedPerformancePackageProgram>["changeType"];
export type ProposeChangeParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["proposeChangeParams"];

export type PerformancePackageInitializedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["performancePackageInitialized"];
export type UnlockStartedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["unlockStarted"];
export type UnlockCompletedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["unlockCompleted"];
export type TokensWithdrawnEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["tokensWithdrawn"];
export type TokensSoldEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["tokensSold"];
export type ChangeProposedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["changeProposed"];
export type ChangeExecutedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["changeExecuted"];
export type PerformancePackageAuthorityChangedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["performancePackageAuthorityChanged"];
export type PriceBasedPerformancePackageEvent =
  | PerformancePackageInitializedEvent
  | UnlockStartedEvent
  | UnlockCompletedEvent
  | TokensWithdrawnEvent
  | TokensSoldEvent
  | ChangeProposedEvent
  | ChangeExecutedEvent
  | PerformancePackageAuthorityChangedEvent;
