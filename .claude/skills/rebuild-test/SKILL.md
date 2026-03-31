---
name: rebuild-test
description: Enforces rebuild and test workflow after code changes. Triggers when Claude edits Rust files under programs/, TypeScript files under sdk/, or test files under tests/. Reminds Claude to run ./rebuild.sh and anchor test --skip-build.
user-invocable: true
argument-hint: "[test-filter]"
---

# Rebuild & Test Enforcement

## When manually invoked (`/enforce-rebuild-test`)
Immediately run:
1. `./rebuild.sh`
2. `anchor test --skip-build`

If an argument is provided (e.g., `/enforce-rebuild-test completeLaunch`), use it to run only matching tests.

## When auto-triggered after code changes
After making code changes, you MUST follow this workflow before considering the task complete:

## When Rust code under `programs/` is edited:
1. Run `./rebuild.sh` — this rebuilds all programs, regenerates the SDK types, and lints.
2. Run the relevant tests with `anchor test --skip-build`.

## When TypeScript code under `sdk/` is edited:
1. Run `./rebuild.sh` to rebuild the SDK and lint.
2. Run the relevant tests with `anchor test --skip-build`.

## When test files under `tests/` are edited:
1. If you also edited program or SDK code, run `./rebuild.sh` first.
2. Run the relevant tests with `anchor test --skip-build`.

## Rules
- NEVER skip `./rebuild.sh` after editing Rust or SDK code. Tests will run against stale artifacts otherwise.
- NEVER consider a task complete without running tests, unless the user explicitly says to skip them.
- If a rebuild or test fails, fix the issue and re-run. Do not leave the user with broken code.
- When running tests during development, add `.only` to the specific `describe`/`it` block you're working on for faster feedback. Remove `.only` before finishing.
