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

### Phase 0: Scaffold

> Reference: `relaunch-implementation-plan.md` → "Stage 0 — scaffold"

- [NEXT] 0.2 State + constants
  - `state/`: `Relaunch`, `DepositRecord`, `RelaunchState` enum — field list per plan Stage 0 (no `usdc_swap_pool` field)
  - `constants.rs`: `TOKEN_SCALE`, `TOKENS_TO_DEPOSITORS = 10M`, `TOKENS_TO_FUTARCHY_LIQUIDITY = 2M`, `MAX_SECONDS_FOR_DEPOSITS = 14d`, `PRICE_SCALE = 1e12`, `USDC_SWAP_POOL`, WSOL mint, pump_amm / pump_fees / whirlpool program IDs, pump `"pool-authority"` seed

- [ ] 0.3 SDK module scaffold
  - `sdk/src/relaunch/v0.1/`: `RelaunchClient.createClient({ provider })`, `pda.ts` (`getRelaunchAddr`, `getRelaunchSignerAddr`, `getDepositRecordAddr`), generated types, `index.ts` re-export
  - Package export wiring in `sdk/package.json`

- [ ] 0.4 Test utilities
  - `tests/relaunch/unit/` folder + placeholder test that runs
  - `setupRelaunch()` helper skeleton (old mint under either token program)

- [ ] 0.5 External fixtures + pool helpers
  - Dump `pump_amm.so`, `pump_fees.so`, `whirlpool.so` from mainnet into `tests/fixtures/`; Anchor.toml entries
  - `writePumpPool()`: fabricate pump_amm `Pool` + funded pool vaults (+ global/fee config accounts, dumped or fabricated) via bankrun `setAccount` — canonical-shaped WSOL- and USDC-quoted variants, one Token-2022-base, plus non-canonical variants for negative tests. Fabrication is deliberate even with the real program present — see plan Stage 0 note
  - Whirlpool helpers via real instructions: config + fee tier + WSOL/USDC pool + seeded tick arrays (crib `whirlpools-cpi-examples` test setup)
  - Test-feature override for the `USDC_SWAP_POOL` constant (fixture pool won't sit at the mainnet address)
  - Verify: smoke test — pump_amm buy/sell against a fabricated pool and a Whirlpool swap both execute in bankrun

### Phase 1: initialize_relaunch + start_deposits

> Reference: `relaunch-implementation-plan.md` → "Stage 1 — initialize_relaunch + start_deposits"

- [ ] 1.1 `initialize_relaunch` (instruction + SDK + tests)
  - Accounts/validations per plan §1: `mint_authority` Signer proof-of-control, new-mint checks, source-pool canonicality, quote mint ∈ {WSOL, USDC}, old-mint extension allowlist, threshold/window/spending-limit validations; USDC-quoted sources share one ATA for `source_quote_vault`/`usdc_vault`
  - Handler order: `set_authority` → metadata CPI → `mint_to` 12M → snapshot old supply → `set_inner` → event
  - SDK: `initializeRelaunch()` with create-mint-to-self pre-instructions
  - Tests: full list in plan §1 (happy path, decoupled mint creation, authority footguns, extension allowlist, canonicality failures, arg bounds, PDA squat + rival relaunch)

- [ ] 1.2 `start_deposits` (instruction + SDK + tests)
  - `has_one = admin` signer gate, `Initialized → Live`, stamp `unix_timestamp_started`, event
  - Tests: happy path, non-admin fails, double-start fails (compute-budget trick for unique sigs)

### Phase 2: deposit + failure loop

> Reference: `relaunch-implementation-plan.md` → "Stage 2 — deposit, close_deposits, mark_failed, claim_refund"

- [ ] 2.1 Token-2022 test availability check
  - Confirm bankrun ships Token-2022 as a builtin; if not, add the fixture + Anchor.toml entry
  - Extend `setupRelaunch()` to produce Token-2022 old mints (with allowed metadata extensions)

- [ ] 2.2 `deposit` (instruction + SDK + tests)
  - `Live` + window gate, `transfer_checked` under old mint's owner program, `init_if_needed` DepositRecord, accumulate record + total, event
  - Tests per plan §3: both token programs, accumulation, multiple depositors, zero amount, window/state gates

- [ ] 2.3 `close_deposits` (instruction + SDK + tests)
  - Window elapsed; u128 threshold math → `SellPending` | `Failed`; stamp `unix_timestamp_closed`, event
  - Tests per plan §5: exact-threshold boundary, one-short → Failed, early close fails, 10^15-supply overflow case, permissionless crank

- [ ] 2.4 `mark_failed` (instruction + SDK + tests)
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
