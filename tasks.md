# Relaunch Raydium Venue Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section in `vibes/relaunch-raydium-implementation-plan.md` for full context (design rationale lives in `vibes/relaunch-raydium-venue.html`)
3. Do ONLY that task - nothing else
4. After completing the task, verify: `./rebuild.sh` after any program/SDK change, then `anchor test --skip-build` (use `.only` on the new test file while iterating, remove it and run the full suite before finishing)
5. If successful, remove the completed task from this file
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify

**Reference:** Full implementation plan is in `vibes/relaunch-raydium-implementation-plan.md`

---

## Tasks

### Phase 4: Lifecycle, ALT, budgets

> Reference: `relaunch-raydium-implementation-plan.md` → "Stage 4 — lifecycle, ALT, budgets"

- [NEXT] 4.3 Compute budgets for the new builders
  - Measure worst-case CU from bankrun logs (surfpool figures as cross-check); worst +20% or drop to the 200k default
  - Confirm pump-variant budgets untouched by the shared-tail refactor
