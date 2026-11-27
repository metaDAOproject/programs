import { IdlAccounts, IdlEvents, IdlTypes } from "@anchor-lang/core";
import type { PerformancePackageV2 as PerformancePackageV2Program } from "./performance_package_v2.js";
import performancePackageV2Idl from "./performance_package_v2.json" with { type: "json" };
export type { PerformancePackageV2Program };
export const PerformancePackageV2IDL =
  performancePackageV2Idl as PerformancePackageV2Program;

export type PerformancePackageV2Account =
  IdlAccounts<PerformancePackageV2Program>["performancePackage"];
export type PerformancePackageV2ChangeRequestAccount =
  IdlAccounts<PerformancePackageV2Program>["changeRequest"];
export type PerformancePackageV2OracleReader =
  IdlTypes<PerformancePackageV2Program>["oracleReader"];
export type PerformancePackageV2RewardFunction =
  IdlTypes<PerformancePackageV2Program>["rewardFunction"];
export type PerformancePackageV2PackageStatus =
  IdlTypes<PerformancePackageV2Program>["packageStatus"];
export type PerformancePackageV2ThresholdTranche =
  IdlTypes<PerformancePackageV2Program>["thresholdTranche"];

// Event aliases are prefixed because several event names (UnlockStartedEvent,
// UnlockCompletedEvent, ChangeProposedEvent, ChangeExecutedEvent) collide with
// the v1 `price_based_performance_package` module, which also re-exports them
// unqualified from the package root.
export type PerformancePackageV2CreatedEvent =
  IdlEvents<PerformancePackageV2Program>["performancePackageCreatedEvent"];
export type PerformancePackageV2UnlockStartedEvent =
  IdlEvents<PerformancePackageV2Program>["unlockStartedEvent"];
export type PerformancePackageV2UnlockCompletedEvent =
  IdlEvents<PerformancePackageV2Program>["unlockCompletedEvent"];
export type PerformancePackageV2AuthorityChangedEvent =
  IdlEvents<PerformancePackageV2Program>["authorityChangedEvent"];
export type PerformancePackageV2ChangeProposedEvent =
  IdlEvents<PerformancePackageV2Program>["changeProposedEvent"];
export type PerformancePackageV2ChangeExecutedEvent =
  IdlEvents<PerformancePackageV2Program>["changeExecutedEvent"];
export type PerformancePackageV2ClosedEvent =
  IdlEvents<PerformancePackageV2Program>["performancePackageClosedEvent"];
export type PerformancePackageV2Event =
  | PerformancePackageV2CreatedEvent
  | PerformancePackageV2UnlockStartedEvent
  | PerformancePackageV2UnlockCompletedEvent
  | PerformancePackageV2AuthorityChangedEvent
  | PerformancePackageV2ChangeProposedEvent
  | PerformancePackageV2ChangeExecutedEvent
  | PerformancePackageV2ClosedEvent;
