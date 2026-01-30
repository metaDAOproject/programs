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

All tasks completed! 🎉
