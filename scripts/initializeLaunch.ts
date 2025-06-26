import * as token from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ConditionalVaultClient,
  getDaoTreasuryAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
  LaunchpadClient,
} from "@metadaoproject/futarchy/v0.4";
import { BN } from "bn.js";
import { DEVNET_MUSDC, USDC } from "./consts.js";
import { createMetadataAccountV3 } from "@metaplex-foundation/mpl-token-metadata";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { fromWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as fs from "fs";

// Use the RPC endpoint of your choice.

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const umi = createUmi(provider.connection.rpcEndpoint).use(mplTokenMetadata());
umi.use(walletAdapterIdentity(provider.wallet));

const autocrat: AutocratClient = AutocratClient.createClient({ provider });
const vaultProgram: ConditionalVaultClient =
  ConditionalVaultClient.createClient({ provider });
const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = ONE_MINUTE_IN_SECONDS * 60;
const ONE_DAY_IN_SECONDS = ONE_HOUR_IN_SECONDS * 24;
const SEVEN_DAYS_IN_SECONDS = ONE_DAY_IN_SECONDS * 7;
const KOLLAN_PUBKEY = new PublicKey(
  "CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf"
);

async function main() {
  const seed = "186fMCnZjcoD8i9K";
  const MTN = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    token.TOKEN_PROGRAM_ID
  );

  const [launch] = getLaunchAddr(launchpad.getProgramId(), MTN);
  const [launchSigner] = getLaunchSignerAddr(launchpad.getProgramId(), launch);

  console.log(launch.toBase58());

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE
  );

  const tx = new Transaction().add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: MTN,
      basePubkey: payer.publicKey,
      seed,
      lamports: lamports,
      space: token.MINT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(MTN, 6, launchSigner, null)
  );
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  await provider.connection.sendRawTransaction(tx.serialize());

  await launchpad
    .initializeLaunchIx(
      "mtnCapital",
      "MTN",
      "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/MTN/MTN.json",
      new BN(0),
      SEVEN_DAYS_IN_SECONDS,
      MTN,
      KOLLAN_PUBKEY,
      false,
      payer.publicKey
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }),
    ])
    .rpc();
}

main();
