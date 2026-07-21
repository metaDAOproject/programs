# Mini-Instructions Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section in `vibes/mini-instructions-implementation-plan.html` for full context (section anchors like `#s1` are noted per phase; the design doc and implementation guide are linked from there when you need rationale)
3. Do ONLY that task - nothing else
4. After completing the task, verify with the task's verification command (default: `./rebuild.sh`, then `anchor test --skip-build`; use `.only` while iterating and remove it before the final run)
5. If successful, remove the completed task from this file
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**Task shape:** every task is a vertical slice — the program change, its SDK elements, and its tests land together in that one task, never split across tasks. A test case that needs something from a later task is named as a hand-off and lands there. If you add tasks to this file, keep that shape.

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify

**Reference:** Full implementation plan is in `vibes/mini-instructions-implementation-plan.html`

**Document map** (all in `vibes/`, cross-linked by anchor — open them directly, don't guess):
- `mini-instructions-implementation-plan.html` — what this queue references: per-stage deliverables, instruction step tables, test what/why tables
- `mini-instructions-implementation.html` — the implementation guide: exact file paths, line numbers, account tables, and implementation decisions I1–I11; the plan defers to it for those details
- `mini-instructions-design.html` — the design doc: the resulting design plus decision log #1–#42; every `#NN` citation resolves here
- `mini-instructions-execution-flows.html` — post-pass execution stacks per kind (who signs what, CPI shapes, follow-up transactions); useful when writing execute/sync/integration tests
- `mini-instructions-overview.html`, `mini-instructions-presentation.html` — condensed summaries; not needed for building

---

## Tasks

### Phase 5: Typed creates

> Reference: `mini-instructions-implementation-plan.html` → "Stage 5 — Typed creates" (`#s5`); the shared skeleton section plus one "Per-create specialization" subsection per instruction

- [NEXT] 5.4 `initialize_spending_limit_change_proposal(config)` + SDK + tests
  - Reference: subsection "initialize_spending_limit_change_proposal"
  - Program: template: one vault-signed `set_spending_limit(config)`; check members ≤ 10 on `Some`; no extra accounts
  - SDK: ix builder + orchestrator
  - Tests (`initializeSpendingLimitChangeProposal.test.ts`): payload exactness (`Some` and `None`), member-cap refusal, snapshot (5 days, +5%, blockable), execute + sync end state matches the declaration
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 5.5 `initialize_hostile_takeover_proposal(new_team_address, spending_limit_action)` + SDK + tests
  - Reference: subsection "initialize_hostile_takeover_proposal"
  - Program: template: `update_dao` (team only) + `set_spending_limit` unless `Keep`; check members ≤ 10 on `Set`
  - SDK: ix builder + orchestrator
  - Tests (`initializeHostileTakeoverProposal.test.ts`): `Keep` → one inner ix, `Remove`/`Set` → two; member-cap refusal; snapshot (20 days, +10%, unblockable)
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 5.6 `initialize_hostile_liquidate_proposal(liquidator)` + SDK + tests
  - Reference: subsection "initialize_hostile_liquidate_proposal"
  - Program: template: one `apply_liquidation` call with accounts baked by derivation (next transaction index → Squads proposal PDA → own futarchy proposal PDA); liquidator stored in `action`
  - SDK: ix builder + orchestrator
  - Tests (`initializeHostileLiquidateProposal.test.ts`): baked account set is exactly the derived set, including the proposal's own not-yet-created PDA (`apply_liquidation` itself is Phase 6 — assert payload shape only)
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 5.7 Stage-3 hand-off test cases (now exercisable with typed creates)
  - Reference: "Stage 5 → Tests" table, last three rows
  - `launchProposal.test.ts`: unsponsored `large_spend`/`spending_limit_change` refused, sponsored launches; cooldown active refused / elapsed launches
  - `finalizeProposal.test.ts`: uncontested `large_spend` passes at −10%; failed hostile stamps its own timestamp and only its own
  - `adminCancelProposal.test.ts`: cancelling a live hostile refused
  - Verify: `anchor test --skip-build`

### Phase 6: Liquidation

> Reference: `mini-instructions-implementation-plan.html` → "Stage 6 — Liquidation" (`#s6`)

- [ ] 6.1 `apply_liquidation` + SDK packing helper + tests
  - Reference: subsection "Instruction: `apply_liquidation`" and the `executeVaultTransactionAndSync` deliverable row
  - Program: checks: linked proposal (`dao` match, `Passed`, `action` matches `HostileLiquidate` → `InvalidProposalKind` — the destructure that reads the liquidator is the check), Spot gate (`PoolNotInSpotState`, revert-whole-and-retry), not already liquidated (`AlreadyLiquidated`); effects: install liquidator from `action`, zero the record + dirty, sweep vault-owned AMM position pro-rata (missing/empty → skip); `amm_position` as UncheckedAccount parsed manually
  - SDK: `executeVaultTransactionAndSync` — one transaction: [optional `finalize_proposal` prepend for liquidations] + Squads `vault_transaction_execute` + `sync_spending_limit`
  - Tests (`applyLiquidation.test.ts`): happy path; kind check (arbitrary carrying `apply_liquidation` refused); replay refused; missing/empty position tolerated; mid-market revert + successful retry after that market finalizes
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 6.2 Liquidator path (+ tests)
  - Reference: deliverables table row "admin_enqueue_multisig_proposal_approval override"
  - Program: `admin_enqueue_multisig_proposal_approval` — liquidator replaces the admin id as required signer when `dao.liquidator` is `Some`, admin gate unchanged when `None`; NO override for `admin_execute_multisig_proposal`; middle leg and ordinary Squads execution untouched
  - Tests: post-liquidation, the liquidator (not the admin) enqueues; the DAO PDA approves permissionlessly; ordinary Squads execution runs the estate payload
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 6.3 Liquidated guards rollout (+ tests, including all handed-off cases)
  - Reference: deliverables table row "Liquidated guards"
  - Program: add `DaoLiquidated` guard to the blocked list (all six creates, `stake_to_proposal`, `launch_proposal`, `spot_swap`, `conditional_swap`, `provide_liquidity`, `update_dao`, `set_spending_limit`); leave the allowed list unguarded (`withdraw_liquidity`, `unstake_from_proposal`, `finalize_proposal`, `sync_spending_limit`, fee collection, liquidator path)
  - Tests (`liquidatedGuards.test.ts`): every blocked instruction refuses on a liquidated DAO, every allowed one still works — this absorbs the liquidated hand-offs from Phases 3–5 (creates, launch, `set_spending_limit`) and the liquidated sync → removed-only case from 4.2
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

### Phase 7: Migration

> Reference: `mini-instructions-implementation-plan.html` → "Stage 7 — Migration" (`#s7`)

- [ ] 7.1 `resize_dao` rewrite + tests
  - Old layout = post-#469 `Dao`; defaults: `liquidator = None`, timestamps 0, `dirty = false`; also clear `optimistic_proposal`; +50 bytes; idempotent
  - Tests (`resizeDao.test.ts`): old → new layout with correct defaults; idempotent second call
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 7.2 `resize_proposal` rewrite + tests
  - Takes the proposal's `dao`; defaults: `action = ExecuteArbitrary`, `council_can_block = true`, threshold from the vestigial per-DAO fields (team-sponsored branch when applicable — the single read); ~369 bytes; idempotent
  - Tests (`resizeProposal.test.ts`): defaults, idempotency, both threshold branches
  - Verify: `./rebuild.sh`, then `anchor test --skip-build`

- [ ] 7.3 Dump + migrate scripts
  - `dumpDaos.ts` / `migrateDaos.ts` pattern for both account types, batched, wired into `Anchor.toml`
  - Verify: typecheck only — scripts are exercised against surfpool by the user, not executed here

### Phase 8: Integration & ship

> Reference: `mini-instructions-implementation-plan.html` → "Stage 8 — Integration & ship" (`#s8`). Integration flows are the deliverable — end-to-end by design, one task per flow.

- [ ] 8.1 Integration: takeover end to end
  - Create with `Set` → stake → launch → 20 days → finalize → packed execute + sync → team rotated, record + Squads limit match declaration, old members can't pull
  - Verify: `anchor test --skip-build`

- [ ] 8.2 Integration: liquidation end to end
  - Create → launch → 10 days → finalize + execute + sync in ONE transaction → liquidated state asserts → liquidator estate cycle (enqueue → permissionless approve → ordinary Squads execute) → third-party LP exits via `withdraw_liquidity`
  - Verify: `anchor test --skip-build`

- [ ] 8.3 Integration: large spend end to end
  - Sponsor → launch → 1.5 days → uncontested pass at −10% → execute pays the team's quote ATA
  - Verify: `anchor test --skip-build`

- [ ] 8.4 Integration: cooldown round-trip
  - Hostile fails → immediate relaunch refused → advance past cooldown → next attempt launches
  - Verify: `anchor test --skip-build`

- [ ] 8.5 Full-suite gate
  - Remove any stray `.only`; run the complete suite
  - Deploy, mainnet migration cranks, and SDK publish are user-run (plan's ship checklist) — do not perform them
  - Verify: `anchor test` fully green
