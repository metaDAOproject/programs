use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LaunchState {
    Initialized,
    Live,
    Closed,
    Complete,
    Refunding,
}

impl ToString for LaunchState {
    fn to_string(&self) -> String {
        match self {
            LaunchState::Initialized => "Initialized",
            LaunchState::Live => "Live",
            LaunchState::Closed => "Closed",
            LaunchState::Complete => "Complete",
            LaunchState::Refunding => "Refunding",
        }
        .to_string()
    }
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    /// The PDA bump.
    pub pda_bump: u8,
    /// The minimum amount of USDC that must be raised, otherwise
    /// everyone can get their USDC back.
    pub minimum_raise_amount: u64,
    /// The monthly spending limit the DAO allocates to the team. Must be
    /// less than 1/6th of the minimum raise amount (so 6 months of burn).
    pub monthly_spending_limit_amount: u64,
    /// The wallets that have access to the monthly spending limit.
    #[max_len(10)]
    pub monthly_spending_limit_members: Vec<Pubkey>,
    /// The account that can start the launch.
    pub launch_authority: Pubkey,
    /// The launch signer address. Needed because Raydium pools need a SOL payer and this PDA can't hold SOL.
    pub launch_signer: Pubkey,
    /// The PDA bump for the launch signer.
    pub launch_signer_pda_bump: u8,
    /// The USDC vault that will hold the USDC raised until the launch is over.
    pub launch_quote_vault: Pubkey,
    /// The token vault, used to send tokens to Raydium.
    pub launch_base_vault: Pubkey,
    /// The token that will be minted to funders and that will control the DAO.
    pub base_mint: Pubkey,
    /// The USDC mint.
    pub quote_mint: Pubkey,
    /// The unix timestamp when the launch was started.
    pub unix_timestamp_started: Option<i64>,
    /// The unix timestamp when the launch stopped taking new contributions.
    pub unix_timestamp_closed: Option<i64>,
    /// The amount of USDC that has been committed by the users.
    pub total_committed_amount: u64,
    /// The state of the launch.
    pub state: LaunchState,
    /// The sequence number of this launch. Useful for sorting events.
    pub seq_num: u64,
    /// The number of seconds that the launch will be live for.
    pub seconds_for_launch: u32,
    /// The DAO, if the launch is complete.
    pub dao: Option<Pubkey>,
    /// The DAO treasury that USDC / LP is sent to, if the launch is complete.
    pub dao_vault: Option<Pubkey>,
    /// The address that will receive the performance package tokens.
    pub performance_package_grantee: Pubkey,
    /// The amount of tokens to be granted to the performance package grantee.
    pub performance_package_token_amount: u64,
    /// The number of months that insiders must wait before unlocking their tokens.
    pub months_until_insiders_can_unlock: u8,
    /// The initial address used to sponsor team proposals.
    pub team_address: Pubkey,
    /// The amount of USDC that the launch authority has approved across all funders.
    pub total_approved_amount: u64,
    /// The amount of additional tokens to be minted on a successful launch.
    pub additional_tokens_amount: u64,
    /// The token account that will receive the additional tokens.
    pub additional_tokens_recipient: Option<Pubkey>,
    /// Are the additional tokens claimed
    pub additional_tokens_claimed: bool,
    /// The unix timestamp when the launch was completed.
    pub unix_timestamp_completed: Option<i64>,
    /// Whether the performance package has been initialized.
    pub is_performance_package_initialized: bool,
    /// Number of seconds after launch start before the funding accumulator
    /// begins tracking.
    pub accumulator_activation_delay_seconds: u32,
}
