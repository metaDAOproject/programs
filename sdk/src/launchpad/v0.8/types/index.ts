import type { IdlAccounts, IdlEvents } from "@anchor-lang/core";

import type { LaunchpadV8 as LaunchpadProgram } from "./launchpad_v8.js";
import launchpadIdl from "./launchpad_v8.json" with { type: "json" };
export type { LaunchpadProgram };
export const LaunchpadIDL = launchpadIdl as LaunchpadProgram;

export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];

export type LaunchInitializedEvent =
  IdlEvents<LaunchpadProgram>["launchInitializedEvent"];
export type LaunchStartedEvent =
  IdlEvents<LaunchpadProgram>["launchStartedEvent"];
export type LaunchFundedEvent =
  IdlEvents<LaunchpadProgram>["launchFundedEvent"];
export type FundingRecordApprovalSetEvent =
  IdlEvents<LaunchpadProgram>["fundingRecordApprovalSetEvent"];
export type LaunchSettledEvent =
  IdlEvents<LaunchpadProgram>["launchSettledEvent"];
export type LaunchFinalizedEvent =
  IdlEvents<LaunchpadProgram>["launchFinalizedEvent"];
export type LaunchRefundedEvent =
  IdlEvents<LaunchpadProgram>["launchRefundedEvent"];
export type LaunchClaimEvent = IdlEvents<LaunchpadProgram>["launchClaimEvent"];
export type LaunchCloseEvent = IdlEvents<LaunchpadProgram>["launchCloseEvent"];
export type LaunchClaimAdditionalTokenAllocationEvent =
  IdlEvents<LaunchpadProgram>["launchClaimAdditionalTokenAllocationEvent"];
export type LaunchExtendedEvent =
  IdlEvents<LaunchpadProgram>["launchExtendedEvent"];

export type LaunchpadEvent =
  | LaunchInitializedEvent
  | LaunchStartedEvent
  | LaunchFundedEvent
  | FundingRecordApprovalSetEvent
  | LaunchSettledEvent
  | LaunchFinalizedEvent
  | LaunchRefundedEvent
  | LaunchClaimEvent
  | LaunchCloseEvent
  | LaunchClaimAdditionalTokenAllocationEvent
  | LaunchExtendedEvent;
