import { Autocrat as AutocratProgram, IDL as AutocratIDL } from "./autocrat.js";
export { AutocratProgram, AutocratIDL };

import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import {
  Launchpad as LaunchpadProgram,
  IDL as LaunchpadIDL,
} from "./launchpad.js";
export { LaunchpadProgram, LaunchpadIDL };

import {
  ConditionalVault as ConditionalVaultProgram,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";
export { ConditionalVaultProgram, ConditionalVaultIDL };

import {
  SharedLiquidityManager as SharedLiquidityManagerProgram,
  IDL as SharedLiquidityManagerIDL,
} from "./shared_liquidity_manager.js";
export { SharedLiquidityManagerProgram, SharedLiquidityManagerIDL };

export { LowercaseKeys } from "./utils.js";

import type { IdlAccounts, IdlTypes, IdlEvents } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type Question = IdlAccounts<ConditionalVaultProgram>["question"];
export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["UpdateDaoParams"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];
export type FutarchyAmm = IdlAccounts<AutocratProgram>["futarchyAmm"];
export type Side = IdlTypes<AutocratProgram>["Side"];

export type Amm = IdlAccounts<AmmProgram>["amm"];
export type Launch = IdlAccounts<LaunchpadProgram>["launch"];
export type FundingRecord = IdlAccounts<LaunchpadProgram>["fundingRecord"];
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
export type LaunchpadEvent =
  | LaunchClaimEvent
  | LaunchCompletedEvent
  | LaunchFundedEvent
  | LaunchInitializedEvent
  | LaunchRefundedEvent
  | LaunchStartedEvent;

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
