import * as anchor from "@coral-xyz/anchor";
import {
  FutarchyClient,
  LaunchpadClient,
  getDaoAddr,
  DEVNET_USDC,
  MAINNET_USDC,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "@metadaoproject/futarchy/v0.6";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import { DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY } from "@metadaoproject/futarchy/v0.6";
import * as token from "@solana/spl-token";
import { createLookupTableForTransaction } from "../utils/utils.js";

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = FutarchyClient.createClient({ provider });
const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

export const launch = async () => {
  // const mintKp = Keypair.generate();

  // const [launch] = getLaunchAddr(undefined, mintKp.publicKey);
  // const [launchSigner] = getLaunchSignerAddr(undefined, launch);

  // const EXMPL = await token.createMint(
  //   provider.connection,
  //   payer,
  //   launchSigner,
  //   null,
  //   6,
  //   mintKp
  // );

  // const launchIx = await launchpad.initializeLaunchIx({
  //   tokenName: "Example",
  //   tokenSymbol: "EXMPL",
  //   tokenUri: "https://example.com",
  //   minimumRaiseAmount: new BN(1 * 10 ** 6),
  //   baseMint: EXMPL,
  //   quoteMint: DEVNET_USDC,
  //   monthlySpendingLimitAmount: new BN(1 * 10 ** 5),
  //   monthlySpendingLimitMembers: SPENDING_MEMBERS,
  //   performancePackageGrantee: new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"),
  //   performancePackageTokenAmount: new BN(10 ** 5),
  //   monthsUntilInsidersCanUnlock: 18,
  //   secondsForLaunch: 10,
  // }).rpc();

  // await launchpad.startLaunchIx({ launch }).rpc();

  // await launchpad.fundIx({
  //   launch,
  //   amount: new BN(1 * 10 ** 6),
  //   funder: payer.publicKey,
  //   quoteMint: DEVNET_USDC,
  // }).rpc({ skipPreflight: true });

  // await new Promise(resolve => setTimeout(resolve, 10000));

  // await launchpad.closeLaunchIx({ launch }).rpc();

  const EXMPL = new PublicKey("6WE6hf9sf6irzMwcwp7zaVice7uvoQ8f7LRSrig9xa8q");
  const [launch] = getLaunchAddr(undefined, EXMPL);
  const [launchSigner] = getLaunchSignerAddr(undefined, launch);

  // const launch = new PublicKey("9Gcu82fLbrNkdycqNrPUzZ9zKcx6ETyvoyMYV8gPAEQ6");
  // const EXMPL = new PublicKey("")

  const tx = await launchpad
    .completeLaunchIx({
      launch,
      quoteMint: DEVNET_USDC,
      baseMint: EXMPL,
      finalRaiseAmount: null,
      launchAuthority: payer.publicKey,
      isDevnet: true,
    })
    .preInstructions([
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: launchSigner,
        lamports: 1e8,
      }),
    ])
    .transaction();

  const LUT = await createLookupTableForTransaction(tx, payer, provider);

  const blockhash = (await provider.connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message([LUT]);

  const vtx = new VersionedTransaction(message);
  vtx.sign([payer]);
  await provider.connection.sendTransaction(vtx, { skipPreflight: true });
  // const txHash = await provider.connection.sendRawTransaction(vtx.serialize());
  // await provider.connection.confirmTransaction(txHash, "confirmed");

  // console.log("Launch initialized", launchIx);
};

launch().catch(console.error);
