use anchor_lang::prelude::*;
use futarchy::MAX_SPENDING_LIMIT_MEMBERS;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RelaunchState {
    Initialized,
    Live,
    SellPending,
    Sold,
    Swapped,
    Complete,
    Failed,
}

#[account]
#[derive(InitSpace)]
pub struct Relaunch {
    // identity & authority
    /// The initializer; executes the sell + swap legs.
    pub admin: Pubkey,
    /// The token that will be distributed to depositors and that will control the DAO.
    pub new_mint: Pubkey,
    /// The token being relaunched.
    pub old_mint: Pubkey,
    /// The canonical PumpSwap pool for the old mint, validated at init.
    pub source_pool: Pubkey,
    /// The source pool's quote mint — WSOL or USDC. WSOL sources swap through
    /// the `usdc_swap_pool` constant.
    pub source_quote_mint: Pubkey,

    // signer & vaults (all ATAs of relaunch_signer)
    /// The PDA that signs all CPIs and owns the vaults: `["relaunch_signer", relaunch]`.
    pub relaunch_signer: Pubkey,
    /// The PDA bump for the relaunch signer.
    pub relaunch_signer_bump: u8,
    /// The vault that escrows deposited old tokens.
    pub old_token_vault: Pubkey,
    /// The vault that holds the minted new tokens until claim / liquidity provision.
    pub new_token_vault: Pubkey,
    /// The vault that receives raw sell proceeds (WSOL or USDC).
    pub source_quote_vault: Pubkey,
    /// The vault that receives the swap-leg output; == `source_quote_vault`
    /// for USDC sources.
    pub usdc_vault: Pubkey,

    // config
    /// The minimum participation, denominated in bps of old-token total supply.
    pub threshold_bps: u16,
    /// The old mint supply captured at init (threshold denominator).
    pub old_supply_snapshot: u64,
    /// The number of seconds that deposits will be open for.
    pub seconds_for_deposits: u32,
    /// The admin's window to sell after deposits close.
    pub grace_period_seconds: u32,

    // DAO passthrough config (launchpad-style)
    /// The monthly spending limit the DAO allocates to the team. Zero, with
    /// no members, means the DAO launches without a spending limit.
    pub monthly_spending_limit_amount: u64,
    /// The wallets that have access to the monthly spending limit.
    #[max_len(MAX_SPENDING_LIMIT_MEMBERS)]
    pub monthly_spending_limit_members: Vec<Pubkey>,
    /// The initial address used to sponsor team proposals.
    pub team_address: Pubkey,

    // progress
    /// The state of the relaunch.
    pub state: RelaunchState,
    /// The amount of old tokens deposited across all depositors.
    pub total_deposited: u64,
    /// The raw sell proceeds, in the source quote asset.
    pub quote_recovered: u64,
    /// The post-swap USDC (== `quote_recovered` for USDC sources).
    pub usdc_recovered: u64,
    /// The unix timestamp when deposits were opened.
    pub unix_timestamp_started: Option<i64>,
    /// The unix timestamp when deposits were closed.
    pub unix_timestamp_closed: Option<i64>,
    /// The unix timestamp when the relaunch was completed.
    pub unix_timestamp_completed: Option<i64>,
    /// The DAO, if the relaunch is complete.
    pub dao: Option<Pubkey>,
    /// The DAO's Squads multisig vault, if the relaunch is complete.
    pub dao_vault: Option<Pubkey>,
    /// The sequence number of this relaunch used for sorting events.
    pub seq_num: u64,
    /// The PDA bump.
    pub pda_bump: u8,
}
