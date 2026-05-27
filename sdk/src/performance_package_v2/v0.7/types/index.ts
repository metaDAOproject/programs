import { IdlAccounts, IdlEvents, IdlTypes } from "@coral-xyz/anchor";
import {
  PerformancePackageV2 as PerformancePackageV2Program,
  IDL as PerformancePackageV2IDL,
} from "./performance_package_v2.js";
export { PerformancePackageV2Program, PerformancePackageV2IDL };

export type PerformancePackageV2Account =
  IdlAccounts<PerformancePackageV2Program>["performancePackage"];
export type PerformancePackageV2ChangeRequestAccount =
  IdlAccounts<PerformancePackageV2Program>["changeRequest"];
export type PerformancePackageV2OracleReader =
  IdlTypes<PerformancePackageV2Program>["OracleReader"];
export type PerformancePackageV2RewardFunction =
  IdlTypes<PerformancePackageV2Program>["RewardFunction"];
export type PerformancePackageV2PackageStatus =
  IdlTypes<PerformancePackageV2Program>["PackageStatus"];
export type PerformancePackageV2ThresholdTranche =
  IdlTypes<PerformancePackageV2Program>["ThresholdTranche"];

// Event aliases are prefixed because several event names (UnlockStartedEvent,
// UnlockCompletedEvent, ChangeProposedEvent, ChangeExecutedEvent) collide with
// the v1 `price_based_performance_package` module, which also re-exports them
// unqualified from the package root.
export type PerformancePackageV2CreatedEvent =
  IdlEvents<PerformancePackageV2Program>["PerformancePackageCreatedEvent"];
export type PerformancePackageV2UnlockStartedEvent =
  IdlEvents<PerformancePackageV2Program>["UnlockStartedEvent"];
export type PerformancePackageV2UnlockCompletedEvent =
  IdlEvents<PerformancePackageV2Program>["UnlockCompletedEvent"];
export type PerformancePackageV2AuthorityChangedEvent =
  IdlEvents<PerformancePackageV2Program>["AuthorityChangedEvent"];
export type PerformancePackageV2ChangeProposedEvent =
  IdlEvents<PerformancePackageV2Program>["ChangeProposedEvent"];
export type PerformancePackageV2ChangeExecutedEvent =
  IdlEvents<PerformancePackageV2Program>["ChangeExecutedEvent"];
export type PerformancePackageV2ClosedEvent =
  IdlEvents<PerformancePackageV2Program>["PerformancePackageClosedEvent"];
export type PerformancePackageV2Event =
  | PerformancePackageV2CreatedEvent
  | PerformancePackageV2UnlockStartedEvent
  | PerformancePackageV2UnlockCompletedEvent
  | PerformancePackageV2AuthorityChangedEvent
  | PerformancePackageV2ChangeProposedEvent
  | PerformancePackageV2ChangeExecutedEvent
  | PerformancePackageV2ClosedEvent;
