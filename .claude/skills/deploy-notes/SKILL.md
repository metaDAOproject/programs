---
name: deploy-notes
description: Generate granular deploy notes for a Solana program in this repo. Default (preview) mode shows what's coming on develop since the last successful mainnet deploy. Compare mode generates a release-style writeup between two past deploys, including buffer address, buffer hash, and Squads/simulation URLs scraped from the deploy workflow logs.
user-invocable: true
argument-hint: "<program> [--compare [<old-run-id> <new-run-id>]] [--md]"
---

# Deploy Notes

Generates a granular changelog for one Solana program in this repo, in the format the team uses for deploy announcements (see end of file for the template).

## Modes

- **Preview** (default): `<last-deploy-sha>..develop` — what's about to ship. No buffer/Squads section.
- **Compare** (`--compare`): between two past successful deploys (default: last two; or pass two run IDs). Includes buffer/hash/Squads/sim URLs scraped from the newer run's job log.

## Flags

- **`--md`**: also write the output to a markdown file at repo root. Filename: `<program-with-dashes>-update.md` for compare mode, `<program-with-dashes>-preview.md` for preview mode. Overwrites any existing file with that name. Still prints the notes to the chat.

## Procedure

### 1. Resolve `<program>` to job + cargo name + source dir

Read `.github/workflows/deploy-programs.yaml`. The valid `<program>` values are the choices listed under `inputs.program.options` (e.g. `launchpad_v8`, `futarchy_v6`, `mint_governor`). The job name is the same with underscores → hyphens.

From the matching job's `with:` block, grab the `program:` field — this is the cargo package name.

Find the source dir: `grep -lE '^name = "<cargo-name>"' programs/*/Cargo.toml`. `programs/launchpad` is a symlink to `programs/v08_launchpad`; prefer the real directory.

If `<program>` doesn't match any workflow input, list valid options and stop.

### 2. Find the deploy run(s)

```
gh run list --workflow=deploy-programs.yaml --status=success --limit=100 \
  --json databaseId,headSha,createdAt
```

**Always use `--limit=100`** — never shortcut to a lower limit "for a quick check." Most deploys are for popular programs (futarchy_v6, launchpad-v*), so the relevant run for a less-frequently-deployed program (mint_governor, performance_package_v2, etc.) can be 30+ runs back. A `--limit=5` peek will silently miss it and lead you to mis-classify the program as never-deployed or first-deploy.

Each deploy run only has one non-skipped job (others gated by `if:`). Walk newest → oldest, checking the active job name:

```
gh run view <id> --json jobs \
  --jq '.jobs[] | select(.conclusion=="success") | .name'
```

Preview: stop at the first run whose job is `<program-job> / build`. Compare: collect two such runs (or use the explicit IDs).

**First-deploy case (compare mode, only one successful run exists):** treat it as the first deploy. Use the single run's job log for the buffer/hash/squads section, and the commit range as "everything that touches the source dir up to the deploy commit." Add "(first deploy)" to the `<program>` update heading. The Notes section should briefly describe what the program does (read `programs/<dir>/src/lib.rs` for the entrypoints + doc comments) plus any notable changes since it was first scaffolded.

**Never-deployed case (no successful runs):** fall back to showing every PR merge on develop touching the source dir and note "never deployed via workflow."

### 3. Walk commits and write bullets

**Before bullet-writing, check whether the source dir actually changed between the two refs:**

```
git diff --stat <from-sha>..<to-sha> -- programs/<dir>/
```

If the output is empty, you're in the **no-source-diff case** (compare mode only — can happen when the workflow is re-run on the same source, producing a byte-identical `.so` and an identical buffer hash). Skip to the no-source-diff output template in step 5. Do **not** invent bullets or speculate about indirect changes — surface the fact that nothing in the program source changed and that the buffer hash matches the previous deploy.

Otherwise:

```
git log --first-parent <from-sha>..<to-sha> -- programs/<dir>/   # PR-merge list, for Related PRs
git log <from-sha>..<to-sha> -- programs/<dir>/                  # individual commits, for Notes bullets
```

For each non-trivial individual commit, draft one polished bullet. If the commit message is terse, read the diff for context:

```
git show --stat <sha> -- programs/<dir>/
git show <sha> -- programs/<dir>/
```

