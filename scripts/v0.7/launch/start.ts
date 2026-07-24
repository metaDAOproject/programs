import { deriveLaunch, deriveTokenMint } from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import { simulateAndSendVersioned } from "../../utils/transactions.js";
import type { LaunchConfig } from "./types.js";

export async function startLaunch(config: LaunchConfig): Promise<void> {
  const { provider, payer, launchpad } = createLaunchContext();

  const TOKEN = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  console.log("Token address:", TOKEN.toBase58());

  const launch = deriveLaunch(TOKEN);
  console.log("Launch address:", launch.toBase58());

  const startLaunchIx = await launchpad
    .startLaunchIx({
      launch,
      launchAuthority: config.LAUNCH_AUTHORITY,
    })
    .instruction();

  const txHash = await simulateAndSendVersioned(
    [startLaunchIx],
    payer,
    provider.connection,
  );

  console.log("Launch started", txHash);
}
