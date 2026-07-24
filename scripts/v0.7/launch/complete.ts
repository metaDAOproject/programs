import {
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { precheckComplete } from "../../utils/launch/checks.js";
import { deriveLaunch, deriveTokenMint } from "../../utils/launch/derive.js";
import { createLaunchContext } from "../../utils/launch/provider.js";
import { requireLutAddress } from "./loadConfig.js";
import type { LaunchConfig } from "./types.js";

export async function completeLaunch(config: LaunchConfig): Promise<void> {
  requireLutAddress(config);

  const { provider, payer, launchpad } = createLaunchContext();

  const TOKEN = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  console.log("Token address:", TOKEN.toBase58());

  const launch = deriveLaunch(TOKEN);
  console.log("Launch address:", launch.toBase58());

  const checks = await precheckComplete(
    launchpad,
    provider.connection,
    config,
    launch,
  );
  for (const msg of checks.messages) {
    console.log(`precheck: ${msg}`);
  }
  if (!checks.ok) {
    throw new Error("Complete pre-checks failed — see messages above");
  }

  let launchAccount = await launchpad.fetchLaunch(launch);
  if (!launchAccount) {
    throw new Error("Launch account not found");
  }

  const tx = await launchpad
    .completeLaunchIx({
      launch,
      baseMint: launchAccount.baseMint,
      launchAuthority: payer.publicKey,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
    ])
    .transaction();

  const lutResp = await provider.connection.getAddressLookupTable(
    config.LUT_ADDRESS,
  );
  if (!lutResp.value) {
    throw new Error(`LUT not found: ${config.LUT_ADDRESS.toBase58()}`);
  }

  const { blockhash, lastValidBlockHeight } =
    await provider.connection.getLatestBlockhash();

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([lutResp.value]);

  const vtx = new VersionedTransaction(message);
  vtx.sign([payer]);

  const completeTxHash = await provider.connection.sendTransaction(vtx);
  console.log(`Complete launch transaction sent: ${completeTxHash}`);

  const confirmation = await provider.connection.confirmTransaction(
    { signature: completeTxHash, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  if (confirmation.value.err) {
    throw new Error(
      `Launch completion failed ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  console.log("Launch completed successfully!");
  console.log(
    "Run `perfPackage` separately to initialize the performance package.",
  );
}

/** Standalone performance-package init — keep decoupled from complete. */
export async function initializePerformancePackage(
  config: LaunchConfig,
): Promise<void> {
  const { provider, payer, launchpad } = createLaunchContext();

  const TOKEN = await deriveTokenMint(
    config.LAUNCH_AUTHORITY,
    config.TOKEN_SEED,
  );
  const launch = deriveLaunch(TOKEN);

  const launchAccount = await launchpad.fetchLaunch(launch);
  if (!launchAccount) {
    throw new Error("Launch account not found");
  }

  console.log("Setting up performance package...");
  const txHash = await launchpad
    .initializePerformancePackageIx({
      launch,
      baseMint: launchAccount.baseMint,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(`Initialize performance package transaction sent: ${txHash}`);
  console.log("Performance package set up successfully!");
}
