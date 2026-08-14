pub const TOKEN_SCALE: u64 = 1_000_000;

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

/// 12.5M tokens with 6 decimals, distributed pro-rata to depositors.
pub const TOKENS_TO_DEPOSITORS: u64 = 12_500_000 * TOKEN_SCALE;
/// 12.5M tokens with 6 decimals, paired with all recovered USDC in the
/// futarchy AMM.
pub const TOKENS_TO_FUTARCHY_LIQUIDITY: u64 = 12_500_000 * TOKEN_SCALE;
/// 1.5M tokens with 6 decimals, staked to create a proposal (launchpad's value).
pub const PROPOSAL_MIN_STAKE_TOKENS: u64 = 1_500_000 * TOKEN_SCALE;

/// 1 year.
pub const MAX_SECONDS_FOR_DEPOSITS: u32 = 60 * 60 * 24 * 365;

pub mod wsol_mint {
    use anchor_lang::prelude::declare_id;

    declare_id!("So11111111111111111111111111111111111111112");
}

pub mod usdc_mint {
    use anchor_lang::prelude::declare_id;

    declare_id!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
}

// pump

/// Seed of the pump pool-authority PDA, derived under the pump bonding-curve
/// program: `["pool-authority", mint]`. The canonical PumpSwap pool for a
/// mint has this PDA as its `creator`.
pub const PUMP_POOL_AUTHORITY_SEED: &[u8] = b"pool-authority";

/// Seed of PumpSwap pool PDAs, derived under pump_amm:
/// `["pool", index_le_u16, creator, base_mint, quote_mint]`.
pub const PUMP_POOL_SEED: &[u8] = b"pool";

/// The pump bonding-curve program. The pool-authority PDA that creates
/// canonical PumpSwap pools at graduation is derived under this program.
pub mod pump_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
}

/// PumpSwap — the AMM that canonical graduation pools live on.
pub mod pump_amm_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
}

/// The pump fee program that PumpSwap consults for its dynamic fee tiers.
pub mod pump_fees_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
}

/// pump_amm's global config: the `["global_config"]` PDA under pump_amm.
pub mod pump_amm_global_config {
    use anchor_lang::prelude::declare_id;

    declare_id!("ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw");
}

/// pump_amm's event authority: the `["__event_authority"]` PDA under pump_amm.
pub mod pump_amm_event_authority {
    use anchor_lang::prelude::declare_id;

    declare_id!("GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR");
}

/// The fee config the pump fee program keeps for pump_amm: the
/// `["fee_config", pump_amm program id]` PDA under pump_fees.
pub mod pump_amm_fee_config {
    use anchor_lang::prelude::declare_id;

    declare_id!("5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx");
}

// Raydium

/// Raydium's legacy "Standard" AMM v4, where pre-PumpSwap pump graduations
/// live.
pub mod raydium_amm_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
}

/// The global authority PDA over every AMM v4 vault: `["amm authority"]`.
pub mod raydium_amm_authority {
    use anchor_lang::prelude::declare_id;

    declare_id!("5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1");
}

/// OpenBook v1. Stored as `market_program` by every orderbook-era AMM v4
/// pool. All pump graduations have this as an orderbook.
pub mod openbook_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX");
}

/// A Raydium source pool must have at least this much LP burned
/// (`lp_amount - lp_mint.supply`, raw units, 9 decimals).
pub const RAYDIUM_MIN_BURNED_LP: u64 = 4_000_000_000_000;

// Orca

pub mod whirlpool_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");
}

/// Orca Whirlpool SOL/USDC 0.04% — the pinned venue for the WSOL→USDC swap leg.
pub mod usdc_swap_pool {
    use anchor_lang::prelude::declare_id;

    declare_id!("Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE");
}

/// SPL Memo, required by whirlpool's v2 instructions.
pub mod memo_program {
    use anchor_lang::prelude::declare_id;

    declare_id!("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
}
