import type { IdlAccounts, IdlEvents } from "@anchor-lang/core";

import type { LaunchpadV7 as LaunchpadProgram } from "./launchpad_v7.js";
import launchpadIdl from "./launchpad_v7.json" with { type: "json" };
export type { LaunchpadProgram };
export const LaunchpadIDL = launchpadIdl as LaunchpadProgram;

export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];

export type LaunchClaimEvent = IdlEvents<LaunchpadProgram>["launchClaimEvent"];
export type LaunchCompletedEvent =
  IdlEvents<LaunchpadProgram>["launchCompletedEvent"];
export type LaunchFundedEvent =
  IdlEvents<LaunchpadProgram>["launchFundedEvent"];
export type LaunchInitializedEvent =
  IdlEvents<LaunchpadProgram>["launchInitializedEvent"];
export type LaunchRefundedEvent =
  IdlEvents<LaunchpadProgram>["launchRefundedEvent"];
export type LaunchStartedEvent =
  IdlEvents<LaunchpadProgram>["launchStartedEvent"];
export type LaunchCloseEvent = IdlEvents<LaunchpadProgram>["launchCloseEvent"];
export type FundingRecordApprovalSetEvent =
  IdlEvents<LaunchpadProgram>["fundingRecordApprovalSetEvent"];
export type LaunchClaimAdditionalTokenAllocationEvent =
  IdlEvents<LaunchpadProgram>["launchClaimAdditionalTokenAllocationEvent"];
export type LaunchPerformancePackageInitializedEvent =
  IdlEvents<LaunchpadProgram>["launchPerformancePackageInitializedEvent"];
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent
  | LaunchCloseEvent
  | FundingRecordApprovalSetEvent
  | LaunchClaimAdditionalTokenAllocationEvent
  | LaunchPerformancePackageInitializedEvent;
