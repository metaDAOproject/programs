pub use super::*;

pub const SEED_DAO: &[u8] = b"dao";

pub const MAX_SPENDING_LIMIT_MEMBERS: usize = 10;

pub const MIN_PROPOSAL_DURATION_TWAP_MULTIPLIER: u32 = 2;
pub const MIN_PROPOSAL_DURATION_SECONDS: u32 = 60 * 60 * 24;
pub const MAX_PASS_THRESHOLD_BPS: u16 = 1_000;
pub const MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS: i16 = 1_000;
pub const MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS: i16 = -1_000;

#[account]
#[derive(InitSpace)]
pub struct Dao {
    /// Embedded FutarchyAmm - 1:1 relationship
    pub amm: FutarchyAmm,
    /// `nonce` + `dao_creator` are PDA seeds
    pub nonce: u64,
    pub dao_creator: Pubkey,
    pub pda_bump: u8,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub proposal_count: u32,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    /// For manipulation-resistance the TWAP is a time-weighted average observation,
    /// where observation tries to approximate price but can only move by
    /// `twap_max_observation_change_per_update` per update. Because it can only move
    /// a little bit per update, you need to check that it has a good initial observation.
    /// Otherwise, an attacker could create a very high initial observation in the pass
    /// market and a very low one in the fail market to force the proposal to pass.
    ///
    /// We recommend setting an initial observation around the spot price of the token,
    /// and max observation change per update around 2% the spot price of the token.
    /// For example, if the spot price of META is $400, we'd recommend setting an initial
    /// observation of 400 (converted into the AMM prices) and a max observation change per
    /// update of 8 (also converted into the AMM prices). Observations can be updated once
    /// a minute, so 2% allows the proposal market to reach double the spot price or 0
    /// in 50 minutes.
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    /// Forces TWAP calculation to start after `twap_start_delay_seconds` seconds
    pub twap_start_delay_seconds: u32,
    /// As an anti-spam measure and to help liquidity, you need to lock up some liquidity
    /// in both futarchic markets in order to create a proposal.
    ///
    /// For example, for META, we can use a `min_quote_futarchic_liquidity` of
    /// 5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of
    /// 10 * 1_000_000_000 (10 META).
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    /// Minimum amount of base tokens that must be staked to launch a proposal
    pub base_to_stake: u64,
    pub seq_num: u64,
    /// The authoritative record of what the Squads spending limit should be.
    /// `None` = no limit. Kept in sync with the Squads-side account by
    /// `sync_spending_limit`. (Named for its original init-only role)
    pub initial_spending_limit: Option<InitialSpendingLimit>,
    /// The percentage, in basis points, the pass price needs to be above the
    /// fail price in order for the proposal to pass for team-sponsored proposals.
    ///
    /// Can be negative to allow for team-sponsored proposals to pass by default.
    pub team_sponsored_pass_threshold_bps: i16,
    pub team_address: Pubkey,
    pub optimistic_proposal: Option<OptimisticProposal>,
    pub is_optimistic_governance_enabled: bool,
    /// `Some` means the DAO has been liquidated, and holds who runs the estate.
    /// Set once by `apply_liquidation`, never cleared.
    pub liquidator: Option<Pubkey>,
    /// Unix time of the last failed hostile takeover. 0 = never.
    pub last_failed_takeover_at: i64,
    /// Unix time of the last failed hostile liquidation. 0 = never.
    pub last_failed_liquidation_at: i64,
    /// Set by every write to the spending-limit record (`initial_spending_limit`),
    /// consumed by `sync_spending_limit`.
    pub spending_limit_dirty: bool,
    /// Unix time of the last buyback finalization. 0 = never.
    pub last_buyback_finalized_at: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct OptimisticProposal {
    /// The squads proposal currently enqueued for execution if not challenged by a new proposal.
    pub squads_proposal: Pubkey,
    /// The timestamp when the active optimistic squads proposal was enqueued.
    pub enqueued_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub struct InitialSpendingLimit {
    pub amount_per_month: u64,
    #[max_len(MAX_SPENDING_LIMIT_MEMBERS)]
    pub members: Vec<Pubkey>,
}

impl Dao {
    pub fn invariant(&self) -> Result<()> {
        require_gte!(
            self.seconds_per_proposal,
            self.twap_start_delay_seconds * MIN_PROPOSAL_DURATION_TWAP_MULTIPLIER,
            FutarchyError::ProposalDurationTooShort
        );

        require_gte!(
            self.seconds_per_proposal,
            MIN_PROPOSAL_DURATION_SECONDS,
            FutarchyError::ProposalDurationTooShort
        );

        require_gte!(
            MAX_PASS_THRESHOLD_BPS,
            self.pass_threshold_bps,
            FutarchyError::PassThresholdTooHigh
        );

        require_gte!(
            self.team_sponsored_pass_threshold_bps,
            MIN_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
            FutarchyError::InvalidTeamSponsoredPassThreshold
        );

        require_gte!(
            MAX_TEAM_SPONSORED_PASS_THRESHOLD_BPS,
            self.team_sponsored_pass_threshold_bps,
            FutarchyError::InvalidTeamSponsoredPassThreshold
        );

        require_gt!(
            self.min_base_futarchic_liquidity,
            0,
            FutarchyError::InsufficientLiquidity
        );

        require_gt!(
            self.min_quote_futarchic_liquidity,
            0,
            FutarchyError::InsufficientLiquidity
        );

        require_gt!(
            self.twap_max_observation_change_per_update,
            0u128,
            FutarchyError::InvalidMaxObservationChange
        );

        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct OldDao {
    /// Embedded FutarchyAmm - 1:1 relationship
    pub amm: FutarchyAmm,
    /// `nonce` + `dao_creator` are PDA seeds
    pub nonce: u64,
    pub dao_creator: Pubkey,
    pub pda_bump: u8,
    pub squads_multisig: Pubkey,
    pub squads_multisig_vault: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub proposal_count: u32,
    // the percentage, in basis points, the pass price needs to be above the
    // fail price in order for the proposal to pass
    pub pass_threshold_bps: u16,
    pub seconds_per_proposal: u32,
    /// For manipulation-resistance the TWAP is a time-weighted average observation,
    /// where observation tries to approximate price but can only move by
    /// `twap_max_observation_change_per_update` per update. Because it can only move
    /// a little bit per update, you need to check that it has a good initial observation.
    /// Otherwise, an attacker could create a very high initial observation in the pass
    /// market and a very low one in the fail market to force the proposal to pass.
    ///
    /// We recommend setting an initial observation around the spot price of the token,
    /// and max observation change per update around 2% the spot price of the token.
    /// For example, if the spot price of META is $400, we'd recommend setting an initial
    /// observation of 400 (converted into the AMM prices) and a max observation change per
    /// update of 8 (also converted into the AMM prices). Observations can be updated once
    /// a minute, so 2% allows the proposal market to reach double the spot price or 0
    /// in 50 minutes.
    pub twap_initial_observation: u128,
    pub twap_max_observation_change_per_update: u128,
    /// Forces TWAP calculation to start after `twap_start_delay_seconds` seconds
    pub twap_start_delay_seconds: u32,
    /// As an anti-spam measure and to help liquidity, you need to lock up some liquidity
    /// in both futarchic markets in order to create a proposal.
    ///
    /// For example, for META, we can use a `min_quote_futarchic_liquidity` of
    /// 5000 * 1_000_000 (5000 USDC) and a `min_base_futarchic_liquidity` of
    /// 10 * 1_000_000_000 (10 META).
    pub min_quote_futarchic_liquidity: u64,
    pub min_base_futarchic_liquidity: u64,
    /// Minimum amount of base tokens that must be staked to launch a proposal
    pub base_to_stake: u64,
    pub seq_num: u64,
    pub initial_spending_limit: Option<InitialSpendingLimit>,
    /// The percentage, in basis points, the pass price needs to be above the
    /// fail price in order for the proposal to pass for team-sponsored proposals.
    ///
    /// Can be negative to allow for team-sponsored proposals to pass by default.
    pub team_sponsored_pass_threshold_bps: i16,
    pub team_address: Pubkey,
    pub optimistic_proposal: Option<OptimisticProposal>,
    pub is_optimistic_governance_enabled: bool,
}
