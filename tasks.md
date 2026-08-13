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

### Phase 3: deposit_via_buy_raydium

> Reference: `relaunch-raydium-implementation-plan.md` → "Stage 3 — deposit_via_buy_raydium"

- [NEXT] 3.1 `deposit_via_buy_raydium` (instruction + SDK + tests)
  - Transfer `max_quote_in` → CPI `swap_base_out_v2(max_quote_in, base_out)` → refund unspent → `DepositRecord::credit` measured delta
  - No volume accumulators, no fee recipients; same `TokensDepositedViaBuyEvent`
  - SDK: `depositViaBuyRaydiumIx` + `depositViaBuy()` venue dispatch (wrap logic unchanged)
  - Tests in new `tests/relaunch/unit/depositViaBuyRaydium.test.ts` per plan Stage 3, incl. exact-refund assertion and wrong-venue gating both directions

### Phase 4: Lifecycle, ALT, budgets

> Reference: `relaunch-raydium-implementation-plan.md` → "Stage 4 — lifecycle, ALT, budgets"

- [ ] 4.1 Full-lifecycle integration tests
  - `tests/integration/relaunch.test.ts`: Raydium-source happy path with money-math identities at each hop; threshold-miss failure path with refunds
  - Matrix note: WSOL × classic-SPL only — other combinations impossible for this venue

- [ ] 4.2 ALT statics
  - AMM v4 program + `5Q544…` authority into `scripts/relaunch/createAlt.ts` groups; re-dump the fork fixture
  - `altTransactions.test.ts`: Raydium buy as a single legacy tx and as v0 against the extended table
  - Must land before the mainnet ALT freeze (follow-ups item 3)

- [ ] 4.3 Compute budgets for the new builders
  - Measure worst-case CU from bankrun logs (surfpool figures as cross-check); worst +20% or drop to the 200k default
  - Confirm pump-variant budgets untouched by the shared-tail refactor
