import { Autocrat as AutocratProgram, IDL as AutocratIDL } from "./autocrat.js";
export { AutocratProgram, AutocratIDL };

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["UpdateDaoParams"];
export type ProposalInstruction =
  IdlTypes<AutocratProgram>["ProposalInstruction"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];
