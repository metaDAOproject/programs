import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { AutocratClient, getDaoAddr, getMetadataAddr } from "@metadaoproject/futarchy/v0.5";
import { BN } from "bn.js";
import { USDC } from "./consts.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
// Use Umi to generate instructions, then convert to web3.js
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createV1, mplTokenMetadata, TokenStandard } from "@metaplex-foundation/mpl-token-metadata";
import { percentAmount, publicKey as UmiPublicKey } from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

// TOKEN DETAILS
const TOKEN_MINT = new PublicKey("METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta");
const TOKEN_SEED = 'j0MH5YqwvFHs2h9T';
const CLASSIC_TOKEN_MINT = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");

// DAO DETAILS
const SPENDING_MEMBERS = [
  new PublicKey("4LpE9Lxqb4jYYh8jA8oDhsGDKPNBNkcoXobbAJTa3pWw"), // Kollan
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];
const SPENDING_LIMIT = 85_000; // 1 USDC
const ONE_DAY_IN_SLOTS = new BN(216_000);
const THREE_DAYS_IN_SLOTS = ONE_DAY_IN_SLOTS.mul(new BN(3));

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocrat: AutocratClient = AutocratClient.createClient({ provider });

const initializeNewDaoAndToken = async () => {
  const seed = TOKEN_SEED;
  const TOKEN = await PublicKey.createWithSeed(
    payer.publicKey,
    seed,
    token.TOKEN_PROGRAM_ID
  );

  assert(TOKEN.toBase58() === TOKEN_MINT.toBase58(), "Token mint address mismatch");

  const lamports = await provider.connection.getMinimumBalanceForRentExemption(
    token.MINT_SIZE
  );

  const txn = new Transaction().add();

  // Mint the new token
  const createAndMintTokenTx = txn.add(
    SystemProgram.createAccountWithSeed({
      fromPubkey: payer.publicKey,
      newAccountPubkey: TOKEN,
      basePubkey: payer.publicKey,
      seed,
      lamports: lamports,
      space: token.MINT_SIZE,
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(TOKEN, 6, payer.publicKey, null) // TODO: Here we want to have it be the payer initially to 
  );

  
  // Get the classic token supply
  const classicTokenSupply = await provider.connection.getTokenAccountBalance(CLASSIC_TOKEN_MINT);
  const classicTokenSupplyAmount = classicTokenSupply.value.amount;
  console.log('Classic token supply:', classicTokenSupplyAmount.toString());

  const classicTokenSupplyAmountBN = new BN(classicTokenSupplyAmount.toString()).mul(new BN(1000)); // Multiply supply by 1000...

  // We want to mint the token amount we need to mint for use in the migration
  const mintTokenTx = token.createMintToInstruction(
    TOKEN,
    payer.publicKey,
    payer.publicKey,
    BigInt(classicTokenSupplyAmountBN.toString()), // TODO: Review this for maybe using number?
  );
  
  // Calculate current price of the token
  const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${CLASSIC_TOKEN_MINT.toBase58()}`);
  const data = await response.json();
  const price = data.data[CLASSIC_TOKEN_MINT.toBase58()].price;

  // TODO: We want the old token price to inform the new price...
  const convertedPrice = new BN(price).mul(new BN(10).pow(new BN(6)));

  console.log('Price:', price);

  // Setup the DAO params
  const twapInitialObservation = new BN(81810200000111810200000); // TODO: Review me...
  const twapMaxObservationChangePerUpdate = twapInitialObservation.div(new BN(20));
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
  
  const initializeDaoTx = await autocrat.initializeDaoIx({
    baseMint: TOKEN,
    params: {
      twapInitialObservation: twapInitialObservation,
      twapMaxObservationChangePerUpdate: twapMaxObservationChangePerUpdate,
      twapStartDelaySlots: twapStartDelaySlots,
      minBaseFutarchicLiquidity: new BN(30_000_000),
      minQuoteFutarchicLiquidity: new BN(15_000_000),
      passThresholdBps: 300, // 3%
      slotsPerProposal: THREE_DAYS_IN_SLOTS,
      initialSpendingLimit: {
        amountPerMonth: new BN(SPENDING_LIMIT),
        members: SPENDING_MEMBERS,
      },
      nonce: nonce,
    },
    quoteMint: USDC,
  }).transaction();

  // TODO: Transfer tokens to the migration contract?

  // Use Umi to generate metadata instructions, then convert to web3.js
  const umi = createUmi(provider.connection);
  umi.use(mplTokenMetadata());

  const umiMint = UmiPublicKey(TOKEN.toBase58());
  const umiUpdateAuthority = UmiPublicKey(squadsMultisigVault.toBase58()); // TODO: Confirm this.
  
  // Generate Umi instructions
  const umiInstructions = createV1(umi, {
    mint: umiMint,
    updateAuthority: umiUpdateAuthority,
    name: "Futarchy Governance Token Of MetaDAO", // TODO: Review this is correct.
    symbol: "META",
    uri: "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/META/META.json", // TODO: Review this is correct.
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: false,
    collectionDetails: null,
    decimals: 6,
    tokenStandard: TokenStandard.Fungible, // TODO: Review this is correct.
    isMutable: true, // TODO: Review this is correct.
  }).getInstructions();

  // Convert Umi instructions to web3.js instructions
  const metadataInstructions = umiInstructions.map(umiInstruction => 
    toWeb3JsInstruction(umiInstruction)
  );

  // We transfer authority to the Squads multisig
  const transferMintAuthorityTx = token.createSetAuthorityInstruction(TOKEN, payer.publicKey, token.AuthorityType.MintTokens, squadsMultisigVault);
  const revokeFreezeAuthorityTx = token.createSetAuthorityInstruction(TOKEN, payer.publicKey, token.AuthorityType.FreezeAccount, null);

  // Add all instructions to the transaction
  const tx = createAndMintTokenTx.add(initializeDaoTx, mintTokenTx, transferMintAuthorityTx, revokeFreezeAuthorityTx, ...metadataInstructions);

  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const simulation = await provider.connection.simulateTransaction(tx);
  console.log(simulation);

  return;

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

}

initializeNewDaoAndToken();