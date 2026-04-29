import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";
import {
  Launchpad as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad.js";
export { LaunchpadProgram, LaunchpadIDL };

import {
  Launchpad as v0_6_0_Launchpad,
  IDL as v0_6_0_LaunchpadIDL,
} from "./v0.6.0-launchpad.js";
export { v0_6_0_Launchpad, v0_6_0_LaunchpadIDL };

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
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent
  | LaunchCloseEvent;

export type v0_6_0_LaunchClaimEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchClaimEvent"];
export type v0_6_0_LaunchCompletedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchCompletedEvent"];
export type v0_6_0_LaunchFundedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchFundedEvent"];
export type v0_6_0_LaunchInitializedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchInitializedEvent"];
export type v0_6_0_LaunchRefundedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchRefundedEvent"];
export type v0_6_0_LaunchStartedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchStartedEvent"];
export type v0_6_0_LaunchCloseEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchCloseEvent"];
export type v0_6_0_LaunchpadEvent =
  | v0_6_0_LaunchClaimEvent
  | v0_6_0_LaunchCompletedEvent
  | v0_6_0_LaunchFundedEvent
  | v0_6_0_LaunchInitializedEvent
  | v0_6_0_LaunchRefundedEvent
  | v0_6_0_LaunchStartedEvent
  | v0_6_0_LaunchCloseEvent;
