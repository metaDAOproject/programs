import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.6";
import { PublicKey } from "@solana/web3.js";

// LAUNCH TO START
const LAUNCH_ADDRESS = new PublicKey(
  "HSAhaqkZsU94fwXpcoW3ZQiA5rSCQZUvUt4FxR1JfN8e",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const startLaunch = async (launchAddress: PublicKey) => {
  console.log(`Starting launch: ${launchAddress.toBase58()}`);
  console.log(`Launch authority: ${payer.publicKey.toBase58()}`);

  try {
    // Fetch launch data to verify it exists and show current state
    console.log("\nFetching launch data...");
    const launchData = await launchpad.fetchLaunch(launchAddress);

    if (!launchData) {
      throw new Error("Launch not found at the provided address");
    }

    console.log("\nLaunch Details:");
    console.log("===============");
    console.log(`Token Mint: ${launchData.baseMint.toBase58()}`);
    console.log(`Current State: ${JSON.stringify(launchData.state)}`);

    // Start the launch
    console.log("\nStarting launch...");
    const txSignature = await launchpad
      .closeLaunchIx({
        launch: launchAddress,
      })
      .rpc();

    console.log(`Launch started successfully!`);
    console.log(`Transaction signature: ${txSignature}`);
    console.log(`Launch address: ${launchAddress.toBase58()}`);

    // Fetch updated state
    const updatedLaunchData = await launchpad.fetchLaunch(launchAddress);
    console.log(`\nUpdated State: ${JSON.stringify(updatedLaunchData?.state)}`);

    return {
      txSignature,
      launchAddress,
      updatedState: updatedLaunchData?.state,
    };
  } catch (error) {
    console.error("Failed to start launch:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.message.includes("already been processed")) {
        console.error("\nThe launch may have already been started.");
      }
    }
    throw error;
  }
};

startLaunch(LAUNCH_ADDRESS).catch(console.error);
