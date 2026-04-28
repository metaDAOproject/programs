import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";

import { BidWall as BidWallProgram, IDL as BidWallIDL } from "./bid_wall.js";

export { BidWallProgram, BidWallIDL };

export type BidWall = IdlAccounts<BidWallProgram>["bidWall"];

export type BidWallInitializedEvent =
  IdlEvents<BidWallProgram>["BidWallInitializedEvent"];
export type BidWallTokensSoldEvent =
  IdlEvents<BidWallProgram>["BidWallTokensSoldEvent"];
export type BidWallFeesCollectedEvent =
  IdlEvents<BidWallProgram>["BidWallFeesCollectedEvent"];
export type BidWallClosedEvent =
  IdlEvents<BidWallProgram>["BidWallClosedEvent"];
export type BidWallCanceledEvent =
  IdlEvents<BidWallProgram>["BidWallCanceledEvent"];
export type BidWallEvent =
  | BidWallInitializedEvent
  | BidWallTokensSoldEvent
  | BidWallFeesCollectedEvent
  | BidWallClosedEvent
  | BidWallCanceledEvent;
