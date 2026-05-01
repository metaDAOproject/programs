import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";
import {
  GatedToken as GatedTokenProgram,
  IDL as GatedTokenIDL,
} from "./gated_token.js";
export { GatedTokenProgram, GatedTokenIDL };

export type GatedMintConfigAccount =
  IdlAccounts<GatedTokenProgram>["gatedMintConfig"];
export type WhitelistedUserAccount =
  IdlAccounts<GatedTokenProgram>["whitelistedUser"];

export type GatedMintInitializedEvent =
  IdlEvents<GatedTokenProgram>["GatedMintInitializedEvent"];
export type WhitelistedUserAddedEvent =
  IdlEvents<GatedTokenProgram>["WhitelistedUserAddedEvent"];
export type GatedInvokeEvent = IdlEvents<GatedTokenProgram>["GatedInvokeEvent"];
export type GatingDisabledEvent =
  IdlEvents<GatedTokenProgram>["GatingDisabledEvent"];
export type AccountThawedEvent =
  IdlEvents<GatedTokenProgram>["AccountThawedEvent"];
export type GatedTokenEvent =
  | GatedMintInitializedEvent
  | WhitelistedUserAddedEvent
  | GatedInvokeEvent
  | GatingDisabledEvent
  | AccountThawedEvent;
