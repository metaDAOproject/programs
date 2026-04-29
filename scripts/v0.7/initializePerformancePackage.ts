import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import { PublicKey } from "@solana/web3.js";

const LAUNCH_TO_COMPLETE: PublicKey | undefined = new PublicKey(
  "111111111111111111111111111111111",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const completeLaunch = async () => {
  if (LAUNCH_TO_COMPLETE === undefined) {
    throw new Error(
      "LAUNCH_TO_COMPLETE is not set. Please set it in the script.",
    );
  }

  const launchAccount = await launchpad.fetchLaunch(LAUNCH_TO_COMPLETE);

  console.log("Setting up performance package...");

  const initializePerformancePackageTxHash = await launchpad
    .initializePerformancePackageIx({
      launch: LAUNCH_TO_COMPLETE,
      baseMint: launchAccount.baseMint,
      payer: payer.publicKey,
    })
    .rpc();

  console.log(
    `Initialize performance package transaction sent: ${initializePerformancePackageTxHash}`,
  );

  console.log("Performance package set up successfully!");
};

completeLaunch().catch(console.error);
