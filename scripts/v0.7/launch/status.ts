import BN from "bn.js";

import { launchStateKey, precheckComplete } from "../../utils/launch/checks.js";
import { deriveLaunch, deriveTokenMint } from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import { isUnsetPubkey, type LaunchConfig } from "./types.js";

export interface StatusReport {
  launchName: string;
  derivedMint: string;
  derivedLaunch: string;
  constantsLaunch: string;
  constantsLut: string;
  onChainState: string;
  totalApproved?: string;
  targetAllocation?: string;
  expired?: boolean;
  recommendedStep: string;
  reasons: string[];
}

/**
 * Read constants fill-in + on-chain launch state and recommend the next manual step.
 * Does not execute anything.
 */
export async function getLaunchStatus(
  config: LaunchConfig,
): Promise<StatusReport> {
  const { provider, launchpad } = createLaunchContext();

  const tokenMint = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  const derivedLaunch = deriveLaunch(tokenMint);

  const reasons: string[] = [];
  let recommendedStep = "status";
  let onChainState = "missing";
  let expired: boolean | undefined;
  let totalApproved: string | undefined;
  let targetAllocation: string | undefined;

  const account = await launchpad.fetchLaunch(derivedLaunch);
  if (!account) {
    recommendedStep = "initialize";
    reasons.push("No launch account on-chain for derived mint/seed");
  } else {
    onChainState = launchStateKey(account.state as Record<string, unknown>);
    const target = new BN(config.TOTAL_ALLOCATION).mul(new BN(1_000_000));
    totalApproved = account.totalApprovedAmount.toString();
    targetAllocation = target.toString();

    if (
      !isUnsetPubkey(config.LAUNCH_ADDRESS) &&
      !config.LAUNCH_ADDRESS.equals(derivedLaunch)
    ) {
      reasons.push(
        `LAUNCH_ADDRESS in constants (${config.LAUNCH_ADDRESS.toBase58()}) !== derived (${derivedLaunch.toBase58()})`,
      );
    }

    if (onChainState === "initialized") {
      recommendedStep = "start";
      reasons.push("Launch is Initialized — ready to start");
    } else if (onChainState === "live") {
      if (account.unixTimestampStarted) {
        const now = Math.floor(Date.now() / 1000);
        const closeTime =
          account.unixTimestampStarted.toNumber() + account.secondsForLaunch;
        expired = now >= closeTime;
      }
      if (expired) {
        recommendedStep = "allocate";
        reasons.push(
          "Launch is Live and expired — run allocate --execute (closes first) or end",
        );
      } else {
        recommendedStep = "allocate";
        reasons.push(
          "Launch is Live and not expired — wait, or dry-run allocate",
        );
      }
    } else if (onChainState === "closed") {
      if (!account.totalApprovedAmount.eq(target)) {
        recommendedStep = "allocate";
        reasons.push(
          `Approvals incomplete (${totalApproved} vs ${targetAllocation}) — run allocate --execute`,
        );
      } else if (isUnsetPubkey(config.LUT_ADDRESS)) {
        recommendedStep = "end";
        reasons.push(
          "Approvals OK but LUT_ADDRESS unset — run end to create ALT (or paste existing LUT)",
        );
      } else {
        const checks = await precheckComplete(
          launchpad,
          provider.connection,
          config,
          derivedLaunch,
        );
        if (checks.ok) {
          recommendedStep = "complete";
          reasons.push("Closed, approvals OK, LUT set — ready to complete");
        } else {
          recommendedStep = "complete";
          reasons.push(...checks.messages);
        }
      }
    } else if (onChainState === "complete") {
      recommendedStep = "claimAll";
      reasons.push(
        "Launch is Complete — run claimAll (and perfPackage if not done)",
      );
    } else if (onChainState === "refunding") {
      recommendedStep = "status";
      reasons.push("Launch is Refunding (min raise not met) — refund path");
    } else {
      recommendedStep = "status";
      reasons.push(`Unhandled on-chain state: ${onChainState}`);
    }
  }

  return {
    launchName: config.name,
    derivedMint: tokenMint.toBase58(),
    derivedLaunch: derivedLaunch.toBase58(),
    constantsLaunch: config.LAUNCH_ADDRESS.toBase58(),
    constantsLut: config.LUT_ADDRESS.toBase58(),
    onChainState,
    totalApproved,
    targetAllocation,
    expired,
    recommendedStep,
    reasons,
  };
}

export async function printLaunchStatus(config: LaunchConfig): Promise<void> {
  const report = await getLaunchStatus(config);
  console.log("\n=== Launch status ===");
  console.log(`Launch:           ${report.launchName}`);
  console.log(`Derived mint:     ${report.derivedMint}`);
  console.log(`Derived launch:   ${report.derivedLaunch}`);
  console.log(`Constants launch: ${report.constantsLaunch}`);
  console.log(`Constants LUT:    ${report.constantsLut}`);
  console.log(`On-chain state:   ${report.onChainState}`);
  if (report.totalApproved !== undefined) {
    console.log(
      `Approved / target: ${report.totalApproved} / ${report.targetAllocation}`,
    );
  }
  if (report.expired !== undefined) {
    console.log(`Expired:          ${report.expired}`);
  }
  console.log(`\nRecommended next: ${report.recommendedStep}`);
  for (const reason of report.reasons) {
    console.log(`  - ${reason}`);
  }
  console.log("");
}
