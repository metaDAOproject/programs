import type { Futarchy as FutarchyProgram } from "./futarchy.js";
import futarchyIdl from "./futarchy.json" with { type: "json" };
export type { FutarchyProgram };
export const FutarchyIDL = futarchyIdl as FutarchyProgram;

import type { Futarchy as v0_6_0_Futarchy } from "./v0.6.0-futarchy.js";
import v0_6_0_FutarchyIdl from "./v0.6.0-futarchy.json" with { type: "json" };
export type { v0_6_0_Futarchy };
export const v0_6_0_FutarchyIDL = v0_6_0_FutarchyIdl as v0_6_0_Futarchy;

import type { Futarchy as v0_6_1_Futarchy } from "./v0.6.1-futarchy.js";
import v0_6_1_FutarchyIdl from "./v0.6.1-futarchy.json" with { type: "json" };
export type { v0_6_1_Futarchy };
export const v0_6_1_FutarchyIDL = v0_6_1_FutarchyIdl as v0_6_1_Futarchy;

export { LowercaseKeys } from "../../../utils.js";

import type { IdlAccounts, IdlTypes, IdlEvents } from "@anchor-lang/core";

export type InitializeDaoParams =
  IdlTypes<FutarchyProgram>["initializeDaoParams"];
// The retired optimistic-governance flag only keeps its position in the
// encoding; `updateDaoIx` fills it in, so callers never set it.
export type UpdateDaoParams = Omit<
  IdlTypes<FutarchyProgram>["updateDaoParams"],
  "deprecatedIsOptimisticGovernanceEnabled"
>;
export type SetSpendingLimitArgs =
  IdlTypes<FutarchyProgram>["setSpendingLimitArgs"];
export type InitializeLargeSpendProposalArgs =
  IdlTypes<FutarchyProgram>["initializeLargeSpendProposalArgs"];
export type InitializeMintTokensProposalArgs =
  IdlTypes<FutarchyProgram>["initializeMintTokensProposalArgs"];
export type InitializeSpendingLimitChangeProposalArgs =
  IdlTypes<FutarchyProgram>["initializeSpendingLimitChangeProposalArgs"];
export type InitializeHostileTakeoverProposalArgs =
  IdlTypes<FutarchyProgram>["initializeHostileTakeoverProposalArgs"];
export type InitializeBuybackTokenProposalArgs =
  IdlTypes<FutarchyProgram>["initializeBuybackTokenProposalArgs"];
export type SpendingLimitAction =
  IdlTypes<FutarchyProgram>["spendingLimitAction"];
export type ProposalAction = IdlTypes<FutarchyProgram>["proposalAction"];

export type Dao = IdlAccounts<FutarchyProgram>["dao"];
export type Proposal = IdlAccounts<FutarchyProgram>["proposal"];

export type CollectFeesEvent = IdlEvents<FutarchyProgram>["collectFeesEvent"];
export type InitializeDaoEvent =
  IdlEvents<FutarchyProgram>["initializeDaoEvent"];
export type UpdateDaoEvent = IdlEvents<FutarchyProgram>["updateDaoEvent"];
export type InitializeProposalEvent =
  IdlEvents<FutarchyProgram>["initializeProposalEvent"];
export type StakeToProposalEvent =
  IdlEvents<FutarchyProgram>["stakeToProposalEvent"];
export type UnstakeFromProposalEvent =
  IdlEvents<FutarchyProgram>["unstakeFromProposalEvent"];
export type LaunchProposalEvent =
  IdlEvents<FutarchyProgram>["launchProposalEvent"];
export type FinalizeProposalEvent =
  IdlEvents<FutarchyProgram>["finalizeProposalEvent"];
export type SpotSwapEvent = IdlEvents<FutarchyProgram>["spotSwapEvent"];
export type ConditionalSwapEvent =
  IdlEvents<FutarchyProgram>["conditionalSwapEvent"];
export type ProvideLiquidityEvent =
  IdlEvents<FutarchyProgram>["provideLiquidityEvent"];
export type WithdrawLiquidityEvent =
  IdlEvents<FutarchyProgram>["withdrawLiquidityEvent"];
export type SponsorProposalEvent =
  IdlEvents<FutarchyProgram>["sponsorProposalEvent"];
export type RemoveProposalEvent =
  IdlEvents<FutarchyProgram>["removeProposalEvent"];
export type AdminUpdateProposalParamsEvent =
  IdlEvents<FutarchyProgram>["adminUpdateProposalParamsEvent"];
