import { Futarchy as FutarchyProgram, IDL as FutarchyIDL } from "./futarchy.js";
export { FutarchyProgram, FutarchyIDL };

import {
  Futarchy as v0_6_0_Futarchy,
  IDL as v0_6_0_FutarchyIDL,
} from "./v0.6.0-futarchy.js";
export { v0_6_0_Futarchy, v0_6_0_FutarchyIDL };

import {
  Futarchy as v0_6_1_Futarchy,
  IDL as v0_6_1_FutarchyIDL,
} from "./v0.6.1-futarchy.js";
export { v0_6_1_Futarchy, v0_6_1_FutarchyIDL };

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
  | SponsorProposalEvent;

export type v0_6_0_CollectFeesEvent =
  IdlEvents<v0_6_0_Futarchy>["CollectFeesEvent"];
export type v0_6_0_InitializeDaoEvent =
  IdlEvents<v0_6_0_Futarchy>["InitializeDaoEvent"];
export type v0_6_0_UpdateDaoEvent =
  IdlEvents<v0_6_0_Futarchy>["UpdateDaoEvent"];
export type v0_6_0_InitializeProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["InitializeProposalEvent"];
export type v0_6_0_StakeToProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["StakeToProposalEvent"];
export type v0_6_0_UnstakeFromProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["UnstakeFromProposalEvent"];
export type v0_6_0_LaunchProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["LaunchProposalEvent"];
export type v0_6_0_FinalizeProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["FinalizeProposalEvent"];
export type v0_6_0_SpotSwapEvent = IdlEvents<v0_6_0_Futarchy>["SpotSwapEvent"];
export type v0_6_0_ConditionalSwapEvent =
  IdlEvents<v0_6_0_Futarchy>["ConditionalSwapEvent"];
export type v0_6_0_ProvideLiquidityEvent =
  IdlEvents<v0_6_0_Futarchy>["ProvideLiquidityEvent"];
export type v0_6_0_WithdrawLiquidityEvent =
  IdlEvents<v0_6_0_Futarchy>["WithdrawLiquidityEvent"];
export type v0_6_0_FutarchyEvent =
  | v0_6_0_CollectFeesEvent
  | v0_6_0_InitializeDaoEvent
  | v0_6_0_UpdateDaoEvent
  | v0_6_0_InitializeProposalEvent
  | v0_6_0_StakeToProposalEvent
  | v0_6_0_UnstakeFromProposalEvent
  | v0_6_0_LaunchProposalEvent
  | v0_6_0_FinalizeProposalEvent
  | v0_6_0_SpotSwapEvent
  | v0_6_0_ConditionalSwapEvent
  | v0_6_0_ProvideLiquidityEvent
  | v0_6_0_WithdrawLiquidityEvent;

export type v0_6_1_CollectFeesEvent =
  IdlEvents<v0_6_1_Futarchy>["CollectFeesEvent"];
export type v0_6_1_InitializeDaoEvent =
  IdlEvents<v0_6_1_Futarchy>["InitializeDaoEvent"];
export type v0_6_1_UpdateDaoEvent =
  IdlEvents<v0_6_1_Futarchy>["UpdateDaoEvent"];
export type v0_6_1_InitializeProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["InitializeProposalEvent"];
export type v0_6_1_StakeToProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["StakeToProposalEvent"];
export type v0_6_1_UnstakeFromProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["UnstakeFromProposalEvent"];
export type v0_6_1_LaunchProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["LaunchProposalEvent"];
export type v0_6_1_FinalizeProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["FinalizeProposalEvent"];
export type v0_6_1_SpotSwapEvent = IdlEvents<v0_6_1_Futarchy>["SpotSwapEvent"];
export type v0_6_1_ConditionalSwapEvent =
  IdlEvents<v0_6_1_Futarchy>["ConditionalSwapEvent"];
export type v0_6_1_ProvideLiquidityEvent =
  IdlEvents<v0_6_1_Futarchy>["ProvideLiquidityEvent"];
export type v0_6_1_WithdrawLiquidityEvent =
  IdlEvents<v0_6_1_Futarchy>["WithdrawLiquidityEvent"];
export type v0_6_1_SponsorProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["SponsorProposalEvent"];
export type v0_6_1_RemoveProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["RemoveProposalEvent"];
export type v0_6_1_AdminCancelProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["AdminCancelProposalEvent"];
export type v0_6_1_CollectMeteoraDammFeesEvent =
  IdlEvents<v0_6_1_Futarchy>["CollectMeteoraDammFeesEvent"];
export type v0_6_1_AdminFixPositionAuthorityEvent =
  IdlEvents<v0_6_1_Futarchy>["AdminFixPositionAuthorityEvent"];
export type v0_6_1_InitiateVaultSpendOptimisticProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["InitiateVaultSpendOptimisticProposalEvent"];
export type v0_6_1_FinalizeOptimisticProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["FinalizeOptimisticProposalEvent"];
export type v0_6_1_FutarchyEvent =
  | v0_6_1_CollectFeesEvent
  | v0_6_1_InitializeDaoEvent
  | v0_6_1_UpdateDaoEvent
  | v0_6_1_InitializeProposalEvent
  | v0_6_1_StakeToProposalEvent
  | v0_6_1_UnstakeFromProposalEvent
  | v0_6_1_LaunchProposalEvent
  | v0_6_1_FinalizeProposalEvent
  | v0_6_1_SpotSwapEvent
  | v0_6_1_ConditionalSwapEvent
  | v0_6_1_ProvideLiquidityEvent
  | v0_6_1_WithdrawLiquidityEvent
  | v0_6_1_SponsorProposalEvent
  | v0_6_1_RemoveProposalEvent
  | v0_6_1_AdminCancelProposalEvent
  | v0_6_1_CollectMeteoraDammFeesEvent
  | v0_6_1_AdminFixPositionAuthorityEvent
  | v0_6_1_InitiateVaultSpendOptimisticProposalEvent
  | v0_6_1_FinalizeOptimisticProposalEvent;
