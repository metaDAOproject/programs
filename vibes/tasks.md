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

### Phase 8: close_performance_package

> Reference: `001-performance-package-v2.md` → Instruction 7

- [NEXT] 8.1 Write close_performance_package instruction
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
