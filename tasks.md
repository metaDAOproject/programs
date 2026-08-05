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

### Phase 2: deposit + failure loop

> Reference: `relaunch-implementation-plan.md` → "Stage 2 — deposit, close_deposits, mark_failed, claim_refund"

- [NEXT] 2.4 `mark_failed` (instruction + SDK + tests)
  - `SellPending → Failed` once `now > closed + grace_period_seconds`, event
  - Tests per plan §11: before/after grace, wrong states, permissionless

- [ ] 2.5 `claim_refund` (instruction + SDK + tests)
  - `Failed`, returns exact `amount_deposited`, sets `claimed`, event
  - Tests per plan §10: both token programs, double-refund, wrong state, vault-empty conservation, both end-to-end failure paths

### Phase 3: PumpSwap + Whirlpool legs

> Reference: `relaunch-implementation-plan.md` → "Stage 3 — execute_sell, execute_usdc_swap, deposit_via_buy"

- [ ] 3.1 `execute_sell` (instruction + SDK + tests)
  - Hand-built `cpi/pump_amm.rs` sell builder (discriminator + borsh args + verified 21-account list from design §06)
  - Admin + `SellPending` + grace gate; sell full vault; `quote_recovered` from measured delta; WSOL → `Sold`, USDC → `Swapped`
  - Tests per plan §6: both quote variants, slippage failure leaves state unchanged, non-admin/wrong-state/after-grace, Token-2022 base pool

- [ ] 3.2 `execute_usdc_swap` (instruction + SDK + tests)
  - Whirlpool `swap_v2` CPI (`orca_whirlpools_client` if clean under 0.29, else hand-built; verified 15-account list incl. `memo_program`); pool pinned `address = USDC_SWAP_POOL`
  - Admin + `Sold`; full WSOL balance a→b; set `usdc_recovered`
  - SDK: tick-array derivation helper + `min_usdc_out`
  - Tests per plan §7: happy path, wrong pool address, slippage failure, non-admin/wrong-state

- [ ] 3.3 `deposit_via_buy` (instruction + SDK + tests)
  - `cpi/pump_amm.rs` buy builder (23 accounts = sell + volume accumulators); pull quote → buy → refund unspent → credit measured old-vault delta
  - Tests per plan §4: both quote variants, mixes with direct deposits, tight `max_quote_in` fails cleanly, window/state gates, credited tokens refund on later failure
  - SDK: `depositViaBuy()` + SOL→WSOL wrap pre-instructions

### Phase 4: complete_relaunch

> Reference: `relaunch-implementation-plan.md` → "Stage 4 — complete_relaunch"

- [ ] 4.1 `complete_relaunch` (instruction + SDK + tests)
  - u128 `price_1e12`; CPI `futarchy::initialize_dao` (launchpad-parity params incl. 1.5M min stake) + `provide_liquidity` (2M base, `usdc_recovered / 5` quote, Squads-vault position); transfer remaining USDC + mint & metadata authorities to Squads vault; store `dao`/`dao_vault`; `Complete`
  - Squads accounts pre-created/PDA-derived exactly as launchpad (reentrancy-safe shape)
  - Tests per plan §8: param assertions, AMM-ratio == twap identity, treasury remainder, authority handoffs, permissionless crank, rounding conservation

### Phase 5: claim + full lifecycle

> Reference: `relaunch-implementation-plan.md` → "Stage 5 — claim + full lifecycle"

- [ ] 5.1 `claim` (instruction + SDK + tests)
  - `Complete`, u128 floor pro-rata, transfer to depositor ATA (`associated_token` constraints), set `claimed`; dust stays in vault (no closes in v1)
  - Tests per plan §9: pro-rata correctness, dust bound, double-claim, wrong state, buy-depositor parity

- [ ] 5.2 Full-lifecycle integration tests
  - `tests/integration/relaunch.test.ts`: happy path with money-math identities at each hop; failure path A (threshold miss → refunds); failure path B (grace lapse → `mark_failed` → refunds)
  - Matrix: WSOL × USDC source, classic-SPL × Token-2022 old mint (happy path minimum per combination)
  - Finish: full `anchor test --skip-build` suite green, no `.only` anywhere

### Phase 6: Release prep

> Reference: `relaunch-implementation-plan.md` → "After the code"

- [ ] 6.1 Final program ID
  - Grind vanity keypair, set `declare_id!` + Anchor.toml, `./rebuild.sh`, full suite green

- [ ] 6.2 README deployments-table entry + verifiable build
  - Note: first mainnet deploy itself is manual (Squads flow is upgrade-only) — user-led, not a task here
