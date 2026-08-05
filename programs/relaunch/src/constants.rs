pub const TOKEN_SCALE: u64 = 1_000_000;

pub const PRICE_SCALE: u128 = 1_000_000_000_000;

/// 10M tokens with 6 decimals, distributed pro-rata to depositors.
pub const TOKENS_TO_DEPOSITORS: u64 = 10_000_000 * TOKEN_SCALE;
/// 2M tokens with 6 decimals, paired with recovered USDC in the futarchy AMM.
pub const TOKENS_TO_FUTARCHY_LIQUIDITY: u64 = 2_000_000 * TOKEN_SCALE;

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
