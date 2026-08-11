# Relaunch Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section in `vibes/relaunch-implementation-plan.md` for full context (design rationale lives in `vibes/relaunch-program-design.html`)
3. Do ONLY that task - nothing else
4. After completing the task, verify: `./rebuild.sh` after any program/SDK change, then `anchor test --skip-build` (use `.only` on the new test file while iterating, remove it and run the full suite before finishing)
5. If successful, remove the completed task from this file
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify

**Reference:** Full implementation plan is in `vibes/relaunch-implementation-plan.md`

---

## Tasks

### Phase 6: Release prep

> Reference: `relaunch-implementation-plan.md` → "After the code"

- [NEXT] 6.2 README deployments-table entry + verifiable build
  - Note: first mainnet deploy itself is manual (Squads flow is upgrade-only) — user-led, not a task here