export type AdminCancelProposalEvent =
  IdlEvents<FutarchyProgram>["adminCancelProposalEvent"];
export type CollectMeteoraDammFeesEvent =
  IdlEvents<FutarchyProgram>["collectMeteoraDammFeesEvent"];
export type AdminFixPositionAuthorityEvent =
  IdlEvents<FutarchyProgram>["adminFixPositionAuthorityEvent"];
export type SetSpendingLimitEvent =
  IdlEvents<FutarchyProgram>["setSpendingLimitEvent"];
export type SyncSpendingLimitEvent =
  IdlEvents<FutarchyProgram>["syncSpendingLimitEvent"];
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
  | RemoveProposalEvent
  | AdminUpdateProposalParamsEvent
  | AdminCancelProposalEvent
  | CollectMeteoraDammFeesEvent
  | AdminFixPositionAuthorityEvent
  | SetSpendingLimitEvent
  | SyncSpendingLimitEvent;

export type v0_6_0_CollectFeesEvent =
  IdlEvents<v0_6_0_Futarchy>["collectFeesEvent"];
export type v0_6_0_InitializeDaoEvent =
  IdlEvents<v0_6_0_Futarchy>["initializeDaoEvent"];
export type v0_6_0_UpdateDaoEvent =
  IdlEvents<v0_6_0_Futarchy>["updateDaoEvent"];
export type v0_6_0_InitializeProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["initializeProposalEvent"];
export type v0_6_0_StakeToProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["stakeToProposalEvent"];
export type v0_6_0_UnstakeFromProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["unstakeFromProposalEvent"];
export type v0_6_0_LaunchProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["launchProposalEvent"];
export type v0_6_0_FinalizeProposalEvent =
  IdlEvents<v0_6_0_Futarchy>["finalizeProposalEvent"];
export type v0_6_0_SpotSwapEvent = IdlEvents<v0_6_0_Futarchy>["spotSwapEvent"];
export type v0_6_0_ConditionalSwapEvent =
  IdlEvents<v0_6_0_Futarchy>["conditionalSwapEvent"];
export type v0_6_0_ProvideLiquidityEvent =
  IdlEvents<v0_6_0_Futarchy>["provideLiquidityEvent"];
export type v0_6_0_WithdrawLiquidityEvent =
  IdlEvents<v0_6_0_Futarchy>["withdrawLiquidityEvent"];
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
  IdlEvents<v0_6_1_Futarchy>["collectFeesEvent"];
export type v0_6_1_InitializeDaoEvent =
  IdlEvents<v0_6_1_Futarchy>["initializeDaoEvent"];
export type v0_6_1_UpdateDaoEvent =
  IdlEvents<v0_6_1_Futarchy>["updateDaoEvent"];
export type v0_6_1_InitializeProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["initializeProposalEvent"];
export type v0_6_1_StakeToProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["stakeToProposalEvent"];
export type v0_6_1_UnstakeFromProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["unstakeFromProposalEvent"];
export type v0_6_1_LaunchProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["launchProposalEvent"];
export type v0_6_1_FinalizeProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["finalizeProposalEvent"];
export type v0_6_1_SpotSwapEvent = IdlEvents<v0_6_1_Futarchy>["spotSwapEvent"];
export type v0_6_1_ConditionalSwapEvent =
  IdlEvents<v0_6_1_Futarchy>["conditionalSwapEvent"];
export type v0_6_1_ProvideLiquidityEvent =
  IdlEvents<v0_6_1_Futarchy>["provideLiquidityEvent"];
export type v0_6_1_WithdrawLiquidityEvent =
  IdlEvents<v0_6_1_Futarchy>["withdrawLiquidityEvent"];
export type v0_6_1_SponsorProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["sponsorProposalEvent"];
export type v0_6_1_RemoveProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["removeProposalEvent"];
export type v0_6_1_AdminCancelProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["adminCancelProposalEvent"];
export type v0_6_1_CollectMeteoraDammFeesEvent =
  IdlEvents<v0_6_1_Futarchy>["collectMeteoraDammFeesEvent"];
export type v0_6_1_AdminFixPositionAuthorityEvent =
  IdlEvents<v0_6_1_Futarchy>["adminFixPositionAuthorityEvent"];
export type v0_6_1_InitiateVaultSpendOptimisticProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["initiateVaultSpendOptimisticProposalEvent"];
export type v0_6_1_FinalizeOptimisticProposalEvent =
  IdlEvents<v0_6_1_Futarchy>["finalizeOptimisticProposalEvent"];
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
