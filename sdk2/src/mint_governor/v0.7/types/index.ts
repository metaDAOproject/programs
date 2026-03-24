import { IdlAccounts, IdlEvents } from "@coral-xyz/anchor";
import {
  MintGovernor as MintGovernorProgram,
  IDL as MintGovernorIDL,
} from "./mint_governor.js";
export { MintGovernorProgram, MintGovernorIDL };

export type MintGovernorAccount =
  IdlAccounts<MintGovernorProgram>["mintGovernor"];
export type MintAuthorityAccount =
  IdlAccounts<MintGovernorProgram>["mintAuthority"];

export type MintGovernorInitializedEvent =
  IdlEvents<MintGovernorProgram>["MintGovernorInitializedEvent"];
export type MintAuthorityTransferredEvent =
  IdlEvents<MintGovernorProgram>["MintAuthorityTransferredEvent"];
export type MintAuthorityAddedEvent =
  IdlEvents<MintGovernorProgram>["MintAuthorityAddedEvent"];
export type TokensMintedEvent =
  IdlEvents<MintGovernorProgram>["TokensMintedEvent"];
export type MintAuthorityUpdatedEvent =
  IdlEvents<MintGovernorProgram>["MintAuthorityUpdatedEvent"];
export type MintAuthorityRemovedEvent =
  IdlEvents<MintGovernorProgram>["MintAuthorityRemovedEvent"];
export type MintGovernorAdminUpdatedEvent =
  IdlEvents<MintGovernorProgram>["MintGovernorAdminUpdatedEvent"];
export type MintAuthorityReclaimedEvent =
  IdlEvents<MintGovernorProgram>["MintAuthorityReclaimedEvent"];
export type MintGovernorEvent =
  | MintGovernorInitializedEvent
  | MintAuthorityTransferredEvent
  | MintAuthorityAddedEvent
  | TokensMintedEvent
  | MintAuthorityUpdatedEvent
  | MintAuthorityRemovedEvent
  | MintGovernorAdminUpdatedEvent
  | MintAuthorityReclaimedEvent;
