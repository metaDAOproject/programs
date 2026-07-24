/**
 * @deprecated Use `bun ripcars.ts` instead.
 *
 * The Rip Cars allocation CLI (Nash congestion game → allocation.out.json →
 * --execute setFundingRecordApproval) lives in this folder.
 *
 *   bun install
 *   bun ripcars.ts             # dry-run: CLI table + allocation.out.json
 *   bun ripcars.ts --execute   # approve funding records on-chain
 *
 * Interactive explorer: `bun nash_equilibrium_live.ts`
 * See README.md.
 */
console.error(
  [
    "allocate.ts has been replaced by the Rip Cars Nash allocation CLI.",
    "",
    "  bun install",
    "  bun ripcars.ts             # dry-run: CLI table + allocation.out.json",
    "  bun ripcars.ts --execute   # approve funding records on-chain",
    "",
    "See scripts/v0.7/rip-cars/allocation/README.md",
  ].join("\n"),
);
process.exit(1);
