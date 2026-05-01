# Launchpad v8 ↔ Gated Token — Integration Plan

A concrete plan for letting launchpad v8 launch gated tokens. Companion to `gated-token-spec.md`.

## Summary

Launchpad v8 supports an opt-in **gated** launch mode. Gated launches keep their tokens behind the gated_token program's freeze invariant: per-mint user whitelist on calls, frozen-at-rest vaults. Standard launches behave exactly as today. The two programs cooperate via wrapper invocation (`gated_invoke`) — there are **no direct CPIs between launchpad and gated_token**.

Gated launches do **not** support bid walls in v1.

## Distinguishing gated from non-gated launches

A launch's gating status is encoded entirely in `base_mint.freeze_authority`. The launchpad does **not** add a flag — there's no `is_gated` field on `Launch` or `InitializeLaunchArgs`. The mint itself is the source of truth.

Accepted states for `base_mint.freeze_authority` at `initialize_launch`:

- `None` — classic, ungated launch.
- `Some(<gated_mint_config PDA derived from base_mint and the gated_token program ID>)` — gated launch.
- Anything else is rejected.

Code that needs to know whether a launch is gated reads the mint.

## Launchpad v8 code changes

### `initialize_launch`

- Replace the unconditional `freeze_authority.is_none()` check with the discriminating check above (None or the expected gated_mint_config PDA; everything else rejected).
- Add validation: if the launch is gated (per the freeze authority), `args.has_bid_wall` must be `false`.
- **Source comment requirement.** A comment at the freeze-authority check must explain *why* a non-None freeze authority is acceptable: specifically, that the only tolerated freeze authority is the gated_token program's PDA, which is a deterministically-derived authority owned by an on-chain program we trust to enforce the gating invariant. Any other freeze authority would let an unrelated party freeze launch participants' token accounts at will, which is the original reason the assertion existed.

### Other instructions

No code changes required in `start_launch`, `close_launch`, `fund`, `set_funding_record_approval`, `extend_launch`, `settle_launch`, `claim`, `claim_additional_token_allocation`, `refund`, `finalize_launch`. Gating is enforced from the outside via `gated_invoke` wrapper invocation; the launchpad is unaware.

## Gated launch lifecycle


| #   | Caller      | Operation                                                                            | Wrappered (`gated_invoke`)?                                                                        |
| --- | ----------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1   | Setup       | Create `base_mint` with freeze authority set to the expected `gated_mint_config` PDA | n/a                                                                                                |
| 2   | Setup       | `gated_token::initialize_gated_mint`                                                 | direct                                                                                             |
| 3   | MetaDAO ops | `launchpad::initialize_launch`                                                       | wrappered — post-CPI freezes `launch_base_vault`                                                   |
| 4   | MetaDAO ops | `gated_token::add_whitelisted_user` × N                                              | direct                                                                                             |
| 5   | Launch auth | `launchpad::start_launch`                                                            | direct                                                                                             |
| 6   | Investors   | `launchpad::fund`                                                                    | direct (USDC only)                                                                                 |
| 7   | Launch auth | `launchpad::set_funding_record_approval`                                             | direct                                                                                             |
| 8   | Launch auth | `launchpad::close_launch`                                                            | direct                                                                                             |
| 9   | Launch auth | `launchpad::settle_launch`                                                           | wrappered — post-CPI freezes `launch_base_vault`, futarchy AMM base vault, DAMM v2 `token_a_vault` |
| 10  | Investor    | `launchpad::claim`                                                                   | wrappered                                                                                          |
| 11  | Investor    | `launchpad::refund` (failed launch)                                                  | direct (USDC only)                                                                                 |
| 12  | Recipient   | `launchpad::claim_additional_token_allocation`                                       | wrappered                                                                                          |
| 13  | Anyone      | `launchpad::finalize_launch`                                                         | direct (no gated-token movement; sets up authorized minters)                                       |
| 14  | MetaDAO ops | `gated_token::disable_gating` (after gating period)                                  | direct                                                                                             |
| 15  | Anyone      | `gated_token::thaw_account` per holder                                               | direct                                                                                             |


Step 1 requires the mint creator to know the expected `gated_mint_config` PDA: `[b"gated_mint_config", base_mint]` under the gated_token program ID.

## Trust model

- **Freeze authority** of the gated base mint: `gated_mint_config` PDA. Set at mint creation, transferred via `initialize_gated_mint`.
- **Mint authority** of the gated base mint: transferred to `mint_governor` during `initialize_launch` (unchanged from standard launchpad). Authorized minters added at `finalize_launch`: `performance_package` PDA (program-controlled) and DAO Squads vault (multisig-controlled, relies on signer discipline — acceptable per spec).
- `**gated_mint_config.admin`**: static, set at gated mint init time (MetaDAO ops). Manages user whitelist and tear-down. Does **not** transfer to the DAO at finalize. Revisit if misalignment with `mint_governor.admin`'s post-finalize transfer becomes operationally awkward.
- **User whitelist source of truth**: `gated_token`. Operationally, MetaDAO ops mirrors approved funders into the whitelist; the launchpad does not enforce alignment.

## Note on CPI depth

Wrapped `settle_launch` reaches the deepest CPI chain in this integration: `gated_token → launchpad → futarchy → squads → spl_token`, exactly 5 programs — the default Solana stack-depth limit. `settle_launch` is the only instruction expected to operate that close to the limit, and we don't anticipate it deepening further. Any change that adds a nested CPI inside `settle_launch`'s call graph needs to be reviewed against this constraint.

## Out of scope (v1)

- Bid wall integration with gated launches.
- Auto-mirroring `funding_record` approvals into the user whitelist.
- Per-instruction discriminator filtering inside whitelisted programs.
- Transferring `gated_mint_config.admin` to the DAO at finalize.

