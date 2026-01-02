import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// ============= CONFIGURATION =============
// The base mint of the launch to start
const BASE_MINT = new PublicKey("DHR6KA4wGTSAK1DfT8Fe4dus62x9CLshuy7CDRt7eFBv");
// =========================================

export const startLaunch = async () => {
  const [launch] = getLaunchAddr(undefined, BASE_MINT);

  console.log(`Starting launch at address: ${launch.toBase58()}`);

  const txHash = await launchpad.startLaunchIx({ launch }).rpc();

  console.log("Launch started:", txHash);
  console.log("Launch is now accepting contributions");
};

startLaunch().catch(console.error);
