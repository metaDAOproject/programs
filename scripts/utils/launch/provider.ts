import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import type { Keypair } from "@solana/web3.js";

export type PayerWallet = anchor.Wallet & { payer: Keypair };

export interface LaunchContext {
  provider: anchor.AnchorProvider;
  payer: Keypair;
  launchpad: LaunchpadClient;
}

/** Bootstrap Anchor provider + typed payer + LaunchpadClient from env. */
export function createLaunchContext(): LaunchContext {
  const provider = anchor.AnchorProvider.env();
  const payer = (provider.wallet as PayerWallet).payer;
  const launchpad = LaunchpadClient.createClient({ provider });
  return { provider, payer, launchpad };
}
