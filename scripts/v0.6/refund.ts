import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/v0.6";
import { PublicKey } from "@solana/web3.js";

// LAUNCH TO REFUND FROM
const LAUNCH_ADDRESS = new PublicKey(
  "48UeghTJDcUugF4hsSECLrotWY2pxSTuA9b87R8zybQn",
);
const REFUNDER_ADDRESS = new PublicKey(
  "BF8hxzzR4KuVxfsyAUFyy26E6y2GhsSZgBoUQrygwof1",
);

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const refund = async (launchAddress: PublicKey) => {
  console.log(`Processing refund for launch: ${launchAddress.toBase58()}`);
  console.log(`Funder: ${payer.publicKey.toBase58()}`);

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

    // Process refund
    console.log("\nProcessing refund...");
    const txSignature = await launchpad
      .refundIx({
        launch: launchAddress,
        funder: REFUNDER_ADDRESS,
      })
      .rpc();

    console.log(`Refund processed successfully!`);
    console.log(`Transaction signature: ${txSignature}`);
    console.log(`Launch address: ${launchAddress.toBase58()}`);

    return {
      txSignature,
      launchAddress,
    };
  } catch (error) {
    console.error("Failed to process refund:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.message.includes("already been processed")) {
        console.error("\nThe refund may have already been processed.");
      }
    }
    throw error;
  }
};

refund(LAUNCH_ADDRESS).catch(console.error);
