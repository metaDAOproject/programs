// ============================================================================
// Fuzz Test Configuration
// ============================================================================
pub const FUZZ_ITERATIONS: u64 = 1000;
pub const FLOWS_PER_ITERATION: u64 = 20;

// ============================================================================
// Test Token Amounts
// ============================================================================
pub const TEST_AIRDROP_SOL: u64 = 5_000_000;
pub const TEST_BASE_INITIAL_AMOUNT: u64 = 1_000_000_000_000_000_000;
pub const TEST_QUOTE_INITIAL_AMOUNT: u64 = 1_000_000_000_000_000_000; // USDC has 6 decimals
pub const TEST_INITIAL_LIQUIDITY_PROVIDER_BASE_INITIAL_AMOUNT: u64 = 200_000_000_000;
pub const TEST_INITIAL_LIQUIDITY_PROVIDER_QUOTE_INITIAL_AMOUNT: u64 = 200_000_000_000;
pub const TEST_INITIAL_STAKE_AMOUNT: u64 = 1_000_000;
pub const MIN_TRADE_TIME_FORWARD_SECONDS: i64 = 60;
pub const MAX_TRADE_TIME_FORWARD_SECONDS: i64 = 600;
pub const FINALIZE_TIME_FORWARD_SECONDS: i64 = 90_000;
