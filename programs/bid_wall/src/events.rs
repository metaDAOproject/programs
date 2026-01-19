use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CommonFields {
    pub slot: u64,
    pub unix_timestamp: i64,
    pub bid_wall_seq_num: u64,
}

impl CommonFields {
    pub fn new(clock: &Clock, bid_wall_seq_num: u64) -> Self {
        Self {
            slot: clock.slot,
            unix_timestamp: clock.unix_timestamp,
            bid_wall_seq_num,
        }
    }
}

#[event]
pub struct BidWallInitializedEvent {
    pub common: CommonFields,
    pub bid_wall: Pubkey,
    pub nonce: u64,
    pub initial_amm_quote_reserves: u64,
    pub amount: u64,
    pub creator: Pubkey,
    pub authority: Pubkey,
    pub dao_treasury: Pubkey,
    pub base_mint: Pubkey,
    pub fee_recipient: Pubkey,
    pub duration_seconds: u32,
    pub fee_decay_duration_seconds: u32,
    pub max_fee_bps: u16,
    pub min_fee_bps: u16,
    pub pda_bump: u8,
}

#[event]
pub struct BidWallTokensSoldEvent {
    pub common: CommonFields,
    pub bid_wall: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub fee: u64,
    pub post_bid_wall_quote_token_account_amount: u64,
    pub post_bid_wall_base_bought_amount: u64,
    pub user: Pubkey,
}

#[event]
pub struct BidWallFeesCollectedEvent {
    pub common: CommonFields,
    pub bid_wall: Pubkey,
    pub fees_collected: u64,
    pub post_bid_wall_quote_token_account_amount: u64,
}

#[event]
pub struct BidWallClosedEvent {
    pub common: CommonFields,
    pub bid_wall: Pubkey,
}

#[event]
pub struct BidWallCanceledEvent {
    pub common: CommonFields,
    pub bid_wall: Pubkey,
}
