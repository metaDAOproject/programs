# Launchpad v8 Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section in `vibes/launchpad_v8_spec.md` for full context
3. Do ONLY that task - nothing else
4. After completing the task, verify with the specified verification command
5. If successful, remove the completed task from this file
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify

**IMPORTANT:** After completing a task, always run `./rebuild.sh` before handing back to the user. This rebuilds programs, regenerates SDK types, syncs node_modules, and lints.

**Reference:** Full implementation plan is in `vibes/launchpad_v8_spec.md`

---

## Tasks

### Phase 1: Scaffolding + State

> Reference: `launchpad_v8_spec.md` → "Constants", "State", "Errors", "Events"

### Phase 2: `initialize_launch`

> Reference: `launchpad_v8_spec.md` → "1. initialize_launch — CHANGED"

### Phase 3: `start_launch` + `fund` + `close_launch`

> Reference: `launchpad_v8_spec.md` → instructions 2, 3, 5

### Phase 4: `set_funding_record_approval`

> Reference: `launchpad_v8_spec.md` → instruction 4

- [NEXT] 4.1 Implement `set_funding_record_approval` instruction (Rust)
  - Create `src/instructions/set_funding_record_approval.rs` — port from v7
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 4.2 Add `setFundingRecordApprovalIx` to SDK2 client
  - Port from v7 SDK2 client
  - Verify: `cd sdk2 && npx tsc --noEmit`

- [ ] 4.3 Write `setFundingRecordApproval` tests (tests #21–26)
  - Tests #21–26: all set_funding_record_approval tests per spec
  - Verify: `anchor test --skip-build` (with `.only`)

### Phase 5: `settle_launch`

> Reference: `launchpad_v8_spec.md` → "6. settle_launch — CHANGED"

- [ ] 5.1 Implement `settle_launch` instruction (Rust)
  - Create `src/instructions/settle_launch.rs` with `SettleLaunch` accounts struct, `validate()`, and `handle()`
  - Port from v7 `complete_launch` with key changes: mint_governor::mint_tokens CPI replaces token::set_authority, no mint authority transfer
  - Include StaticCompleteLaunchAccounts and MeteoraAccounts nested structs
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 5.2 Add `settleLaunchIx` to SDK2 client
  - Add the instruction builder method per spec (includes MintGovernor + Meteora + DAO account derivation)
  - Verify: `cd sdk2 && npx tsc --noEmit`

- [ ] 5.3 Write `settleLaunch` tests (tests #27–33)
  - Test #27: happy path — tokens minted via MintGovernor, DAO created, liquidity, metadata transfer, USDC distribution, MintGovernor admin still launch_signer
  - Test #28: sends all USDC to treasury when hasBidWall is false
  - Test #29: initializes bid wall when hasBidWall is true and funding exceeds 1.25x
  - Test #30: no bid wall when funding equals minimum raise
  - Test #31: no bid wall at exactly 1.25x boundary
  - Test #32: Refunding path — no tokens minted, no DAO
  - Test #33: fails when launch is in refunding state
  - Verify: `anchor test --skip-build` (with `.only`)

### Phase 6: `claim` + `refund` + `claim_additional_token_allocation`

> Reference: `launchpad_v8_spec.md` → instructions 8, 9, 10

- [ ] 6.1 Implement `claim` instruction (Rust)
  - Create `src/instructions/claim.rs` — port from v7
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 6.2 Implement `refund` instruction (Rust)
  - Create `src/instructions/refund.rs` — port from v7
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 6.3 Implement `claim_additional_token_allocation` instruction (Rust)
  - Create `src/instructions/claim_additional_token_allocation.rs` — port from v7
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 6.4 Add `claimIx`, `refundIx`, `claimAdditionalTokenAllocationIx` to SDK2 client
  - Port from v7 SDK2 client
  - Verify: `cd sdk2 && npx tsc --noEmit`

- [ ] 6.5 Write `claim` tests (tests #37–38)
  - Test #37: "successfully claims tokens after launch completion"
  - Test #38: "fails when launch is not complete"
  - Verify: `anchor test --skip-build` (with `.only`)

- [ ] 6.6 Write `refund` tests (tests #39–41)
  - Test #39: "allows refunds when launch is in refunding state"
  - Test #40: "works for oversubscribed launches"
  - Test #41: "fails when launch is not in refunding or complete state"
  - Verify: `anchor test --skip-build` (with `.only`)

- [ ] 6.7 Write `claimAdditionalTokenAllocation` tests (tests #42–43)
  - Test #42: "sets and claims additional token allocation successfully, and only once"
  - Test #43: "fails to claim additional token allocation if the launch doesn't have one"
  - Verify: `anchor test --skip-build` (with `.only`)

### Phase 7: `finalize_launch`

> Reference: `launchpad_v8_spec.md` → "7. finalize_launch — CHANGED"

- [ ] 7.1 Implement `finalize_launch` instruction (Rust)
  - Create `src/instructions/finalize_launch.rs` with `FinalizeLaunch` accounts struct, `validate()`, and `handle()`
  - Handler: compute tranches, CPI add_mint_authority (PP v2 PDA), CPI initialize_performance_package, CPI update_mint_governor_admin
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 7.2 Add `finalizeLaunchIx` to SDK2 client
  - Add the instruction builder method per spec
  - Verify: `cd sdk2 && npx tsc --noEmit`

- [ ] 7.3 Write `finalizeLaunch` tests (tests #34–36)
  - Test #34: happy path — PP v2 setup (tranches, oracle, recipient, authority), MintGovernor admin transferred to DAO
  - Test #35: "fails when launch state is not Complete"
  - Test #36: "can finalize only once"
  - Verify: `anchor test --skip-build` (with `.only`)

### Phase 8: `extend_launch`

> Reference: `launchpad_v8_spec.md` → instruction 11

- [ ] 8.1 Implement `extend_launch` instruction (Rust)
  - Create `src/instructions/extend_launch.rs` — port from v7
  - Wire into `lib.rs` and `instructions/mod.rs`
  - Verify: `./rebuild.sh`

- [ ] 8.2 Add `extendLaunchIx` to SDK2 client
  - Port from v7 SDK2 client
  - Verify: `cd sdk2 && npx tsc --noEmit`

- [ ] 8.3 Write `extendLaunch` tests (tests #44–46)
  - Test #44: "successfully extends a live launch"
  - Test #45: "funders can still fund after original deadline if extended"
  - Test #46: "close_launch respects new extended deadline"
  - Verify: `anchor test --skip-build` (with `.only`)

### Phase 9: Integration + Full Suite

> Reference: `launchpad_v8_spec.md` → "Integration Test"

- [ ] 9.1 Write integration test
  - Create `tests/integration/launchpad_v8_full_lifecycle.test.ts`
  - Full lifecycle: init → start → fund (multiple funders) → close → approve → settle → finalize → claim → refund → claim_additional
  - Verify: `anchor test --skip-build` (with `.only` on integration suite)

- [ ] 9.2 Run full test suite
  - Remove all `.only` markers
  - Run `anchor test` (full build + all tests)
  - All 46 unit tests + integration test must pass
