# Futarchy Fuzz Test

This directory contains the Wake.sol stateful fuzz test for the Futarchy
program at commit `05f8a5c8efc22f4cf157e313d6d768475526a004`. It has 29
instruction-level happy paths, 29 unhappy paths, two support flows, and twelve
global invariants. Each instruction wrapper also checks its
own postconditions or atomic rollback behavior.

## Running the test

1. Install [Wake.sol](https://github.com/ack3-ai/wake.sol) in a Python virtual
   environment at commit
   `096d5bfed511d0f0a3e27c960468a756a6c6440b`.

2. Activate the environment.

3. From this repository's root, build the Futarchy program:

```bash
anchor build -p futarchy
```

4. Create Wake's compatible IDL and regenerate the checked-in Python bindings:

```bash
python fuzz/futarchy/gen_wake_idl.py
wake-sol gen \
  --target-idl target/wake-idl \
  --out fuzz/futarchy/pytypes \
  --only FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq \
  --strict
```

5. Ensure the built Futarchy artifact and checked-in dependencies are present:

```text
target/deploy/futarchy.so
verifiable-builds/conditional_vault.so
tests/fixtures/squads_multisig.so
tests/fixtures/squads-program-config
```

6. Run the default 100-sequence, 500-flow campaign:

```bash
python -m pytest -q -s fuzz/futarchy/test_fuzz.py
```

Use `FUTARCHY_FUZZ_SEQUENCES` and `FUTARCHY_FUZZ_FLOWS` to change the number of
sequences and flows for local or pipeline runs.

The test prints a base seed. Reproduce that run with:

```bash
BASE_SEED="<printed-base-seed>"
python -m pytest -q -s --seed "$BASE_SEED" fuzz/futarchy/test_fuzz.py
```

Failures and their reproducible crash data are written under
`.wake-sol/logs/crashes/`.

### GitHub Actions

The `Futarchy fuzz` workflow runs only when manually started from the repository's
Actions page. Choose **Run workflow** and set the sequence and flow counts. Leave
the seed empty for a new campaign, or enter a previously printed base seed to
reproduce a run.

For a new campaign, the workflow starts one worker per available CPU. The
default is 500 sequences of 500 flows per worker, and both values can be changed
when starting the workflow. Providing a seed runs an exact single-process replay
instead. The workflow has a five-hour timeout and uploads the run log, manifest,
and any Wake crash data as a
`futarchy-fuzz-<run>-<attempt>` artifact retained for 14 days.

## Flows

Every instruction name below has a `<name>_happy` flow for a valid transition
and a `<name>_unhappy` flow for a small expected-failure case.

| Area | Instruction flows |
| --- | --- |
| DAO creation | `initialize_dao` |
| Proposal creation | `initialize_proposal`, `initialize_large_spend_proposal`, `initialize_mint_tokens_proposal`, `initialize_spending_limit_change_proposal`, `initialize_hostile_takeover_proposal`, `initialize_hostile_liquidate_proposal`, `initialize_buyback_token_proposal` |
| Proposal lifecycle | `stake_to_proposal`, `unstake_from_proposal`, `sponsor_proposal`, `launch_proposal`, `finalize_proposal` |
| AMM | `provide_liquidity`, `withdraw_liquidity`, `spot_swap`, `conditional_swap`, `collect_fees` |
| DAO configuration | `update_dao`, `set_spending_limit`, `sync_spending_limit` |
| Squads administration | `admin_enqueue_multisig_proposal_approval`, `execute_multisig_proposal_approval`, `admin_enqueue_multisig_proposal_cancellation`, `execute_multisig_proposal_cancellation`, `admin_execute_multisig_proposal` |
| Proposal administration | `admin_cancel_proposal`, `admin_remove_proposal`, `admin_update_proposal_params` |

Two additional flows support those instruction flows:

- `advance_clock` moves the deterministic clock across proposal and TWAP
  boundaries.
- `execute_passed_proposal_payload` executes approved proposal payloads through
  Squads.

Happy flows check their instruction's account and token transitions. Unhappy
flows require the intended error and verify that writable accounts roll back.

## Global invariants

| Invariant | Property checked after every flow |
| --- | --- |
| `dao_identity_is_canonical` | The DAO PDA, owner, mints, Squads accounts, and AMM vaults remain canonical. |
| `dao_configuration_stays_valid` | Mutable DAO configuration remains inside the program's valid bounds. |
| `underlying_token_supplies_are_conserved` | All base and quote tokens remain accounted for. |
| `spot_reserves_and_fees_are_fully_backed` | Spot vault balances equal reserves plus protocol fees. |
| `conditional_reserves_and_fees_are_fully_backed` | In Futarchy state, each outcome's spot-plus-conditional reserves and fees equal underlying vault tokens plus that outcome's vault tokens. |
| `conditional_token_supplies_are_backed` | Both conditional-token supplies are accounted for and collateral covers unresolved or resolved claims. |
| `positions_sum_to_total_liquidity` | Canonical AMM positions sum to total liquidity. |
| `proposal_account_graphs_are_canonical` | Proposal, market, vault, and conditional-mint links remain canonical. |
| `proposal_stake_custody_is_conserved` | Stake records equal proposal custody balances. |
| `enqueued_approvals_are_canonical` | Live Squads approval records have the correct PDA and transaction index. |
| `enqueued_cancellations_are_canonical` | Live Squads cancellation records have the correct PDA and transaction index. |
| `cancelled_transactions_never_execute` | Cancelled Squads proposals remain cancelled and never execute. |
