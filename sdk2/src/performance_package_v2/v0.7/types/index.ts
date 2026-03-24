import { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
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
