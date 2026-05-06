import type { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";

import {
  LaunchpadV8 as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad_v8.js";
export { LaunchpadProgram, LaunchpadIDL };

export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];

export type LaunchInitializedEvent =
  IdlEvents<LaunchpadProgram>["LaunchInitializedEvent"];
export type LaunchStartedEvent =
  IdlEvents<LaunchpadProgram>["LaunchStartedEvent"];
export type LaunchFundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchFundedEvent"];
export type FundingRecordApprovalSetEvent =
  IdlEvents<LaunchpadProgram>["FundingRecordApprovalSetEvent"];
export type LaunchSettledEvent =
  IdlEvents<LaunchpadProgram>["LaunchSettledEvent"];
export type LaunchFinalizedEvent =
  IdlEvents<LaunchpadProgram>["LaunchFinalizedEvent"];
export type LaunchRefundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchRefundedEvent"];
export type LaunchClaimEvent = IdlEvents<LaunchpadProgram>["LaunchClaimEvent"];
export type LaunchCloseEvent = IdlEvents<LaunchpadProgram>["LaunchCloseEvent"];
export type LaunchClaimAdditionalTokenAllocationEvent =
  IdlEvents<LaunchpadProgram>["LaunchClaimAdditionalTokenAllocationEvent"];
export type LaunchExtendedEvent =
  IdlEvents<LaunchpadProgram>["LaunchExtendedEvent"];

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
