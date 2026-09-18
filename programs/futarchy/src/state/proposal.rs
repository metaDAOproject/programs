use super::*;

pub const SEED_PROPOSAL: &[u8] = b"proposal";

/// The range `admin_update_proposal_params` may set `pass_threshold_bps` to.
pub const MIN_PROPOSAL_PASS_THRESHOLD_BPS: i16 = -9_999;
pub const MAX_PROPOSAL_PASS_THRESHOLD_BPS: i16 = 9_999;

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
    /// The team that last sponsored the proposal. `None` = never sponsored.
    pub sponsored_by: Option<Pubkey>,
    pub pass_threshold_bps: i16,
    /// Snapshot of the kind's blockable flag at create.
    pub council_can_block: bool,
    /// The typed action parameters.
    pub action: ProposalAction,
    /// Set by `admin_update_proposal_params`. `launch_proposal` then leaves the 
    /// duration and threshold alone.
    pub params_overridden: bool,
}

impl Proposal {
    /// Whether the sponsorship is by the DAO's current team.
    pub fn is_sponsored_by(&self, team_address: Pubkey) -> bool {
        self.sponsored_by == Some(team_address)
    }

    /// The parameters this proposal launches under.
    pub fn launch_params(&self, dao: &Dao) -> InstructionParams {
        let params = self
            .action
            .params_for(dao, self.is_sponsored_by(dao.team_address));

        if !self.params_overridden {
            return params;
        }

        InstructionParams {
            duration_seconds: self.duration_in_seconds,
            pass_threshold_bps: self.pass_threshold_bps,
            ..params
        }
    }

    /// A migrated `Proposal` account is exactly this long.
    pub const MIGRATED_SIZE: usize = Proposal::INIT_SPACE + 8;

    /// Errors unless `resize_proposal` has migrated the account.
    pub fn assert_migrated(account: &AccountInfo) -> Result<()> {
        require_eq!(
            account.data_len(),
            Proposal::MIGRATED_SIZE,
            FutarchyError::AccountNotMigrated
        );
        Ok(())
    }
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
