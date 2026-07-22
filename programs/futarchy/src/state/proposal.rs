use super::*;

pub const SEED_PROPOSAL: &[u8] = b"proposal";

#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, Debug, InitSpace)]
pub enum ProposalState {
    Draft { amount_staked: u64 },
    Pending,
    Passed,
    Failed,
    Removed,
}

impl std::fmt::Display for ProposalState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Proposal {
    pub number: u32,
    pub proposer: Pubkey,
    pub timestamp_enqueued: i64,
    pub state: ProposalState,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub dao: Pubkey,
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_seconds: u32,
    pub squads_proposal: Pubkey,
    pub pass_base_mint: Pubkey,
    pub pass_quote_mint: Pubkey,
    pub fail_base_mint: Pubkey,
    pub fail_quote_mint: Pubkey,
    pub is_team_sponsored: bool,
    /// Snapshot of the kind's threshold at create. Only `finalize_proposal`
    /// reads it.
    pub pass_threshold_bps: i16,
    /// Snapshot of the kind's blockable flag at create. Only
    /// `admin_cancel_proposal` reads it.
    pub council_can_block: bool,
    /// The typed action parameters; the variant is the proposal's kind, and
    /// `ProposalAction::params()` resolves its per-kind constants.
    /// `apply_liquidation` reads the liquidator from here; clients read the
    /// rest.
    pub action: ProposalAction,
}

#[account]
#[derive(InitSpace)]
pub struct OldProposal {
    pub number: u32,
    pub proposer: Pubkey,
    pub timestamp_enqueued: i64,
    pub state: ProposalState,
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub dao: Pubkey,
    pub pda_bump: u8,
    pub question: Pubkey,
    pub duration_in_seconds: u32,
    pub squads_proposal: Pubkey,
    pub pass_base_mint: Pubkey,
    pub pass_quote_mint: Pubkey,
    pub fail_base_mint: Pubkey,
    pub fail_quote_mint: Pubkey,
    pub is_team_sponsored: bool,
}
