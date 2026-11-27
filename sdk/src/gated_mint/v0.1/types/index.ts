import { IdlAccounts, IdlEvents } from "@anchor-lang/core";
import type { GatedMint as GatedMintProgram } from "./gated_mint.js";
import gatedMintIdl from "./gated_mint.json" with { type: "json" };
export type { GatedMintProgram };
export const GatedMintIDL = gatedMintIdl as GatedMintProgram;

export type GatedMintConfigAccount =
  IdlAccounts<GatedMintProgram>["gatedMintConfig"];
export type WhitelistedUserAccount =
  IdlAccounts<GatedMintProgram>["whitelistedUser"];

export type GatedMintInitializedEvent =
  IdlEvents<GatedMintProgram>["gatedMintInitializedEvent"];
export type WhitelistedUserAddedEvent =
  IdlEvents<GatedMintProgram>["whitelistedUserAddedEvent"];
export type GatedInvokeEvent = IdlEvents<GatedMintProgram>["gatedInvokeEvent"];
export type GatingDisabledEvent =
  IdlEvents<GatedMintProgram>["gatingDisabledEvent"];
export type AccountThawedEvent =
  IdlEvents<GatedMintProgram>["accountThawedEvent"];
export type GatedMintEvent =
  | GatedMintInitializedEvent
  | WhitelistedUserAddedEvent
  | GatedInvokeEvent
  | GatingDisabledEvent
  | AccountThawedEvent;
