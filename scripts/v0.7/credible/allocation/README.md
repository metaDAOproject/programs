# credible

Standalone one-off. Allocates a launch where a set list of wallets get a
**fixed pre-allocated amount off the top** (from a CSV), then everyone else
splits the remainder using the **same accumulator algorithm as the
accelerated-cranker**.

Dry-run by default. With `--execute` it **confirms each on-chain step at the
terminal**: closes the launch if it's live+expired (freezing the funder set
first), then approves every funder (sets the allocation) and verifies the total.

credible **stops after setting the allocation** — it does not `completeLaunch`. The
launch is left in `Closed` state; `completeLaunch` and the performance package
are done **manually** afterward by whoever holds the launch authority.

## Layout

- `ac/` — files copied **verbatim** from `apps/accelerated-cranker` (each differs
  from its source only by import-path lines):
  - `accumulator.ts` — the time-weighted allocation algorithm
  - `fundingApproval.ts` — batched `setFundingRecordApproval` + launch reads
  - `constants.ts` — shared constants
- Top level — code written/adapted for this script:
  - `credible.ts` — entry point: config, state machine (close → approve → verify), prompts
  - `allocation.ts` — the pre-allocated off-the-top split (the only bespoke logic; pure + unit-tested)
  - `db.ts` — read-only fund-events query for the boost
  - `utils.ts` — USDC formatting, key/clock loading, pre-alloc CSV loader, table printer, confirmation prompt
  - `ico-pref.csv` — pre-allocations (`Address,Allocated`): each wallet + its fixed amount
  - `logger.ts` — console logger with a pino-compatible surface
  - `test.ts` — local surfpool end-to-end harness (setup → crank → per-funder verify)
  - `test/allocation.test.ts` — unit tests for the allocation composition (`bun test`)

## Setup

```bash
bun install
cp .env.example .env   # then fill it in
```

`.env`:

- `RPC_URL` — Solana RPC (staging surfpool, or `http://127.0.0.1:8899` for a local one)
- `FUTARCHY_PG_URL` — indexer Postgres; read-only, for the boost's fund events
- `CREDIBLE_AUTHORITY_KEY` — launch authority key (base58 or JSON byte array). Only needed for `--execute`.

Config block at the top of `credible.ts`:

- `LAUNCH_ADDRESS` — the launch to allocate (preset to Credible Finance)
- `TOTAL_ALLOCATION` — total to allocate, in whole USDC (a config variable,
  **not** the launch's `minimumRaiseAmount`)
- `BOOST_MULTIPLIER` / `BOOST_FILL_CEILING` / `BOOST_LOOK_AHEAD_HOURS` —
  accumulator boost (preset to the cranker's prod defaults: 10 / 3 / 1)

Pre-allocated wallets + their fixed amounts go in `ico-pref.csv` (header row, then
`Address,Allocated` — e.g. `GaDZ…,"$375,000 "`). Each amount must be ≤ that
wallet's on-chain commitment, or the run throws.

## Run

```bash
bun credible.ts             # dry run — prints the allocation table + writes allocation.out.json, sends nothing
bun credible.ts --execute   # set the allocation on-chain — confirms each step (requires CREDIBLE_AUTHORITY_KEY)
```

Each run writes `allocation.out.json` — the exact per-funder allocation it computed.
After `--execute` the launch is `Closed` with the allocation set; complete it manually.

## Test

```bash
bun test        # unit tests for the allocation composition + edge cases
bun test.ts     # end-to-end on a local surfpool: overrides authority, timetravels
                # past close, cranks, then verifies every funder's on-chain amount
```

`test.ts` requires a **fresh** local surfpool forking mainnet and `.env` `RPC_URL`
pointed at it. See `TEST_REPORT.md` for the latest results.

## How the allocation works

1. Pre-allocated wallets → `approved = their fixed CSV amount` (a separate raise
   off the top). Each is validated: must be a funder, amount ≤ committed.
2. `remaining = TOTAL_ALLOCATION − Σ(pre-allocated CSV amounts)`.
3. All other funders run through `calculateAccumulatorApprovedAmounts(remaining)`,
   with the boost measured only among themselves (pre-allocated wallets excluded).
4. `Σ approved === TOTAL_ALLOCATION` (asserted before anything is sent).
