# PR Changes for launchpad-funding-fees

## 2025-11-12 - Feature: Launch Funding Fees

**Description**: Introduced funding fees for launchpad launches and fixed total committed amount tracking to prevent rounding errors

### Changes

**New Functionality: Funding Fees**
- Created new utility module `programs/launchpad/src/utils.rs`
- Implemented `apply_funding_fee` function to calculate and apply fees to funding amounts
- Fees are applied using `div_ceil` for proper rounding

**Bug Fix: Total Committed Amount Tracking**
- Modified `programs/launchpad/src/instructions/fund.rs` (lines 90-116)
- Changed tracking logic to calculate the delta of fee-adjusted amounts before and after each funding increment
- Previous implementation directly added the raw amount, which caused discrepancies when fees used `div_ceil` rounding
- New approach: tracks the actual change in the launch's `committed_amount` field to ensure accuracy

### Technical Details

The fix addresses a subtle rounding error issue:
- When funding fees use `div_ceil`, there can be rounding differences between the intended amount and the actual fee-adjusted amount
- By calculating `total_committed_amount` as the delta of the launch's `committed_amount` (before and after the increment), we ensure consistency
- This approach makes `total_committed_amount` accurately reflect the actual committed funds, regardless of fee rounding behavior

### Files Modified
- `programs/launchpad/src/instructions/fund.rs` - Updated funding logic (lines 90-116)
- `programs/launchpad/src/utils.rs` - New file with fee calculation utility

---
