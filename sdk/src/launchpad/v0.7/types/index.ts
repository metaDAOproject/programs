import type { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";

import {
  LaunchpadV7 as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad_v7.js";
export { LaunchpadProgram, LaunchpadIDL };

export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];

export type LaunchClaimEvent = IdlEvents<LaunchpadProgram>["LaunchClaimEvent"];
export type LaunchCompletedEvent =
  IdlEvents<LaunchpadProgram>["LaunchCompletedEvent"];
export type LaunchFundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchFundedEvent"];
export type LaunchInitializedEvent =
  IdlEvents<LaunchpadProgram>["LaunchInitializedEvent"];
export type LaunchRefundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchRefundedEvent"];
export type LaunchStartedEvent =
  IdlEvents<LaunchpadProgram>["LaunchStartedEvent"];
export type LaunchCloseEvent = IdlEvents<LaunchpadProgram>["LaunchCloseEvent"];
export type FundingRecordApprovalSetEvent =
  IdlEvents<LaunchpadProgram>["FundingRecordApprovalSetEvent"];
export type LaunchClaimAdditionalTokenAllocationEvent =
  IdlEvents<LaunchpadProgram>["LaunchClaimAdditionalTokenAllocationEvent"];
export type LaunchPerformancePackageInitializedEvent =
  IdlEvents<LaunchpadProgram>["LaunchPerformancePackageInitializedEvent"];
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
