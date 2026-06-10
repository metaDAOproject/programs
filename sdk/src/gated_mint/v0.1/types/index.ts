import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";
import {
  GatedMint as GatedMintProgram,
  IDL as GatedMintIDL,
} from "./gated_mint.js";
export { GatedMintProgram, GatedMintIDL };

export type GatedMintConfigAccount =
  IdlAccounts<GatedMintProgram>["gatedMintConfig"];
export type WhitelistedUserAccount =
  IdlAccounts<GatedMintProgram>["whitelistedUser"];

export type GatedMintInitializedEvent =
  IdlEvents<GatedMintProgram>["GatedMintInitializedEvent"];
export type WhitelistedUserAddedEvent =
  IdlEvents<GatedMintProgram>["WhitelistedUserAddedEvent"];
export type GatedInvokeEvent = IdlEvents<GatedMintProgram>["GatedInvokeEvent"];
export type GatingDisabledEvent =
  IdlEvents<GatedMintProgram>["GatingDisabledEvent"];
export type AccountThawedEvent =
  IdlEvents<GatedMintProgram>["AccountThawedEvent"];
export type GatedMintEvent =
  | GatedMintInitializedEvent
  | WhitelistedUserAddedEvent
  | GatedInvokeEvent
  | GatingDisabledEvent
  | AccountThawedEvent;
