use anchor_lang::prelude::*;

#[error_code]
pub enum AmmError {
    #[msg("An assertion failed")]
    AssertFailed,
    #[msg("Can't get a TWAP before some observations have been stored")]
    NoSlotsPassed,
    #[msg("Can't swap through a pool without token reserves on either side")]
    NoReserves,
    #[msg("Input token amount is too large for a swap, causes overflow")]
    InputAmountOverflow,
    #[msg("Add liquidity calculation error")]
    AddLiquidityCalculationError,
    #[msg("Error in decimal scale conversion")]
    DecimalScaleError,
    #[msg("You can't create an AMM pool where the token mints are the same")]
    SameTokenMints,
    #[msg("A user wouldn't have gotten back their `output_amount_min`, reverting")]
    SwapSlippageExceeded,
    #[msg("The user had insufficient balance to do this")]
    InsufficientBalance,
    #[msg("Must remove a non-zero amount of liquidity")]
    ZeroLiquidityRemove,
    #[msg("Cannot add liquidity with 0 tokens on either side")]
    ZeroLiquidityToAdd,
    #[msg("Must specify a non-zero `min_lp_tokens` when adding to an existing pool")]
    ZeroMinLpTokens,
    #[msg("LP wouldn't have gotten back `lp_token_min`")]
    AddLiquiditySlippageExceeded,
    #[msg("LP would have spent more than `max_base_amount`")]
    AddLiquidityMaxBaseExceeded,
    #[msg("`quote_amount` must be greater than 100000000 when initializing a pool")]
    InsufficientQuoteAmount,
    #[msg("Users must swap a non-zero amount")]
    ZeroSwapAmount,
    #[msg("K should always be increasing")]
    ConstantProductInvariantFailed,
    #[msg("Casting has caused an overflow")]
    CastingOverflow,
}
