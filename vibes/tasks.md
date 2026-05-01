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

### Phase 8: Cross-program integration tests

> Reference: `gated-token-tech-spec.md` → §9.5; `vibes/launchpad-v8-gating-integration-plan.md`.

- [NEXT] 8.1 Integration test: `gated_token` ↔ `mint_governor`
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
