# Performance Package v2 Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section in `vibes/001-performance-package-v2.md` for full context
3. Do ONLY that task - nothing else
4. After completing the task, if necessary, verify:
   - First run `./rebuild.sh` (rebuilds SDK, runs typecheck and lint)
   - Then run `anchor test --skip-build` to execute tests
   - Run only the performancePackageV2 tests by specifying `describe.only("performance_package_v2" ...)` inside `tests/main.test.ts` and then remove the `.only` when you're done
   - Since you will be fixing tests individually, confirm they work by using `it.only`
5. Once done, remove the completed task from this file entirely
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify

**Reference:** Full spec is in `vibes/001-performance-package-v2.md`

**Note:** We implement Time oracle first. FutarchyTwap is added in Phase 9 after the core flow works.

---

## Tasks

### Phase 2: initialize_performance_package

> Reference: `001-performance-package-v2.md` → Instruction 1

- [NEXT] 2.1 Write initialize_performance_package instruction
  - Create `instructions/initialize_performance_package.rs`
  - Implement `InitializePerformancePackage` accounts struct with constraints
  - Implement `InitializePerformancePackageArgs` struct
  - Implement `validate()` and `handle()` methods
  - Add validation for reward function configuration
  - Emit `PerformancePackageCreatedEvent`
  - Export from `instructions/mod.rs` and wire up in `lib.rs`

- [ ] 2.2 Add SDK method for initialize_performance_package
  - Add `initializePerformancePackageIx()` method to `PerformancePackageV2Client`
  - Add `fetchPerformancePackage()` and `deserializePerformancePackage()` methods
  - Add type exports for `PerformancePackageAccount`, `OracleReader`, `RewardFunction`, etc.
  - Run `./rebuild.sh`

- [ ] 2.3 Write unit tests for initialize_performance_package
  - Create `tests/performancePackageV2/unit/initializePerformancePackage.test.ts`
  - Add test utils in `utils.ts` (e.g., `setupMintGovernorWithAuthority`)
  - Test: successfully initializes with Time oracle and CliffLinear reward function
  - Test: successfully initializes with Time oracle and Threshold reward function
  - Test: fails when create_key does not sign
  - Test: fails when mint_authority.authorized_minter does not match PP
  - Test: fails when mint_governor.mint does not match mint
  - Test: fails with invalid reward function config (unsorted tranches, invalid values)
  - Import test suite in `main.test.ts`

### Phase 3: start_unlock

> Reference: `001-performance-package-v2.md` → Instruction 2

- [ ] 3.1 Write start_unlock instruction
  - Create `instructions/start_unlock.rs`
  - Implement accounts struct with authority/recipient check
  - Implement `validate()`: check status == Locked, min_unlock_timestamp reached
  - Implement `handle()`: call `oracle_reader.record_start()`, set status = Unlocking
  - Add `record_start()` method to `OracleReader` (Time variant: no-op)
  - Emit `UnlockStartedEvent`
  - Wire up in `lib.rs`

- [ ] 3.2 Add SDK method for start_unlock
  - Add `startUnlockIx()` method to `PerformancePackageV2Client`
  - Run `./rebuild.sh`

- [ ] 3.3 Write unit tests for start_unlock
  - Create `tests/performancePackageV2/unit/startUnlock.test.ts`
  - Test: successfully starts when called by authority
  - Test: successfully starts when called by recipient
  - Test: fails when status is not Locked
  - Test: fails when min_unlock_timestamp not reached
  - Test: fails when signer is neither authority nor recipient

### Phase 4: complete_unlock

> Reference: `001-performance-package-v2.md` → Instruction 3

- [ ] 4.1 Write complete_unlock instruction
  - Create `instructions/complete_unlock.rs`
  - Implement accounts struct with mint_governor CPI accounts
  - Implement `validate()`: check status == Unlocking, can_end(), account matches
  - Implement `handle()`: record_end, compute_value, calculate rewards, CPI mint, reset, set Locked
  - Add `record_end()`, `can_end()`, `compute_value()`, `reset()` to `OracleReader`
  - Add `calculate()` method to `RewardFunction` (both variants)
  - Emit `UnlockCompletedEvent`
  - Wire up in `lib.rs`

- [ ] 4.2 Add SDK method for complete_unlock
  - Add `completeUnlockIx()` method to `PerformancePackageV2Client`
  - Run `./rebuild.sh`

- [ ] 4.3 Write unit tests for complete_unlock
  - Create `tests/performancePackageV2/unit/completeUnlock.test.ts`
  - Test: successfully completes unlock and mints tokens (CliffLinear)
  - Test: successfully completes unlock and mints tokens (Threshold)
  - Test: mints correct amount to recipient (cumulative - already_paid)
  - Test: updates total_rewards_paid_out
  - Test: resets oracle state (for Time: no state to reset)
  - Test: rewards only increase (never decrease)
  - Test: succeeds with zero mint amount when rewards already paid
  - Test: can be started again after complete (cycle repeats)
  - Test: fails when status is not Unlocking
  - Test: fails when signer is neither authority nor recipient
  - Test: fails when mint_governor doesn't match

### Phase 5: change_authority

> Reference: `001-performance-package-v2.md` → Instruction 4

- [ ] 5.1 Write change_authority instruction
  - Create `instructions/change_authority.rs`
  - Implement accounts struct with authority signer check
  - Implement `validate()` and `handle()`
  - Emit `AuthorityChangedEvent`
  - Wire up in `lib.rs`

