import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  getDaoAddr,
  DEVNET_USDC,
  MAINNET_USDC,
  SQUADS_PROGRAM_CONFIG_TREASURY,
} from "@metadaoproject/futarchy/v0.5";
import {
  Keypair,
  PublicKey,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import { DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY } from "../../sdk/src/v0.5/constants.js";
import * as token from "@solana/spl-token";

const EXISTING_TOKEN = new PublicKey(
  "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr"
);
const ONE_DAY_IN_SLOTS = new BN(216_000);
const THREE_DAYS_IN_SLOTS = ONE_DAY_IN_SLOTS.mul(new BN(3));
const NEW_TOKEN = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta");

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("4LpE9Lxqb4jYYh8jA8oDhsGDKPNBNkcoXobbAJTa3pWw"), // Kollan
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];
const SPENDING_LIMIT = 85_000; // 85_000 USDC HUMAN READABLE
const MIN_QUOTE_FUTARCHIC_LIQUIDITY = 101_000_000; // NOTE: CHANGE ME TO 15k USDC 15_000_000
const MIN_BASE_FUTARCHIC_LIQUIDITY = 5_000_000; // NOTE: CHANGE ME TO 5k META 5_000_000_000
const PASS_THRESHOLD_BPS = 150; // 1.5%

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocrat: AutocratClient = AutocratClient.createClient({ provider });

export const initializeToken = async () => {
  // const TOKEN_KEYPAIR = Keypair.generate();

  // const TOKEN = await token.createMint(
  //   provider.connection,
  //   payer,
  //   payer.publicKey,
  //   null,
  //   6,
  //   TOKEN_KEYPAIR,
  //   {
  //     // Let's be 100% sure the mint is created
  //     commitment: "finalized",
  //   }
  // );

  // console.log('Token:', TOKEN.toBase58());

  // const payerTokenAccount = await token.createAssociatedTokenAccount(
  //   provider.connection,
  //   payer,
  //   TOKEN,
  //   payer.publicKey
  // );

  // console.log('New token account:', payerTokenAccount.toBase58());
  const TOKEN = new PublicKey("E9bijxx47tYsiURi7CCd2nLsa2122TmGbeFKpmjP2Nxu");
  const mintToNewTokens = await token.mintTo(
    provider.connection,
    payer,
    TOKEN,
    token.getAssociatedTokenAddressSync(TOKEN, payer.publicKey, true),
    payer,
    19_999_980 * 10 ** 6 // 20M new tokens
  );

  console.log("Minted 20M new tokens to payer", mintToNewTokens.toString());
};

export const initializeDao = async () => {
  const TOKEN = new PublicKey("E9bijxx47tYsiURi7CCd2nLsa2122TmGbeFKpmjP2Nxu");

  let QUOTE_MINT: PublicKey = MAINNET_USDC;
  let _SQUADS_PROGRAM_CONFIG_TREASURY: PublicKey =
    SQUADS_PROGRAM_CONFIG_TREASURY;

  if (provider.connection.rpcEndpoint.includes("devnet")) {
    console.log("Using devnet USDC");
    QUOTE_MINT = DEVNET_USDC;
    _SQUADS_PROGRAM_CONFIG_TREASURY = DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY; // NOTE: THIS IS FOR DEVNET ONLY
  }

  const txns = [];
  // Calculate current price of the token
  const response = await fetch(
    `https://lite-api.jup.ag/price/v3?ids=${EXISTING_TOKEN.toBase58()}`
  );
  const data = await response.json();

  const price = data[EXISTING_TOKEN.toBase58()].usdPrice;

  // TODO: We want the old token price to inform the new price...
  const newTokenConvertedPrice = new BN(price).mul(new BN(10).pow(new BN(9))); // This gets us to the 10^9 scale for our new token

  console.log("Price:", price);
  console.log("Converted price:", newTokenConvertedPrice.toString());

  // Setup the DAO params
  const twapInitialObservation = newTokenConvertedPrice; // TODO: Review me...
  const twapMaxObservationChangePerUpdate = twapInitialObservation.div(
    new BN(20)
  );
  const twapStartDelaySlots = ONE_DAY_IN_SLOTS;

  const nonce = new BN(Math.random() * 2 ** 50);

  // Create the DAO
  const [dao] = getDaoAddr({
    nonce: nonce,
    daoCreator: payer.publicKey,
  });
  const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
  const squadsMultisigVault = multisig.getVaultPda({
    multisigPda,
    index: 0,
  })[0];
  const spendingLimit = multisig.getSpendingLimitPda({
    multisigPda,
    createKey: dao,
  })[0];

  console.log("DAO:", dao.toBase58());
  console.log("Multisig PDA:", multisigPda.toBase58());
  console.log("Squads multisig vault:", squadsMultisigVault.toBase58());
  console.log("Spending limit:", spendingLimit.toBase58());

  const initializeDaoIx = await autocrat
    .initializeDaoIx({
      baseMint: TOKEN,
      params: {
        twapInitialObservation: twapInitialObservation,
        twapMaxObservationChangePerUpdate: twapMaxObservationChangePerUpdate,
        twapStartDelaySlots: twapStartDelaySlots,
        minBaseFutarchicLiquidity: new BN(MIN_BASE_FUTARCHIC_LIQUIDITY), // 5k META
        minQuoteFutarchicLiquidity: new BN(MIN_QUOTE_FUTARCHIC_LIQUIDITY), // 15k USDC
        passThresholdBps: PASS_THRESHOLD_BPS,
        slotsPerProposal: THREE_DAYS_IN_SLOTS,
        initialSpendingLimit: {
          amountPerMonth: new BN(SPENDING_LIMIT).mul(new BN(10).pow(new BN(6))), // 85_000 USDC
          members: SPENDING_MEMBERS,
        },
        nonce: nonce,
      },
      quoteMint: QUOTE_MINT,
      squadsProgramConfigTreasury: _SQUADS_PROGRAM_CONFIG_TREASURY,
    })
    .instruction();

  txns.push(initializeDaoIx);

  // Get the latest blockhash
  const { blockhash } = await provider.connection.getLatestBlockhash();
  console.log("Blockhash:", blockhash);

  // Create a TransactionMessage
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: txns,
  }).compileToV0Message();

  console.log("Transaction message compiled successfully");

  // Create a VersionedTransaction
  const versionedTx = new VersionedTransaction(message);
  versionedTx.sign([payer]);
  console.log("Versioned transaction signed");

  console.log("About to simulate transaction...");

  // Try simulation with the versioned transaction
  const simulation = await provider.connection.simulateTransaction(versionedTx);
  console.log(simulation);

  const txHash = await provider.connection.sendRawTransaction(
    versionedTx.serialize()
  );
  await provider.connection.confirmTransaction(txHash, "confirmed");
};

initializeDao().catch(console.error);
