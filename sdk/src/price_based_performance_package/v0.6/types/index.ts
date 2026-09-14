import { IdlAccounts, IdlEvents, IdlTypes } from "@coral-xyz/anchor";

import {
  PriceBasedPerformancePackage as PriceBasedPerformancePackageProgram,
  IDL as PriceBasedPerformancePackageIDL,
} from "./price_based_performance_package.js";
export { PriceBasedPerformancePackageProgram, PriceBasedPerformancePackageIDL };

export type InitializePerformancePackageParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["InitializePerformancePackageParams"];
export type PerformancePackage =
  IdlAccounts<PriceBasedPerformancePackageProgram>["performancePackage"];
export type OracleConfig =
  IdlTypes<PriceBasedPerformancePackageProgram>["OracleConfig"];
export type Tranche = IdlTypes<PriceBasedPerformancePackageProgram>["Tranche"];
export type WithdrawTokensParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["WithdrawTokensParams"];
export type WithdrawViaSellParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["WithdrawViaSellParams"];
export type WithdrawalPolicy =
  IdlTypes<PriceBasedPerformancePackageProgram>["WithdrawalPolicy"];
export type CappedWithdrawal =
  IdlTypes<PriceBasedPerformancePackageProgram>["CappedWithdrawal"];
export type WithdrawalLimits =
  IdlTypes<PriceBasedPerformancePackageProgram>["WithdrawalLimits"];
export type WindowUsage =
  IdlTypes<PriceBasedPerformancePackageProgram>["WindowUsage"];
export type WithdrawalMode =
  IdlTypes<PriceBasedPerformancePackageProgram>["WithdrawalMode"];
export type LimitsParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["LimitsParams"];
export type InitializePerformancePackageWithLimitsParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["InitializePerformancePackageWithLimitsParams"];

export type PerformancePackageInitializedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["PerformancePackageInitialized"];
export type UnlockStartedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["UnlockStarted"];
export type UnlockCompletedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["UnlockCompleted"];
export type TokensWithdrawnEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["TokensWithdrawn"];
export type TokensSoldEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["TokensSold"];
export type ChangeProposedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["ChangeProposed"];
export type ChangeExecutedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["ChangeExecuted"];
export type PerformancePackageAuthorityChangedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["PerformancePackageAuthorityChanged"];
export type PriceBasedPerformancePackageEvent =
  | PerformancePackageInitializedEvent
  | UnlockStartedEvent
  | UnlockCompletedEvent
  | TokensWithdrawnEvent
  | TokensSoldEvent
  | ChangeProposedEvent
  | ChangeExecutedEvent
  | PerformancePackageAuthorityChangedEvent;