- [ ] 5.2 Add SDK method for change_authority
  - Add `changeAuthorityIx()` method to `PerformancePackageV2Client`
  - Run `./rebuild.sh`

- [ ] 5.3 Write unit tests for change_authority
  - Create `tests/performancePackageV2/unit/changeAuthority.test.ts`
  - Test: successfully changes authority
  - Test: new authority can perform authority actions
  - Test: old authority cannot perform authority actions after change
  - Test: fails when signer is not current authority

### Phase 6: propose_change

> Reference: `001-performance-package-v2.md` → Instruction 5

- [ ] 6.1 Write propose_change instruction
  - Create `instructions/propose_change.rs`
  - Implement accounts struct with ChangeRequest PDA init
  - Implement `ProposeChangeArgs` with optional fields and pda_nonce
  - Implement `validate()`: at least one Some field, validate configs
  - Implement `handle()`: create ChangeRequest
  - Emit `ChangeProposedEvent`
  - Wire up in `lib.rs`

- [ ] 6.2 Add SDK method for propose_change
  - Add `proposeChangeIx()` method to `PerformancePackageV2Client`
  - Add `fetchChangeRequest()` method
  - Run `./rebuild.sh`

- [ ] 6.3 Write unit tests for propose_change
  - Create `tests/performancePackageV2/unit/proposeChange.test.ts`
  - Test: successfully proposes change when called by authority
  - Test: successfully proposes change when called by recipient
  - Test: successfully proposes recipient change
  - Test: successfully proposes oracle change
  - Test: successfully proposes reward function change
  - Test: successfully proposes multiple changes at once
  - Test: allows multiple concurrent proposals with different nonces
  - Test: fails when all optional fields are None
  - Test: fails when signer is neither authority nor recipient

### Phase 7: execute_change

> Reference: `001-performance-package-v2.md` → Instruction 6

- [ ] 7.1 Write execute_change instruction
  - Create `instructions/execute_change.rs`
  - Implement accounts struct with ChangeRequest validation
  - Implement `validate()`: opposite party check, Locked status for config changes
  - Implement `handle()`: apply changes, close ChangeRequest
  - Emit `ChangeExecutedEvent`
  - Wire up in `lib.rs`

- [ ] 7.2 Add SDK method for execute_change
  - Add `executeChangeIx()` method to `PerformancePackageV2Client`
  - Run `./rebuild.sh`

- [ ] 7.3 Write unit tests for execute_change
  - Create `tests/performancePackageV2/unit/executeChange.test.ts`
  - Test: successfully executes (authority proposed, recipient signs)
  - Test: successfully executes (recipient proposed, authority signs)
  - Test: successfully executes recipient change
  - Test: successfully executes oracle change
  - Test: successfully executes reward function change
  - Test: successfully executes multiple changes at once
  - Test: closes change_request account and returns rent
  - Test: fails when same party tries to propose and execute
  - Test: fails when oracle change attempted while Unlocking
  - Test: fails when reward function change attempted while Unlocking

### Phase 8: close_performance_package

> Reference: `001-performance-package-v2.md` → Instruction 7

- [ ] 8.1 Write close_performance_package instruction
  - Create `instructions/close_performance_package.rs`
  - Implement accounts struct with admin check
  - Implement `validate()`: admin == METADAO_ADMIN, status == Locked
  - Implement `handle()`: close account
  - Emit `PerformancePackageClosedEvent`
  - Wire up in `lib.rs`

- [ ] 8.2 Add SDK method for close_performance_package
  - Add `closePerformancePackageIx()` method to `PerformancePackageV2Client`
  - Run `./rebuild.sh`

- [ ] 8.3 Write unit tests for close_performance_package
  - Create `tests/performancePackageV2/unit/closePerformancePackage.test.ts`
  - Test: successfully closes PP when called by admin
  - Test: fails when caller is not admin
  - Test: fails when status is Unlocking

### Phase 9: FutarchyTwap Oracle Support

> Reference: `001-performance-package-v2.md` → OracleReader variants

- [ ] 9.1 Add FutarchyTwap variant to OracleReader
  - Add `FutarchyTwap` variant with fields: amm, min_duration, start_value/time, end_value/time
  - Implement `record_start()` for FutarchyTwap (read accumulator from AMM remaining_account)
  - Implement `record_end()` for FutarchyTwap
  - Implement `can_end()` for FutarchyTwap (check min_duration)
  - Implement `compute_value()` for FutarchyTwap (TWAP calculation)
  - Implement `reset()` for FutarchyTwap

- [ ] 9.2 Update instructions for FutarchyTwap
  - Update `start_unlock` to handle remaining_accounts for FutarchyTwap
  - Update `complete_unlock` to handle remaining_accounts for FutarchyTwap
  - Add validation that AMM account matches oracle_reader.amm

- [ ] 9.3 Update SDK for FutarchyTwap
  - Update `startUnlockIx()` to accept optional AMM account
  - Update `completeUnlockIx()` to accept optional AMM account
  - Run `./rebuild.sh`

- [ ] 9.4 Write unit tests for FutarchyTwap
  - Update `initializePerformancePackage.test.ts`: add test for FutarchyTwap + CliffLinear
  - Update `initializePerformancePackage.test.ts`: add test for FutarchyTwap + Threshold
  - Update `startUnlock.test.ts`: add test for recording start snapshot
  - Update `startUnlock.test.ts`: add test for wrong AMM account failure
  - Update `completeUnlock.test.ts`: add test for recording end snapshot
  - Update `completeUnlock.test.ts`: add test for TWAP computation
  - Update `completeUnlock.test.ts`: add test for min_duration not reached failure
