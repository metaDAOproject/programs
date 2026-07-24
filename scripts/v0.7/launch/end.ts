import { PublicKey } from "@solana/web3.js";

import { createLookupTableForTransaction } from "../../utils/utils.js";
import { deriveLaunch, deriveTokenMint } from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import { simulateAndSendVersioned } from "../../utils/transactions.js";
import type { LaunchConfig } from "./types.js";

/**
 * Close the launch (if still live), then create an ALT for completeLaunch.
 * Does NOT complete — paste the printed LUT into constants.ts.
 */
export async function endLaunch(config: LaunchConfig): Promise<void> {
  const { provider, payer, launchpad } = createLaunchContext();

  const TOKEN = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  console.log("Token address:", TOKEN.toBase58());

  const launch = deriveLaunch(TOKEN);
  console.log("Launch address:", launch.toBase58());

  const closeLaunchIx = await launchpad.closeLaunchIx({ launch }).instruction();

  const txHash = await simulateAndSendVersioned(
    [closeLaunchIx],
    payer,
    provider.connection,
  );
  console.log("Launch closed", txHash);

  console.log("Creating ALT for complete...");
  const launchAccount = await launchpad.fetchLaunch(launch);
  if (!launchAccount) {
    throw new Error("Launch account not found after close");
  }

  const completeTx = await launchpad
    .completeLaunchIx({
      launch,
      baseMint: launchAccount.baseMint,
      launchAuthority: payer.publicKey,
    })
    .transaction();

  const lut = await createLookupTableForTransaction(
    completeTx,
    payer,
    provider.connection,
  );
  if (!lut) {
    throw new Error("Failed to create address lookup table");
  }

  const lutKey = lut.key.toBase58();
  console.log("LUT", lutKey);
  const fetched = await provider.connection.getAddressLookupTable(
    new PublicKey(lutKey),
  );
  console.log("fetchedLUT", fetched.value?.key.toBase58());
  console.log(`Set LUT_ADDRESS = new PublicKey("${lutKey}") in constants.ts`);
}
