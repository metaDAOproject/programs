import { Futarchy as FutarchyProgram, IDL as FutarchyIDL } from "./futarchy.js";
export { FutarchyProgram, FutarchyIDL };

export { LowercaseKeys } from "../../../utils.js";

import type { IdlAccounts, IdlTypes, IdlEvents } from "@coral-xyz/anchor";

export type InitializeDaoParams =
  IdlTypes<FutarchyProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<FutarchyProgram>["UpdateDaoParams"];

export type Dao = IdlAccounts<FutarchyProgram>["dao"];
export type Proposal = IdlAccounts<FutarchyProgram>["proposal"];

export type CollectFeesEvent = IdlEvents<FutarchyProgram>["CollectFeesEvent"];
export type InitializeDaoEvent =
  IdlEvents<FutarchyProgram>["InitializeDaoEvent"];
export type UpdateDaoEvent = IdlEvents<FutarchyProgram>["UpdateDaoEvent"];
export type InitializeProposalEvent =
  IdlEvents<FutarchyProgram>["InitializeProposalEvent"];
export type StakeToProposalEvent =
  IdlEvents<FutarchyProgram>["StakeToProposalEvent"];
export type UnstakeFromProposalEvent =
  IdlEvents<FutarchyProgram>["UnstakeFromProposalEvent"];
export type LaunchProposalEvent =
  IdlEvents<FutarchyProgram>["LaunchProposalEvent"];
export type FinalizeProposalEvent =
  IdlEvents<FutarchyProgram>["FinalizeProposalEvent"];
export type SpotSwapEvent = IdlEvents<FutarchyProgram>["SpotSwapEvent"];
export type ConditionalSwapEvent =
  IdlEvents<FutarchyProgram>["ConditionalSwapEvent"];
export type ProvideLiquidityEvent =
  IdlEvents<FutarchyProgram>["ProvideLiquidityEvent"];
export type WithdrawLiquidityEvent =
  IdlEvents<FutarchyProgram>["WithdrawLiquidityEvent"];
export type SponsorProposalEvent =
  IdlEvents<FutarchyProgram>["SponsorProposalEvent"];
export type InitiateVaultSpendOptimisticProposalEvent =
  IdlEvents<FutarchyProgram>["InitiateVaultSpendOptimisticProposalEvent"];
export type FinalizeOptimisticProposalEvent =
  IdlEvents<FutarchyProgram>["FinalizeOptimisticProposalEvent"];
export type FutarchyEvent =
  | CollectFeesEvent
  | InitializeDaoEvent
  | UpdateDaoEvent
  | InitializeProposalEvent
  | StakeToProposalEvent
  | UnstakeFromProposalEvent
  | LaunchProposalEvent
  | FinalizeProposalEvent
  | SpotSwapEvent
  | ConditionalSwapEvent
  | ProvideLiquidityEvent
  | WithdrawLiquidityEvent
  | SponsorProposalEvent
  | InitiateVaultSpendOptimisticProposalEvent
  | FinalizeOptimisticProposalEvent;
