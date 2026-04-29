import { Autocrat as AutocratProgram, IDL as AutocratIDL } from "./autocrat.js";
export { AutocratProgram, AutocratIDL };

import type { IdlAccounts, IdlTypes, IdlEvents } from "@coral-xyz/anchor";

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["UpdateDaoParams"];
export type ProposalInstruction =
  IdlTypes<AutocratProgram>["ProposalInstruction"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];

export type InitializeDaoEvent =
  IdlEvents<AutocratProgram>["InitializeDaoEvent"];
export type UpdateDaoEvent = IdlEvents<AutocratProgram>["UpdateDaoEvent"];
export type InitializeProposalEvent =
  IdlEvents<AutocratProgram>["InitializeProposalEvent"];
export type FinalizeProposalEvent =
  IdlEvents<AutocratProgram>["FinalizeProposalEvent"];
export type ExecuteProposalEvent =
  IdlEvents<AutocratProgram>["ExecuteProposalEvent"];
export type AutocratEvent =
  | InitializeDaoEvent
  | UpdateDaoEvent
  | InitializeProposalEvent
  | FinalizeProposalEvent
  | ExecuteProposalEvent;
