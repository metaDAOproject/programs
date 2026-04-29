import {
  Launchpad as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad.js";
export { LaunchpadProgram, LaunchpadIDL };

import type { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";

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
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent;
