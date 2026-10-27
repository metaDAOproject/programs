import type { Autocrat as AutocratProgram } from "./autocrat.js";
import autocratIdl from "./autocrat.json" with { type: "json" };
export type { AutocratProgram };
export const AutocratIDL = autocratIdl as AutocratProgram;

import type { IdlAccounts, IdlTypes, IdlEvents } from "@anchor-lang/core";

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["initializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["updateDaoParams"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];

export type InitializeDaoEvent =
  IdlEvents<AutocratProgram>["initializeDaoEvent"];
export type UpdateDaoEvent = IdlEvents<AutocratProgram>["updateDaoEvent"];
export type InitializeProposalEvent =
  IdlEvents<AutocratProgram>["initializeProposalEvent"];
export type FinalizeProposalEvent =
  IdlEvents<AutocratProgram>["finalizeProposalEvent"];
export type ExecuteProposalEvent =
  IdlEvents<AutocratProgram>["executeProposalEvent"];
export type AutocratEvent =
  | InitializeDaoEvent
  | UpdateDaoEvent
  | InitializeProposalEvent
  | FinalizeProposalEvent
  | ExecuteProposalEvent;
