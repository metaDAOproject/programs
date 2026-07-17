use super::*;

pub const DAY_SECONDS: u32 = 24 * 60 * 60;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub struct InstructionParams {
    pub duration_seconds: u32,
    /// Signed: a negative threshold lets a proposal pass even when the pass
    /// price is below the fail price.
    pub pass_threshold_bps: i16,
    /// Launch condition: the proposal must be team-sponsored to launch.
    pub requires_team_sponsorship: bool,
    pub council_can_block: bool,
    /// Failure-triggered cooldown, checked at launch. 0 = none.
    pub cooldown_seconds: u32,
}

/// What a hostile takeover declares for the spending limit.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum SpendingLimitAction {
    Keep,
    Remove,
    Set(InitialSpendingLimit),
}

/// The typed action parameters, stored on the proposal. The borsh variant tag
/// is the proposal's kind discriminator, so variants are append-only — the
/// variant index is the wire tag.
#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, PartialEq, Eq, InitSpace)]
pub enum ProposalAction {
    LargeSpend {
        amount: u64,
    },
    MintTokens {
        amount: u64,
        recipient: Pubkey,
    },
    /// `Some` = replace the spending limit, `None` = remove it.
    SpendingLimitChange {
        config: Option<InitialSpendingLimit>,
    },
    ExecuteArbitrary,
    HostileTakeover {
        new_team_address: Pubkey,
        spending_limit_action: SpendingLimitAction,
    },
    HostileLiquidate {
        liquidator: Pubkey,
    },
}

impl ProposalAction {
    /// The protocol-wide parameters of each proposal kind. Hardcoded: there is
    /// no per-DAO tuning.
    pub fn params(&self) -> InstructionParams {
        match self {
            ProposalAction::LargeSpend { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 3 / 2, // 1.5 days
                pass_threshold_bps: -1000,
                requires_team_sponsorship: true,
                council_can_block: true,
                cooldown_seconds: 0,
            },
            ProposalAction::MintTokens { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 5,
                pass_threshold_bps: 500,
                requires_team_sponsorship: false,
                council_can_block: true,
                cooldown_seconds: 0,
            },
            ProposalAction::SpendingLimitChange { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 5,
                pass_threshold_bps: 500,
                requires_team_sponsorship: true,
                council_can_block: true,
                cooldown_seconds: 0,
            },
            ProposalAction::ExecuteArbitrary => InstructionParams {
                duration_seconds: DAY_SECONDS * 10,
                pass_threshold_bps: 1000,
                requires_team_sponsorship: false,
                council_can_block: true,
                cooldown_seconds: 0,
            },
            ProposalAction::HostileTakeover { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 20,
                pass_threshold_bps: 1000,
                requires_team_sponsorship: false,
                council_can_block: false,
                cooldown_seconds: DAY_SECONDS * 20,
            },
            ProposalAction::HostileLiquidate { .. } => InstructionParams {
                duration_seconds: DAY_SECONDS * 10,
                pass_threshold_bps: 2500,
                requires_team_sponsorship: false,
                council_can_block: false,
                cooldown_seconds: DAY_SECONDS * 10,
            },
        }
    }
}
