import {
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

export async function deriveTokenMint(
  authority: PublicKey,
  tokenSeed: string,
): Promise<PublicKey> {
  return PublicKey.createWithSeed(authority, tokenSeed, TOKEN_PROGRAM_ID);
}

export function deriveLaunch(baseMint: PublicKey): PublicKey {
  const [launch] = getLaunchAddr(undefined, baseMint);
  return launch;
}

export function deriveLaunchSigner(launch: PublicKey): PublicKey {
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);
  return launchSigner;
}

/** Resolve mint + launch from seed + authority (launch authority, not always payer). */
export async function deriveLaunchAccounts(
  authority: PublicKey,
  tokenSeed: string,
): Promise<{
  tokenMint: PublicKey;
  launch: PublicKey;
  launchSigner: PublicKey;
}> {
  const tokenMint = await deriveTokenMint(authority, tokenSeed);
  const launch = deriveLaunch(tokenMint);
  const launchSigner = deriveLaunchSigner(launch);
  return { tokenMint, launch, launchSigner };
}
