import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
} from "@metadaoproject/programs/launchpad/v0.7";
import { PublicKey, Transaction } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { TOKEN_SEED } from "./constants.js";
import { createLookupTableForTransaction } from "../../utils/utils.js";

const provider = anchor.AnchorProvider.env();
const payer = (
  provider.wallet as anchor.Wallet & { payer: anchor.web3.Keypair }
).payer;

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const end = async () => {
  // Get token address
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    TOKEN_SEED,
    token.TOKEN_PROGRAM_ID,
  );
  console.log("Token address:", TOKEN.toBase58());

  const [launch] = getLaunchAddr(undefined, TOKEN);

  const closeLaunchIx = await launchpad
    .closeLaunchIx({
      launch,
    })
    .instruction();

  // Build transaction without compute budget first
  const tx = new Transaction().add(closeLaunchIx);

  const { blockhash } = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = payer.publicKey;

  // Simulate transaction to get compute units used
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Launch closed", txHash);

  console.log("Creating ALT for complete");
  let launchAccount = await launchpad.fetchLaunch(launch);
  if (!launchAccount) {
    throw new Error("Launch account not found");
  }
  const completeTx = await launchpad
    .completeLaunchIx({
      launch: launch,
      baseMint: launchAccount.baseMint,
      launchAuthority: payer.publicKey,
    })
    .transaction();

  // TODO: consider this as potential for new script... or something that we run post close...
  // NOTE This is ONLY the transaction to create the ALT, we don't complete it here...
  // Create ALT for complete
  const LUT = await createLookupTableForTransaction(
    completeTx,
    payer,
    provider.connection,
  );

  console.log("LUT", LUT);
  console.log("LUT", LUT.key.toBase58());
  const fetchedLUT = await provider.connection.getAddressLookupTable(
    new PublicKey(LUT.key.toBase58()),
  );
  console.log("fetchedLUT", fetchedLUT);
  console.log("fetchedLUT", fetchedLUT.value?.key.toBase58());
  console.log("Add LUT to constants.ts");
};

end().catch(console.error);
