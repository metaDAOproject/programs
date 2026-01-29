import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import {
  LaunchpadV7 as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad_v7.js";
export { LaunchpadProgram, LaunchpadIDL };

import {
  ConditionalVault as ConditionalVaultProgram,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";
export { ConditionalVaultProgram, ConditionalVaultIDL };

import { Futarchy as FutarchyProgram, IDL as FutarchyIDL } from "./futarchy.js";
export { FutarchyProgram, FutarchyIDL };

import {
  PriceBasedPerformancePackage as PriceBasedPerformancePackageProgram,
  IDL as PriceBasedPerformancePackageIDL,
} from "./price_based_performance_package.js";
export { PriceBasedPerformancePackageProgram, PriceBasedPerformancePackageIDL };

import { BidWall as BidWallProgram, IDL as BidWallIDL } from "./bid_wall.js";
export { BidWallProgram, BidWallIDL };

import {
  MintGovernor as MintGovernorProgram,
  IDL as MintGovernorIDL,
} from "./mint_governor.js";
export { MintGovernorProgram, MintGovernorIDL };

import {
  PerformancePackageV2 as PerformancePackageV2Program,
  IDL as PerformancePackageV2IDL,
} from "./performance_package_v2.js";
export { PerformancePackageV2Program, PerformancePackageV2IDL };

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

export type BidWall = IdlAccounts<BidWallProgram>["bidWall"];

export type MintGovernorAccount =
  IdlAccounts<MintGovernorProgram>["mintGovernor"];
export type MintAuthorityAccount =
  IdlAccounts<MintGovernorProgram>["mintAuthority"];

export type PerformancePackageV2Account =
  IdlAccounts<PerformancePackageV2Program>["performancePackage"];
export type ChangeRequestV2Account =
  IdlAccounts<PerformancePackageV2Program>["changeRequest"];
export type OracleReaderV2 =
  IdlTypes<PerformancePackageV2Program>["OracleReader"];
export type RewardFunctionV2 =
  IdlTypes<PerformancePackageV2Program>["RewardFunction"];
export type PackageStatusV2 =
  IdlTypes<PerformancePackageV2Program>["PackageStatus"];
export type ProposerTypeV2 =
  IdlTypes<PerformancePackageV2Program>["ProposerType"];
export type ThresholdTrancheV2 =
  IdlTypes<PerformancePackageV2Program>["ThresholdTranche"];

export type BidWallInitializedEvent =
  IdlEvents<BidWallProgram>["BidWallInitializedEvent"];
export type BidWallTokensSoldEvent =
  IdlEvents<BidWallProgram>["BidWallTokensSoldEvent"];
export type BidWallFeesCollectedEvent =
  IdlEvents<BidWallProgram>["BidWallFeesCollectedEvent"];
export type BidWallClosedEvent =
  IdlEvents<BidWallProgram>["BidWallClosedEvent"];
export type BidWallCanceledEvent =
  IdlEvents<BidWallProgram>["BidWallCanceledEvent"];
export type BidWallEvent =
  | BidWallInitializedEvent
  | BidWallTokensSoldEvent
  | BidWallFeesCollectedEvent
  | BidWallClosedEvent
  | BidWallCanceledEvent;

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
export type FundingRecordApprovalSetEvent =
  IdlEvents<LaunchpadProgram>["FundingRecordApprovalSetEvent"];
export type LaunchClaimAdditionalTokenAllocationEvent =
  IdlEvents<LaunchpadProgram>["LaunchClaimAdditionalTokenAllocationEvent"];
export type LaunchPerformancePackageInitializedEvent =
  IdlEvents<LaunchpadProgram>["LaunchPerformancePackageInitializedEvent"];
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent
  | LaunchCloseEvent
  | FundingRecordApprovalSetEvent
  | LaunchClaimAdditionalTokenAllocationEvent
  | LaunchPerformancePackageInitializedEvent;

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
