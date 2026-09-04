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

  const { blockhash } = await provider.connection.getLatestBlockhash();

  // Build transaction
  const finalTx = new Transaction().add(startLaunchIx);

  finalTx.recentBlockhash = blockhash;
  finalTx.feePayer = payer.publicKey;
  finalTx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(
    finalTx.serialize(),
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch initialized", txHash);
};

start().catch(console.error);
