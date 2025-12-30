import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, getLaunchAddr } from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const launch = new PublicKey("FvQCwxmELEr7Dis8eQsij1F53wxgMohSiEZ9jMLMCapm");

export const closeLaunch = async () => {
  console.log(`Closing launch at address: ${launch.toBase58()}`);

  await launchpad.closeLaunchIx({ launch }).rpc();

  console.log("Launch closed successfully");
};

closeLaunch().catch(console.error);
