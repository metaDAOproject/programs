# Shared launch lifecycle CLI

Per-launch config lives in [`../launches/<name>/constants.ts`](../launches/).
Shared runners + allocation strategies live here.

## Usage

```bash
bun scripts/v0.7/launch/cli.ts <launch> status
bun scripts/v0.7/launch/cli.ts <launch> initialize
bun scripts/v0.7/launch/cli.ts <launch> start
bun scripts/v0.7/launch/cli.ts <launch> allocate          # dry-run
bun scripts/v0.7/launch/cli.ts <launch> allocate --execute
bun scripts/v0.7/launch/cli.ts <launch> end               # close + create LUT
bun scripts/v0.7/launch/cli.ts <launch> complete
bun scripts/v0.7/launch/cli.ts <launch> perfPackage
bun scripts/v0.7/launch/cli.ts <launch> claimAll
bun scripts/v0.7/launch/cli.ts <launch> extend            # print Squads message
bun scripts/v0.7/launch/cli.ts <launch> claimAdditional
```

`status` reads on-chain state + constants fill-in and recommends the next manual step.

## New launch

1. Copy `launches/_template` → `launches/<name>`
2. Fill `constants.ts` (`ALLOCATION_STRATEGY`, seed, team, goals, …)
3. Copy `.env.example` → `.env` for allocate
4. `bun scripts/v0.7/launch/cli.ts <name> status`

## Allocation strategies

Set `ALLOCATION_STRATEGY` in constants:

| Flag | Behavior |
|------|----------|
| `nash` | Ownership vs accumulator congestion game (needs PG ownership scores) |
| `prealloc-accum` | CSV pre-alloc off top + accumulator remainder (`PREALLOC_CSV`) |

Allocate deps: `cd scripts/v0.7/launch/allocation && bun install`
