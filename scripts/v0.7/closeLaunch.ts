import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/launchpad/v0.7";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const launch = new PublicKey("111111111111111111111111111111111");

export const closeLaunch = async () => {
  console.log(`Closing launch at address: ${launch.toBase58()}`);

  await launchpad.closeLaunchIx({ launch }).rpc();

  console.log("Launch closed successfully");
};

closeLaunch().catch(console.error);
