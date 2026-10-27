import { IdlAccounts, IdlEvents } from "@anchor-lang/core";

import type { BidWall as BidWallProgram } from "./bid_wall.js";
import bidWallIdl from "./bid_wall.json" with { type: "json" };
export type { BidWallProgram };
export const BidWallIDL = bidWallIdl as BidWallProgram;

export type BidWall = IdlAccounts<BidWallProgram>["bidWall"];

export type BidWallInitializedEvent =
  IdlEvents<BidWallProgram>["bidWallInitializedEvent"];
export type BidWallTokensSoldEvent =
  IdlEvents<BidWallProgram>["bidWallTokensSoldEvent"];
export type BidWallFeesCollectedEvent =
  IdlEvents<BidWallProgram>["bidWallFeesCollectedEvent"];
export type BidWallClosedEvent =
  IdlEvents<BidWallProgram>["bidWallClosedEvent"];
export type BidWallCanceledEvent =
  IdlEvents<BidWallProgram>["bidWallCanceledEvent"];
export type BidWallEvent =
  | BidWallInitializedEvent
  | BidWallTokensSoldEvent
  | BidWallFeesCollectedEvent
  | BidWallClosedEvent
  | BidWallCanceledEvent;
