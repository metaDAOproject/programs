/**
 * Unified launch CLI.
 *
 * Usage:
 *   bun scripts/v0.7/launch/cli.ts <launch> <step> [--execute] [--propose]
 *
 * Steps: status | initialize | start | end | allocate | complete | claimAll
 *         | perfPackage | extend | claimAdditional
 */
import { allocateLaunch } from "./allocate.js";
import { claimAll } from "./claimAll.js";
import { completeLaunch, initializePerformancePackage } from "./complete.js";
import { endLaunch } from "./end.js";
import { claimAdditionalTokens, extendLaunch } from "./helpers.js";
import { initializeLaunch } from "./initialize.js";
import { loadLaunchConfig } from "./loadConfig.js";
import { startLaunch } from "./start.js";
import { printLaunchStatus } from "./status.js";

const STEPS = [
  "status",
  "initialize",
  "start",
  "end",
  "allocate",
  "complete",
  "claimAll",
  "perfPackage",
  "extend",
  "claimAdditional",
] as const;

type Step = (typeof STEPS)[number];

function usage(): never {
  console.error(`Usage: bun cli.ts <launch> <step> [--execute] [--propose]

Launches live under scripts/v0.7/launches/<name>/constants.ts

Steps:
  ${STEPS.join(" | ")}

Examples:
  bun cli.ts rip-cars status
  bun cli.ts rip-cars allocate
  bun cli.ts rip-cars allocate --execute
  bun cli.ts laso complete
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("-")));

  const launchName = args[0];
  const step = args[1] as Step | undefined;
  if (!launchName || !step || !(STEPS as readonly string[]).includes(step)) {
    usage();
  }

  const config = await loadLaunchConfig(launchName);
  const execute = flags.has("--execute");
  const propose = flags.has("--propose");

  switch (step) {
    case "status":
      await printLaunchStatus(config);
      break;
    case "initialize":
      await initializeLaunch(config);
      break;
    case "start":
      await startLaunch(config);
      break;
    case "end":
      await endLaunch(config);
      break;
    case "allocate":
      await allocateLaunch(config, { execute });
      break;
    case "complete":
      await completeLaunch(config);
      break;
    case "claimAll":
      await claimAll(config);
      break;
    case "perfPackage":
      await initializePerformancePackage(config);
      break;
    case "extend":
      await extendLaunch(config, { propose });
      break;
    case "claimAdditional":
      await claimAdditionalTokens(config);
      break;
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
