# Gated Token Implementation Tasks

## Instructions for Claude

**READ THIS FIRST:**

1. Look at this file and find the task marked with `[NEXT]`
2. Read the referenced section(s) in `vibes/gated-token-tech-spec.md` for full context — it contains the exact code shapes, account constraints, error variants, event shapes, and test cases
3. Do ONLY that task — nothing else
4. Run the verification command(s) listed for the task and confirm clean output
5. If successful, remove the completed task from this file
6. Mark the next task with `[NEXT]`
7. Stop and wait for the user

**DO NOT:**
- Do multiple tasks at once
- Skip ahead
- Forget to verify
- Modify files outside the task's stated scope
- Leave `.only` markers in tests when declaring a task done

**Internal workflow for per-instruction tasks (Phases 3–7):**

Each per-instruction task touches the program, the SDK, and tests. Work through them in this order to keep feedback loops tight:

1. Write the program instruction (Rust under `programs/gated_token/`)
2. Run `./rebuild.sh` — confirms the program builds and regenerates the SDK IDL types
3. Make the SDK changes (the `xxxIx` builder method on `GatedTokenClient`)
4. Run `./rebuild.sh` — confirms the SDK typechecks against the new IDL
5. Write the tests (test utils helpers, then unit tests; isolate with `.only` while iterating)
6. Run `anchor test --skip-build` — adjust tests / code until green; remove all `.only` before declaring the task done

**General rules from `CLAUDE.md`:**
- Run `./rebuild.sh` after editing any Rust under `programs/` (rebuilds the program **and** regenerates SDK types)
- Use `anchor test --skip-build` for the test verification step (faster — skips the rebuild we already did)
- No assertion messages in tests; use round-number token amounts (e.g. `100_000_000` for 100 tokens at 6 decimals)
- Append new error variants to the **end** of `#[error_code]` enums — never insert in the middle
- Prefer `has_one` / `address` over generic `constraint`; prefer `associated_token::*` over `token::*` for canonical recipient ATAs
- Use `emit_cpi!` (not `emit!`) and `#[event_cpi]` on accounts structs
- Use specific `require_*!` macros (`require_keys_eq!`, `require_eq!`, `require_gte!`, etc.) over generic `require!`

**Reference:** Full implementation plan is in `vibes/gated-token-tech-spec.md`. Companion specs: `vibes/gated-token-spec.md` (rationale, threat model) and `vibes/launchpad-v8-gating-integration-plan.md` (cross-program integration).

---

## Tasks

### Phase 4: `add_whitelisted_user` (program + SDK + tests)

> Reference: `gated-token-tech-spec.md` → §7.2, §9.3.

- [NEXT] 4. Implement `add_whitelisted_user` end-to-end
  - **Program (§7.2):** `src/instructions/add_whitelisted_user.rs`. `init` on `whitelisted_user`, `has_one = mint` on the config, `gating_disabled` constraint, increment `seq_num`, emit event. Wire into `instructions/mod.rs` and `lib.rs`.
  - **SDK (§8.2):** `addWhitelistedUserIx({ mint, admin, user, payer? })`.
  - **Tests (§9.3):**
    - Add `whitelistUser(gatedTokenClient, mint, admin, user, payer)` helper to `utils.ts`.
    - `tests/gatedToken/unit/addWhitelistedUser.test.ts` — 5 cases (1 ✅ success exercising `payer ≠ admin`, 3 ❌ negatives: non-admin, re-add, post-disable, 1 ✅ cross-mint isolation).
    - Wire into `main.test.ts`.
  - **Verification:** `./rebuild.sh && anchor test --skip-build` green; no `.only` left.

### Phase 5: `disable_gating` (program + SDK + tests)

> Reference: `gated-token-tech-spec.md` → §7.4, §9.3.

- [ ] 5. Implement `disable_gating` end-to-end
  - **Program (§7.4):** `src/instructions/disable_gating.rs`. Sets `gating_disabled = true`, increments `seq_num`, emits `GatingDisabledEvent`. Wire into `instructions/mod.rs` and `lib.rs`.
  - **SDK (§8.2):** `disableGatingIx({ mint, admin })`.
  - **Tests (§9.3):** `tests/gatedToken/unit/disableGating.test.ts` — 3 cases (1 ✅ asserts `gating_disabled == true`, 2 ❌ non-admin, double-disable). Wire into `main.test.ts`.
  - **Verification:** `./rebuild.sh && anchor test --skip-build` green; no `.only` left.

### Phase 6: `thaw_account` (program + SDK + tests)

> Reference: `gated-token-tech-spec.md` → §7.5, §9.3.

- [ ] 6. Implement `thaw_account` end-to-end
  - **Program (§7.5):** `src/instructions/thaw_account.rs`. PDA-signed `thaw_account` CPI; constraint `gating_disabled == true`. Wire into `instructions/mod.rs` and `lib.rs`.
  - **SDK (§8.2):** `thawAccountIx({ mint, tokenAccount })`.
  - **Tests (§9.3):** `tests/gatedToken/unit/thawAccount.test.ts` — 4 cases (❌ before disable, ✅ after disable + permissionless caller, ✅ already-thawed → SPL error, ❌ wrong mint). Wire into `main.test.ts`.
  - **Verification:** `./rebuild.sh && anchor test --skip-build` green; no `.only` left.

