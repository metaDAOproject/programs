# Rip Cars allocation

Standalone one-off (same CLI shape as laso / credible). Allocates the Rip Cars
launch via a **congestion-game Nash equilibrium** (ownership road vs accumulator
road — same model as `nash_equilibrium_sim.ts` / `nash_equilibrium_live.ts`),
then optionally approves every funding record on-chain.

Dry-run by default. With `--execute` it **confirms each on-chain step at the
terminal**: closes the launch if it's live+expired (freezing the funder set
first), then approves every funder and verifies the total.

Stops after setting the allocation — does **not** `completeLaunch`. The launch
is left `Closed`; complete it manually afterward.

## Layout

- `ripcars.ts` — entry point: config, close → allocate → approve → verify
- `allocation.ts` — pure Nash solver + accumulator weights
- `ac/fundingApproval.ts` — batched `setFundingRecordApproval` + launch reads
- `db.ts` — fund events + ownership scores (read-only Postgres)
- `utils.ts` — USDC formatting, table printer, `allocation.out.json`, prompts

## Setup

```bash
bun install
cp .env.example .env   # then fill it in
```

`.env`:

- `RPC_URL` — Solana RPC
- `FUTARCHY_PG_URL` — indexer Postgres (read-only; fund events + scores)
- `RIPCARS_AUTHORITY_KEY` — launch authority (base58 or JSON byte array). Only for `--execute`.

Optional Nash knobs (HTML-sim defaults):

| Env | Default | Meaning |
|-----|---------|---------|
| `OWNERSHIP_SPLIT` | `0.5` | Fraction of pool on the ownership road |
| `NASH_EPSILON` | `1` | Min $ gain before an agent switches |
| `NASH_REACT` | `0.40` | Flip probability for unhappy agents each round |
| `NASH_START` | `rand` | Initial roads: `rand` \| `acc` \| `own` |
| `NASH_SEED` | `20260723` | RNG seed (start + stochastic flips) |
| `SCORE_COLUMN` | `ownership_points` | Score column for the ownership road |

Config at the top of `ripcars.ts` pulls `LAUNCH_ADDRESS` / pool size from
`../constants.ts` — triple-check before `--execute`.

## Run

```bash
bun ripcars.ts             # dry run — prints CLI table + writes allocation.out.json
bun ripcars.ts --execute   # approve on-chain (requires RIPCARS_AUTHORITY_KEY)
```

Each run writes `allocation.out.json` — same core shape as credible/laso
(`funder`, `kind`, `committed`, `approved` atoms). `kind` is the Nash road:
`ownership` | `accumulator`.

## How the allocation works

1. **Accumulator weights** — run the accelerated-cranker over the full pool;
   each funder's approved amount becomes its weight on the accumulator road.
2. **Two roads** — ownership road water-fills `OWNERSHIP_SPLIT` of the pool by
   score; accumulator road splits the rest by weight. Both capped at committed.
3. **Best response** — same as the HTML "Solve to Nash": unhappy agents flip
   simultaneously with probability `NASH_REACT` each round until ε-Nash.
4. **Fill** — unused budget from commit-caps is redistributed by headroom so
   `Σ approved === TOTAL_ALLOCATION`, then converted to atoms.
5. `--execute` batches `setFundingRecordApproval` for those amounts.
