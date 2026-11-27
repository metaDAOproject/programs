import { IdlAccounts, IdlEvents } from "@anchor-lang/core";
import type { Launchpad as LaunchpadProgram } from "./launchpad.js";
import launchpadIdl from "./launchpad.json" with { type: "json" };
export type { LaunchpadProgram };
export const LaunchpadIDL = launchpadIdl as LaunchpadProgram;

import type { Launchpad as v0_6_0_Launchpad } from "./v0.6.0-launchpad.js";
import v0_6_0_LaunchpadIdl from "./v0.6.0-launchpad.json" with { type: "json" };
export type { v0_6_0_Launchpad };
export const v0_6_0_LaunchpadIDL = v0_6_0_LaunchpadIdl as v0_6_0_Launchpad;

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
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent
  | LaunchCloseEvent;

export type v0_6_0_LaunchClaimEvent =
  IdlEvents<v0_6_0_Launchpad>["launchClaimEvent"];
export type v0_6_0_LaunchCompletedEvent =
  IdlEvents<v0_6_0_Launchpad>["launchCompletedEvent"];
export type v0_6_0_LaunchFundedEvent =
  IdlEvents<v0_6_0_Launchpad>["launchFundedEvent"];
export type v0_6_0_LaunchInitializedEvent =
  IdlEvents<v0_6_0_Launchpad>["launchInitializedEvent"];
export type v0_6_0_LaunchRefundedEvent =
  IdlEvents<v0_6_0_Launchpad>["launchRefundedEvent"];
export type v0_6_0_LaunchStartedEvent =
  IdlEvents<v0_6_0_Launchpad>["launchStartedEvent"];
export type v0_6_0_LaunchCloseEvent =
  IdlEvents<v0_6_0_Launchpad>["launchCloseEvent"];
export type v0_6_0_LaunchpadEvent =
  | v0_6_0_LaunchClaimEvent
  | v0_6_0_LaunchCompletedEvent
  | v0_6_0_LaunchFundedEvent
  | v0_6_0_LaunchInitializedEvent
  | v0_6_0_LaunchRefundedEvent
  | v0_6_0_LaunchStartedEvent
  | v0_6_0_LaunchCloseEvent;
