# Greptile Review Rules — metaDAOproject/programs

> Drafted from the conventions enumerated in #504. Maintainers should tune freely.

## Build & test expectations
- Any `.rs` change requires `./rebuild.sh` (programs + `sdk/sync-types.sh` + SDK
  rebuild + lint). SDK-only changes: `cd sdk && yarn build-local`.
- `./test.sh` flags reviewers should expect in PR descriptions:
  `-p <program>`, `--skip-build`, `--no-sdk-build`, `--no-logs`.
- Root `node_modules/@metadaoproject/programs` symlinks to `sdk/` — never suggest
  manual linking.

## Program-version map (source: sdk/sync-types.sh)
- launchpad v0.6/v0.7/v0.8 (all live) · futarchy v0.6 · bid_wall v0.7 ·
  mint_governor v0.7 · performance_package_v2 v0.7 · liquidation v0.7 ·
  conditional_vault v0.4 · price_based_performance_package v0.6 · gated_mint v0.1
- PRs adding a version must update `sdk/sync-types.sh`. Update SDK exports only
  when they change; changing a program's default version requires updating its
  own `sdk/src/<program>/index.ts`.
- `scripts/v0.3`–`v0.5` paths not listed in sync-types.sh are legacy: line-review
  fund-moving scripts regardless (spending limits, useSpendingLimit, etc).

## Rust review priorities
- Account validation and CPI signer checks first; style nits only in mechanical PRs.
- Error enums are append-only — new variants go at the end, never mid-list.
- Squads reentrancy constraint: futarchy → squads → futarchy CPI cycles are
  runtime-rejected; flag new instructions that could create one.

## Environment & keypair hygiene
- Scripts read env from `.env` (see `.env.example`): `NETWORK`, `RPC_URL`,
  `WALLET_PATH` (default `~/.config/solana/id.json` per Anchor.toml),
  `LAUNCH_AUTHORITY_KEYPAIR_PATH`, launch metadata vars.
- Reviews verify: no literal secrets, no committed keypair files, no echoing of
  secret VALUES. Env NAMES in logs/docs are fine.

## CI / workflows
- Deploy-critical workflows: `reusable-build.yaml`, `deploy-programs.yaml`,
  `deploy-buffer.yaml`, `verify-build.yaml` (maintainer-triggered dispatch only).
- Workflow PRs that only add build context (echo of env names, version stamping,
  artifact naming) are routine CI hygiene: verify YAML syntax + action pinning.
- Any switch from `workflow_dispatch` to automatic triggers must be flagged.

## Reviewer shortcut
- Docs-only, comment-only, and rename-only PRs from contributors with a
  previously merged fix: summarize, do not line-review.
- Scripts under `scripts/` that move funds: always line-review changes to
  amounts, recipients, or signing accounts.

## Tone
- Summary-first format, matching this repo's existing review style.
