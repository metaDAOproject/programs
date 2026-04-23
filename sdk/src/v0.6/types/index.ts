import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import {
  Launchpad as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad.js";
export { LaunchpadProgram, LaunchpadIDL };

import {
  Launchpad as v0_6_0_Launchpad,
  IDL as v0_6_0_LaunchpadIDL,
} from "./v0.6.0-launchpad.js";
export { v0_6_0_Launchpad, v0_6_0_LaunchpadIDL };

import {
  ConditionalVault as ConditionalVaultProgram,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";
export { ConditionalVaultProgram, ConditionalVaultIDL };

import { Futarchy as FutarchyProgram, IDL as FutarchyIDL } from "./futarchy.js";
export { FutarchyProgram, FutarchyIDL };

import {
  Futarchy as v0_6_0_Futarchy,
  IDL as v0_6_0_FutarchyIDL,
} from "./v0.6.0-futarchy.js";
export { v0_6_0_Futarchy, v0_6_0_FutarchyIDL };

import {
  PriceBasedPerformancePackage as PriceBasedPerformancePackageProgram,
  IDL as PriceBasedPerformancePackageIDL,
} from "./price_based_performance_package.js";
export { PriceBasedPerformancePackageProgram, PriceBasedPerformancePackageIDL };

export { LowercaseKeys } from "./utils.js";

import type { IdlAccounts, IdlTypes, IdlEvents } from "@coral-xyz/anchor";

export type Question = IdlAccounts<ConditionalVaultProgram>["question"];
export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];

export type InitializeDaoParams =
  IdlTypes<FutarchyProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<FutarchyProgram>["UpdateDaoParams"];
export type InitializePerformancePackageParams =
  IdlTypes<PriceBasedPerformancePackageProgram>["InitializePerformancePackageParams"];

export type Dao = IdlAccounts<FutarchyProgram>["dao"];
export type Proposal = IdlAccounts<FutarchyProgram>["proposal"];
export type Amm = IdlAccounts<AmmProgram>["amm"];
export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];
export type PerformancePackage =
  IdlAccounts<PriceBasedPerformancePackageProgram>["performancePackage"];

export type OracleConfig =
  IdlTypes<PriceBasedPerformancePackageProgram>["OracleConfig"];
export type Tranche = IdlTypes<PriceBasedPerformancePackageProgram>["Tranche"];

// export type OracleConfig = IdlTypes<PriceBasedTokenLockProgram>["OracleConfig"];
// export type SharedLiquidityPool =
//   IdlAccounts<SharedLiquidityManagerProgram>["sharedLiquidityPool"];
// export type SharedLiquidityPoolPosition =
//   IdlAccounts<SharedLiquidityManagerProgram>["liquidityPosition"];

export type SwapEvent = IdlEvents<AmmProgram>["SwapEvent"];
export type AddLiquidityEvent = IdlEvents<AmmProgram>["AddLiquidityEvent"];
export type RemoveLiquidityEvent =
  IdlEvents<AmmProgram>["RemoveLiquidityEvent"];
export type CreateAmmEvent = IdlEvents<AmmProgram>["CreateAmmEvent"];
export type CrankThatTwapEvent = IdlEvents<AmmProgram>["CrankThatTwapEvent"];
export type AmmEvent =
  | SwapEvent
  | AddLiquidityEvent
  | RemoveLiquidityEvent
  | CreateAmmEvent
  | CrankThatTwapEvent;

export type AddMetadataToConditionalTokensEvent =
  IdlEvents<ConditionalVaultProgram>["AddMetadataToConditionalTokensEvent"];
export type InitializeConditionalVaultEvent =
  IdlEvents<ConditionalVaultProgram>["InitializeConditionalVaultEvent"];
export type InitializeQuestionEvent =
  IdlEvents<ConditionalVaultProgram>["InitializeQuestionEvent"];
export type MergeTokensEvent =
  IdlEvents<ConditionalVaultProgram>["MergeTokensEvent"];
export type RedeemTokensEvent =
  IdlEvents<ConditionalVaultProgram>["RedeemTokensEvent"];
export type ResolveQuestionEvent =
  IdlEvents<ConditionalVaultProgram>["ResolveQuestionEvent"];
export type SplitTokensEvent =
  IdlEvents<ConditionalVaultProgram>["SplitTokensEvent"];
export type ConditionalVaultEvent =
  | AddMetadataToConditionalTokensEvent
  | InitializeConditionalVaultEvent
  | InitializeQuestionEvent
  | MergeTokensEvent
  | RedeemTokensEvent
  | ResolveQuestionEvent
  | SplitTokensEvent;

export type LaunchClaimEvent = IdlEvents<LaunchpadProgram>["LaunchClaimEvent"];
export type LaunchCompletedEvent =
  IdlEvents<LaunchpadProgram>["LaunchCompletedEvent"];
export type LaunchFundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchFundedEvent"];
export type LaunchInitializedEvent =
  IdlEvents<LaunchpadProgram>["LaunchInitializedEvent"];
export type LaunchRefundedEvent =
  IdlEvents<LaunchpadProgram>["LaunchRefundedEvent"];
export type LaunchStartedEvent =
  IdlEvents<LaunchpadProgram>["LaunchStartedEvent"];
export type LaunchCloseEvent = IdlEvents<LaunchpadProgram>["LaunchCloseEvent"];
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent
  | LaunchCloseEvent;

export type v0_6_0_LaunchClaimEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchClaimEvent"];
export type v0_6_0_LaunchCompletedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchCompletedEvent"];
export type v0_6_0_LaunchFundedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchFundedEvent"];
export type v0_6_0_LaunchInitializedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchInitializedEvent"];
export type v0_6_0_LaunchRefundedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchRefundedEvent"];
export type v0_6_0_LaunchStartedEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchStartedEvent"];
export type v0_6_0_LaunchCloseEvent =
  IdlEvents<v0_6_0_Launchpad>["LaunchCloseEvent"];
export type v0_6_0_LaunchpadEvent =
  | v0_6_0_LaunchClaimEvent
  | v0_6_0_LaunchCompletedEvent
  | v0_6_0_LaunchFundedEvent
  | v0_6_0_LaunchInitializedEvent
  | v0_6_0_LaunchRefundedEvent
  | v0_6_0_LaunchStartedEvent
  | v0_6_0_LaunchCloseEvent;

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

export type PerformancePackageInitializedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["PerformancePackageInitialized"];
export type UnlockStartedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["UnlockStarted"];
export type UnlockCompletedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["UnlockCompleted"];
export type ChangeProposedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["ChangeProposed"];
export type ChangeExecutedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["ChangeExecuted"];
export type PerformancePackageAuthorityChangedEvent =
  IdlEvents<PriceBasedPerformancePackageProgram>["PerformancePackageAuthorityChanged"];
export type PriceBasedPerformancePackageEvent =
  | PerformancePackageInitializedEvent
  | UnlockStartedEvent
  | UnlockCompletedEvent
  | ChangeProposedEvent
  | ChangeExecutedEvent
  | PerformancePackageAuthorityChangedEvent;
