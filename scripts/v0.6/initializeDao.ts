import * as anchor from "@coral-xyz/anchor";
import { FutarchyClient, getDaoAddr, DEVNET_USDC, MAINNET_USDC, SQUADS_PROGRAM_CONFIG_TREASURY } from "@metadaoproject/futarchy/v0.6";
import { Keypair, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import { DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY } from "@metadaoproject/futarchy/v0.6";
import * as token from "@solana/spl-token";

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = FutarchyClient.createClient({ provider });

export const initializeDao = async () => {
  const META = await token.createMint(provider.connection, payer, payer.publicKey, null, 6)
  const USDC = await token.createMint(provider.connection, payer, payer.publicKey, null, 6)

  await token.createAssociatedTokenAccount(provider.connection, payer, META, payer.publicKey)
  await token.createAssociatedTokenAccount(provider.connection, payer, USDC, payer.publicKey)

  await token.mintTo(provider.connection, payer, META, token.getAssociatedTokenAddressSync(META, payer.publicKey), payer, 1_000_000 * 1_000_000)
  await token.mintTo(provider.connection, payer, USDC, token.getAssociatedTokenAddressSync(USDC, payer.publicKey), payer, 1_000_000 * 1_000_000)

  const nonce = new BN(Math.random() * 2 ** 50);

  await futarchy.initializeDaoIx({
    baseMint: META,
    quoteMint: USDC,
    squadsProgramConfigTreasury: DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY,
    params: {
      twapInitialObservation: new BN(0),
      twapMaxObservationChangePerUpdate: new BN(0),
      twapStartDelaySeconds: 60 * 60 * 24,
      minQuoteFutarchicLiquidity: new BN(0),
      minBaseFutarchicLiquidity: new BN(0),
      passThresholdBps: 0,
      nonce,
      initialSpendingLimit: null,
      baseToStake: new BN(0),
      secondsPerProposal: 60 * 60 * 24 * 3,
    }
  }).rpc();

  const [dao] = getDaoAddr({
    nonce,
    daoCreator: payer.publicKey,
  })

  await futarchy.provideLiquidityIx({
    dao,
    baseMint: META,
    quoteMint: USDC,
    quoteAmount: new BN(100 * 1_000_000),
    maxBaseAmount: new BN(100 * 1_000_000),
  }).rpc();


  console.log('DAO initialized:', dao.toString());
  console.log("META:", META.toString());
  console.log("USDC:", USDC.toString());

  await futarchy.spotSwapIx({
    dao,
    baseMint: META,
    quoteMint: USDC,
    swapType: "buy",
    inputAmount: new BN(1 * 1_000_000),
    minOutputAmount: new BN(900_000),
    trader: payer.publicKey,
  }).rpc();
};

initializeDao().catch(console.error);
