import type { Autocrat as AutocratProgram } from "./autocrat.js";
import autocratIdl from "./autocrat.json" with { type: "json" };
export type { AutocratProgram };
export const AutocratIDL = autocratIdl as AutocratProgram;

import type { IdlAccounts, IdlTypes } from "@anchor-lang/core";

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["initializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["updateDaoParams"];
export type ProposalInstruction =
  IdlTypes<AutocratProgram>["proposalInstruction"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];
