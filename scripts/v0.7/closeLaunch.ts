import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const closeLaunch = async () => {
  const mintKp = new PublicKey("PRVT6TB7uss3FrUd2D9xs2zqDBsa3GbMJMwCQsgmeta");

  const [launch] = getLaunchAddr(undefined, mintKp);

  console.log(`Closing launch at address: ${launch.toString()}`);

  await launchpad.closeLaunchIx({ launch }).rpc();

  console.log("Launch closed successfully");
};

closeLaunch().catch(console.error);
