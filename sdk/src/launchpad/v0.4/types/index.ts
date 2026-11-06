import type { Launchpad as LaunchpadProgram } from "./launchpad.js";
import launchpadIdl from "./launchpad.json" with { type: "json" };
export type { LaunchpadProgram };
export const LaunchpadIDL = launchpadIdl as LaunchpadProgram;

import type { IdlAccounts, IdlEvents } from "@anchor-lang/core";

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
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent;
