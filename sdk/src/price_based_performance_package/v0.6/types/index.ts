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

export type PerformancePackageInitializedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["performancePackageInitialized"];
export type UnlockStartedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["unlockStarted"];
export type UnlockCompletedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["unlockCompleted"];
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
  | ChangeProposedEvent
  | ChangeExecutedEvent
  | PerformancePackageAuthorityChangedEvent;
