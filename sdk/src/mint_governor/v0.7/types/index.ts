import { IdlAccounts, IdlEvents } from "@anchor-lang/core";
import type { MintGovernor as MintGovernorProgram } from "./mint_governor.js";
import mintGovernorIdl from "./mint_governor.json" with { type: "json" };
export type { MintGovernorProgram };
export const MintGovernorIDL = mintGovernorIdl as MintGovernorProgram;

export type MintGovernorAccount =
  IdlAccounts<MintGovernorProgram>["mintGovernor"];
export type MintAuthorityAccount =
  IdlAccounts<MintGovernorProgram>["mintAuthority"];

export type MintGovernorInitializedEvent =
  IdlEvents<MintGovernorProgram>["mintGovernorInitializedEvent"];
export type MintAuthorityTransferredEvent =
  IdlEvents<MintGovernorProgram>["mintAuthorityTransferredEvent"];
export type MintAuthorityAddedEvent =
  IdlEvents<MintGovernorProgram>["mintAuthorityAddedEvent"];
export type TokensMintedEvent =
  IdlEvents<MintGovernorProgram>["tokensMintedEvent"];
export type MintAuthorityUpdatedEvent =
  IdlEvents<MintGovernorProgram>["mintAuthorityUpdatedEvent"];
export type MintAuthorityRemovedEvent =
  IdlEvents<MintGovernorProgram>["mintAuthorityRemovedEvent"];
export type MintGovernorAdminUpdatedEvent =
  IdlEvents<MintGovernorProgram>["mintGovernorAdminUpdatedEvent"];
export type MintAuthorityReclaimedEvent =
  IdlEvents<MintGovernorProgram>["mintAuthorityReclaimedEvent"];
export type MintGovernorEvent =
  | MintGovernorInitializedEvent
  | MintAuthorityTransferredEvent
  | MintAuthorityAddedEvent
  | TokensMintedEvent
  | MintAuthorityUpdatedEvent
  | MintAuthorityRemovedEvent
  | MintGovernorAdminUpdatedEvent
  | MintAuthorityReclaimedEvent;
