import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { TOKEN_SEED } from "./constants.js";

const provider = anchor.AnchorProvider.env();
const payer = (
  provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;

const LAUNCH_AUTHORITY = payer.publicKey;

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const start = async () => {
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);

  const startLaunchIx = await launchpad
    .startLaunchIx({
      launch,
      launchAuthority: LAUNCH_AUTHORITY,
    })
    .instruction();

  // Build transaction without compute budget first
  const tx = new Transaction().add(startLaunchIx);

  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;

  // Simulate transaction to get compute units used
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch initialized", txHash);
};

start().catch(console.error);
