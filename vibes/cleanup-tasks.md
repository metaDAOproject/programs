# Gated Token Cleanup Tasks

Follow-up cleanup work to perform after the main implementation in `vibes/tasks.md` is complete. These are not blocking — they are refactors that pay down debt accumulated while phases were landing in dependency order.

## Tasks

### 1. Replace direct account manipulation in `addWhitelistedUser` post-disable test

**File:** `tests/gatedToken/unit/addWhitelistedUser.test.ts` — the `"fails after gating is disabled"` case.

**Current state:** Phase 4 landed before Phase 5 (`disable_gating`), so the post-disable test flips `gating_disabled` to `true` by reading the `GatedMintConfig` account, mutating byte at offset `8 + 32 + 32 = 72`, and writing it back via `this.context.setAccount(...)`. The `GATING_DISABLED_OFFSET` constant at the top of the file exists only for this purpose.

**What to do:** Once `disable_gating` is implemented (Phase 5), replace the `setAccount` block with a real `disableGatingIx({ mint, admin: admin.publicKey }).signers([admin]).rpc()` call. Delete the `GATING_DISABLED_OFFSET` constant.

**Why:** Direct account mutation skips the program's invariants (e.g. `seq_num` bump, event emission) and makes the test fragile against any future struct layout change. Using the real instruction also exercises the cross-instruction interaction we actually care about.

**Verification:** `./rebuild.sh && anchor test --skip-build` green.