**Bullet style** (matches the team's existing deploy notes — granular, per-commit, polished):

- Lead with what changed in concrete terms: function/instruction/field/account name.
- Brief why in parentheses when not obvious from the what.
- Drop program-name prefixes from commit messages (`ppv2 - X` → `X`) — the heading says the program.
- Combine commits that are part of the same logical change.
- Skip pure plumbing (renames of private helpers, comment-only edits, Cargo.toml exact-pin from the repo-guard PR, lockfile bumps) unless it's the only commit in range.

Examples of the target style (from real deploys):

- Re-apply DAO's current `seconds_per_proposal` to proposal's `duration_in_seconds` at launch time (ensures updated durations take effect)
- Use `wrapping_mul` instead of `saturating_mul` for TWAP aggregator calculations and projections
- Remove `#[event_cpi]` from `ExecuteSpendingLimitChange` (no events emitted)
- `unstake_from_proposal` — add `init_if_needed` to staker's ATA

### 4. Compare mode only — scrape the newer run's log

```
gh run view --job=<job-id> --log
```

Extract:

| Field | Pattern |
|---|---|
| Buffer address | `^Program Buffer: <base58>$` (or first `^Buffer: <base58>$`) |
| Buffer hash | a 64-char hex line, immediately after the `Docker image Solana version: v...` line — this is `solana-verify get-executable-hash` output |
| Squads creation tx signature | `^Transaction Created - Signature: <base58>$` |
| Squads transaction index | `With transaction index: <N>n` (appears 1–2 lines after the signature) |

**Compute the Squads vault-transaction PDA via on-chain lookup.**

Read the user's RPC URL from `solana config get` (line `RPC URL: ...`). Use this URL — do NOT fall back to `api.mainnet-beta.solana.com`, it's rate-limited and will fail. If the configured URL is `api.mainnet-beta.solana.com`, ask the user to point solana at their preferred RPC first.

Then:
```
curl -s -X POST <rpc-url> -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getTransaction","params":["<sig>",{"encoding":"jsonParsed","maxSupportedTransactionVersion":0,"commitment":"confirmed"}]}'
```

In the response, find the new `MultisigTransaction` account in the tx's account keys (writable, non-signer, owned by Squads v4 program `SQUADS_PROGRAM_ID`). The SDK exports `SQUADS_PROGRAM_ID` from `@metadaoproject/programs`.

### 5. Output

**Preview mode**:

```
`<program>` preview (since last deploy):

Last deploy: <gh-run-url> (commit `<short-sha>`, <date>)
Develop HEAD: commit `<short-sha>`
Commits in range: <N>

Notes:

- bullet
- bullet
...

Related PRs:
- #NNN <title>
- #MMM <title>
```

**Compare mode** (matches the team's template exactly):

````
`<program>` update:

Buffer: `<buffer-addr>`
Buffer Hash: `<hash>`
Squads Transaction: https://app.squads.so/squads/6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf/transactions/<vault-tx-pda>
Instruction Simulation: https://explorer.solana.com/tx/inspector?squadsTx=<vault-tx-pda>
GH Build: https://github.com/metaDAOproject/programs/actions/runs/<run-id>/job/<job-id>
GH Related:
- https://github.com/metaDAOproject/programs/pull/NNN
- https://github.com/metaDAOproject/programs/pull/MMM

Notes:

- bullet
- bullet
...
````

**Compare mode, no-source-diff case** (re-deploy of byte-identical `.so`):

Confirm the buffer hash is genuinely unchanged: `solana-verify get-program-hash <program-id> -u <rpc-url>` should match the buffer hash from the new run's log.

````
`<program>` update (re-deploy, no source changes):

Buffer: `<new-buffer-addr>`
Buffer Hash: `<hash>`
Squads Transaction: https://app.squads.so/squads/6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf/transactions/<vault-tx-pda>
Instruction Simulation: https://explorer.solana.com/tx/inspector?squadsTx=<vault-tx-pda>
GH Build: https://github.com/metaDAOproject/programs/actions/runs/<new-run-id>/job/<new-job-id>
GH Related:
- _(none — no commits touch `programs/<dir>/` between the two deploys)_

Previous deploy for reference: <prev-gh-run-job-url> (commit `<prev-sha>`, <prev-date>)
This deploy: commit `<new-sha>`, <new-date>

Notes:

This is a re-deploy of `<program>` (program ID `<program-id>`) with **no on-chain behaviour change**:

- `git diff <prev-sha> <new-sha> -- programs/<dir>/` is empty
- The buffer hash (`<hash-prefix>…`) is byte-for-byte identical to the previously deployed program (verified via `solana-verify get-program-hash`)
- Approving the Squads transaction will set the program buffer to bytes equal to what's already on-chain — effectively a no-op upgrade

If this was an intentional re-deploy (e.g. a smoke test of the deploy pipeline, or a buffer refresh), no other action is needed once the Squads tx is approved. If it was unintentional, the Squads tx can be cancelled without loss.
````

## Constants

- Mainnet Squads vault: `6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf`
- Repo: `metaDAOproject/programs`
- Workflow: `.github/workflows/deploy-programs.yaml`
- Deploy convention: always from `develop`
