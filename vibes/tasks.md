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

### Phase 5: `settle_launch`

> Reference: `launchpad_v8_spec.md` → "6. settle_launch — CHANGED"

### Phase 6: `claim` + `refund` + `claim_additional_token_allocation`

> Reference: `launchpad_v8_spec.md` → instructions 8, 9, 10

### Phase 7: `finalize_launch`

> Reference: `launchpad_v8_spec.md` → "7. finalize_launch — CHANGED"

### Phase 8: `extend_launch`

> Reference: `launchpad_v8_spec.md` → instruction 11

- [NEXT] 8.3 Write `extendLaunch` tests (tests #44–46)
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