### Phase 7: `gated_invoke` (program + SDK + tests) — heavy lift

> Reference: `gated-token-tech-spec.md` → §7.3, §9.3 (multiple sub-sections).

- [ ] 7. Implement `gated_invoke` end-to-end
  - **Program (§7.3):** `src/instructions/gated_invoke.rs` containing:
    - Private helpers: `is_gated_token_account`, `read_token_state`, `cpi_thaw`, `cpi_freeze` (per §7.3 helper block).
    - `GatedInvokeArgs { instruction_data: Vec<u8> }`.
    - `GatedInvoke` accounts struct. **Critical:** `gated_mint_config` must have `mut` (we increment `seq_num`). `whitelisted_user` is `Account<'info, WhitelistedUser>` (existence check via Anchor deserialize). `target_program` and `token_program` are `UncheckedAccount`s; `token_program` has `address = spl_token::ID`.
    - `validate()` — checks `WHITELISTED_PROGRAMS.contains` and `target != crate::ID`.
    - `handle()` — pre-CPI thaw pass → inner `invoke` (NOT `invoke_signed`, no program-as-signer) → post-CPI freeze pass → `seq_num` bump + event.
    - Wire into `instructions/mod.rs` and `lib.rs` with the `'c: 'info` lifetime signature.
  - **SDK (§8.2):** `gatedInvokeIx({ caller, mint, targetProgram, instructionData, remainingAccounts })`. Builder must call `.remainingAccounts(remainingAccounts)` on the methods chain.
  - **Tests (§9.3) — all in `tests/gatedToken/unit/gatedInvoke.test.ts`:**
    - Setup: gated mint, `mint_governor` for the same mint with an authorized minter, whitelisted caller. Build a small helper that wraps a pre-formed `TransactionInstruction` into a `gated_invoke` call (deserialize ix data + accounts → `gatedInvokeIx` args).
    - **Happy path (5 cases):** whitelisted caller hits whitelisted target (assert event counts); pre-existing frozen ATA stays frozen post-CPI; newly-created ATA ends frozen post-CPI; aliased duplicates handled; non-gated-mint accounts untouched.
    - **Failure modes (7 cases):** non-whitelisted target program, non-whitelisted caller, caller whitelisted for wrong mint, `target == gated_token::ID`, `gating_disabled == true`, inner-CPI failure rolls back thaws, caller not signer.
    - **Privilege-escalation guards (2 cases):** caller A passing caller B as signer in `remaining_accounts` (B didn't sign outer tx) must fail; gated_token program treated as signer in inner ix must fail.
    - Wire into `main.test.ts`.
  - **Verification:** `./rebuild.sh && anchor test --skip-build` green; **all** `.only` markers across the project removed; full suite passes.

### Phase 8: Cross-program integration tests

> Reference: `gated-token-tech-spec.md` → §9.5; `vibes/launchpad-v8-gating-integration-plan.md`.

- [ ] 8.1 Integration test: `gated_token` ↔ `mint_governor`
  - Cross-program happy path: gated mint with `mint_governor` set up, `gated_invoke(mint_governor::mint_tokens)`, verify destination ATA frozen post-CPI, verify mint_governor's internal accounting (`total_minted`) updated.
  - File: `tests/integration/gatedTokenMintGovernor.test.ts` (or extend an existing integration suite if natural).
  - **Verification:** `anchor test --skip-build` green; no `.only` left.

- [ ] 8.2 Integration test: gated launchpad v8 lifecycle
  - Reference: `launchpad-v8-gating-integration-plan.md` lifecycle table.
  - End-to-end: create base mint with freeze authority preset to expected PDA → `initialize_gated_mint` → `add_whitelisted_user` × N → `gated_invoke(launchpad_v8::initialize_launch)` and verify `launch_base_vault` frozen → `start_launch` (direct) → `fund` (direct) → `gated_invoke(settle_launch)` and verify futarchy AMM base vault + DAMM v2 `token_a_vault` frozen → `gated_invoke(claim)` for a whitelisted funder → `disable_gating` → `thaw_account` from a fresh keypair.
  - File: `tests/integration/gatedLaunchpadV8.test.ts`.
  - **Verification:** `anchor test --skip-build` green; no `.only` left.

### Phase 9: Closeout

> Reference: `gated-token-tech-spec.md` → §10; `gated-token-spec.md` §13.

- [ ] 9.1 Threat-model walkthrough
  - For each item in `gated-token-spec.md` §13 (reentrancy, privilege escalation, account aliasing, mint mismatch / spoofing, program upgrade authority, per-mint admin compromise, mint_governor authorized minter discipline), confirm it's either covered in code or by a documented compensating control.
  - Output: short comment block at the top of `lib.rs` or a `programs/gated_token/SECURITY.md`.

- [ ] 9.2 Final sweep
  - Grep for any remaining `.only` in `tests/` — must be empty.
  - Run `./rebuild.sh && anchor test --skip-build` end-to-end. Must be green.
  - Visual diff review of all files added/modified across the branch.
  - At this point this file should have only this final task left; remove this task and the file can be deleted.
