import { IdlAccounts } from "@coral-xyz/anchor";

import { Relaunch as RelaunchProgram, IDL as RelaunchIDL } from "./relaunch.js";

export { RelaunchProgram, RelaunchIDL };

export type RelaunchAccount = IdlAccounts<RelaunchProgram>["relaunch"];
export type DepositRecordAccount =
  IdlAccounts<RelaunchProgram>["depositRecord"];
