import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
} from "@solana/web3.js";
import {
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import {
  AutocratClient,
  getDaoAddr,
  getMetadataAddr,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  MAINNET_USDC,
  DEVNET_USDC,
  USDC_DECIMALS,
} from "@metadaoproject/futarchy/v0.5";
import { BN } from "bn.js";
import { assert } from "chai";
import * as multisig from "@sqds/multisig";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createV1,
  mplTokenMetadata,
  TokenStandard,
  updateMetadataAccountV2,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  percentAmount,
  signerIdentity,
  publicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";

// Testing flag set to true to run it with seed.
const MINT_FROM_SEED: boolean = true;

// TOKEN DETAILS
let TOKEN_MINT: PublicKey | null = new PublicKey(
  "METAwkXcqyXKy1AtsSgJ8JiUHwGCafnZL38n3vYmeta",
);
const TOKEN_SEED: string = "j0MH5YqwvFHs2h9T";
const NEW_TOKEN_DECIMALS: number = 6;
const CLASSIC_TOKEN_MINT: PublicKey = new PublicKey(
  "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr",
);
const CLASSIC_TOKEN_DECIMALS: number = 9;

// DAO DETAILS
const SPENDING_MEMBERS: PublicKey[] = [
  new PublicKey("4LpE9Lxqb4jYYh8jA8oDhsGDKPNBNkcoXobbAJTa3pWw"), // Kollan
  new PublicKey("613BRiXuAEn7vibs2oAYzpGW9fXgjzDNuFMM4wPzLdY"), // Proph3t
];
const SPENDING_LIMIT: number = 100_000; // NOTE: Human readable
const MIN_BASE_FUTARCHIC_LIQUIDITY: number = 30_000; // NOTE: Human readable
const MIN_QUOTE_FUTARCHIC_LIQUIDITY: number = 25_000; // NOTE: Human readable

const ONE_DAY_IN_SLOTS = new BN(216_000);
const THREE_DAYS_IN_SLOTS = ONE_DAY_IN_SLOTS.mul(new BN(3));
const PASS_THRESHOLD_BPS: number = 150; // 1.5%

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const autocrat: AutocratClient = AutocratClient.createClient({ provider });

const mintNewToken = async () => {
  if (provider.connection.rpcEndpoint.includes("devnet")) {
    console.log("Using devnet params");
  } else {
    console.log(
      "Using mainnet params.. MAKE SURE YOU WANT TO DO THIS... Sleeping for 10 seconds",
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  const tokenDecimalDiff = CLASSIC_TOKEN_DECIMALS - NEW_TOKEN_DECIMALS;

  const classicTokenSupply =
    await provider.connection.getTokenSupply(CLASSIC_TOKEN_MINT);
  const classicTokenSupplyAmount = classicTokenSupply.value.amount;

  const classicTokenSupplyAmountBN = new BN(
    classicTokenSupplyAmount.toString(),
  );

  assert(classicTokenSupplyAmountBN.gt(new BN(0)), "Classic token supply is 0");

  let newTokenSupplyAmount = new BN(0);
  let TOKEN_KEYPAIR: Keypair | null = null;
  try {
    if (TOKEN_MINT) {
      const newTokenSupply =
        await provider.connection.getTokenSupply(TOKEN_MINT);
      newTokenSupplyAmount = new BN(newTokenSupply.value.amount.toString());
      console.log(
        "New token already exsits. You may need to mint more or change something.",
      );
      console.log(
        "New token supply (human readable):",
        newTokenSupplyAmount
          .div(new BN(10).pow(new BN(NEW_TOKEN_DECIMALS)))
          .toString(),
      );

      assert(
        newTokenSupplyAmount.eq(classicTokenSupplyAmountBN),
        "New token supply is not equal to 1:1000 ratio of classic token supply",
      );
      return TOKEN_MINT;
    }
  } catch (error) {
    console.log(error);
  }
  console.log("New token doesn't exist we'll create it.");
  const ixs = [];

  let TOKEN = TOKEN_MINT;

  if (!newTokenSupplyAmount.gt(new BN(0))) {
    const lamports =
      await provider.connection.getMinimumBalanceForRentExemption(MINT_SIZE);

    if (MINT_FROM_SEED) {
      console.log("Minting from seed..");
      const seed = TOKEN_SEED;
      TOKEN = await PublicKey.createWithSeed(
        payer.publicKey,
        seed,
        TOKEN_PROGRAM_ID,
      );

      assert(
        TOKEN.toBase58() === TOKEN_MINT.toBase58(),
        "Token mint address mismatch",
      );

      // Mint the new token
      const createTokenIx = SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        newAccountPubkey: TOKEN,
        basePubkey: payer.publicKey,
        seed,
        lamports: lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      });

      ixs.push(createTokenIx);
    } else {
      // This gets overriden if we're minting from seed.
      TOKEN_KEYPAIR = Keypair.generate();
      TOKEN = TOKEN_KEYPAIR.publicKey;
      console.log("Minting from keypair..");
      console.log("Token keypair:", TOKEN_KEYPAIR.publicKey.toBase58());
      console.log("Token:", TOKEN.toBase58());
      const createTokenIx = SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: TOKEN,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
        lamports: lamports,
      });
      ixs.push(createTokenIx);
    }

    const initializeMintIx = createInitializeMint2Instruction(
      TOKEN,
      NEW_TOKEN_DECIMALS,
      payer.publicKey,
      null,
    );
    const associatedTokenAccount = getAssociatedTokenAddressSync(
      TOKEN,
      payer.publicKey,
      true,
    );
    const createAtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedTokenAccount,
      payer.publicKey,
      TOKEN,
    );

    ixs.push(initializeMintIx);
    ixs.push(createAtaIx);

    const classicTokenSupplyHuman = classicTokenSupplyAmountBN.div(
      new BN(10).pow(new BN(CLASSIC_TOKEN_DECIMALS)),
    );
    const newTokenSupplyHuman = classicTokenSupplyAmountBN.div(
      new BN(10).pow(new BN(NEW_TOKEN_DECIMALS)),
    );

    console.log("Old token supply:", classicTokenSupplyHuman.toString());
    console.log("New token supply:", newTokenSupplyHuman.toString());

    // TODO: Review the assertation I'm just confirming that the 1:1000 ratio is correct.
    assert(
      classicTokenSupplyAmountBN
        .div(new BN(10).pow(new BN(CLASSIC_TOKEN_DECIMALS)))
        .mul(new BN(10).pow(new BN(tokenDecimalDiff)))
        .eq(
          classicTokenSupplyAmountBN.div(
            new BN(10).pow(new BN(NEW_TOKEN_DECIMALS)),
          ),
        ),
      "New token supply is not equal to 1:1000 ratio of classic token supply",
    );

    const mintSupplyIx = createMintToInstruction(
      TOKEN,
      associatedTokenAccount,
      payer.publicKey,
      BigInt(classicTokenSupplyAmountBN.toString()),
    );

    ixs.push(mintSupplyIx);

    const { blockhash } = await provider.connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    // Create a VersionedTransaction
    const versionedTx = new VersionedTransaction(message);
    if (TOKEN_KEYPAIR) {
      versionedTx.sign([payer, TOKEN_KEYPAIR]);
    } else {
      versionedTx.sign([payer]);
    }

    const simulation =
      await provider.connection.simulateTransaction(versionedTx);
    console.log("Simulation complete");
    console.log(simulation);

    console.log("About to send transaction... Sleeping for 10 seconds");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const txHash = await provider.connection.sendRawTransaction(
      versionedTx.serialize(),
    );
    await provider.connection.confirmTransaction(txHash, "confirmed");

    const newTokenSupply = await provider.connection.getTokenSupply(TOKEN);
    console.log("New token supply:", newTokenSupply.value.amount.toString());
    console.log(
      "New token supply (human readable):",
      new BN(newTokenSupply.value.amount.toString())
        .div(new BN(10).pow(new BN(NEW_TOKEN_DECIMALS)))
        .toString(),
    );
  }
  return TOKEN;
};

const initializeNewDaoAndToken = async () => {
  const TOKEN = await mintNewToken();

  let USDC = MAINNET_USDC;
  let squadsProgramConfigTreasury = SQUADS_PROGRAM_CONFIG_TREASURY;
  if (provider.connection.rpcEndpoint.includes("devnet")) {
    console.log("Using devnet params");
    USDC = DEVNET_USDC;
    squadsProgramConfigTreasury = new PublicKey(
      "HM5y4mz3Bt9JY9mr1hkyhnvqxSH4H2u2451j7Hc2dtvK",
    ); // NOTE: THIS IS FOR DEVNET ONLY
  } else {
    console.log("Using mainnet params..");
  }

  // Calculate current price of the token
  const response = await fetch(
    `https://lite-api.jup.ag/price/v3?ids=${CLASSIC_TOKEN_MINT.toBase58()}`,
  );
  const data = await response.json();

  const price = data[CLASSIC_TOKEN_MINT.toBase58()].usdPrice;

  // We'll use the old token price to inform the new price for starting twap observations...
  const newTokenConvertedPrice = new BN(price).mul(new BN(10).pow(new BN(9))); // This gets us to the 10^9 scale for the twap observation

  console.log("USDC Price:", price);
  console.log("TWAP started price:", newTokenConvertedPrice.toString());

  // Setup the DAO params
  const twapInitialObservation = newTokenConvertedPrice;
  const twapMaxObservationChangePerUpdate = twapInitialObservation.div(
    new BN(20),
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

  const ixs = [];
  const initializeDaoIx = await autocrat
    .initializeDaoIx({
      baseMint: TOKEN,
      params: {
        twapInitialObservation: twapInitialObservation,
        twapMaxObservationChangePerUpdate: twapMaxObservationChangePerUpdate,
        twapStartDelaySlots: twapStartDelaySlots,
        minBaseFutarchicLiquidity: new BN(MIN_BASE_FUTARCHIC_LIQUIDITY).mul(
          new BN(10).pow(new BN(NEW_TOKEN_DECIMALS)),
        ),
        minQuoteFutarchicLiquidity: new BN(MIN_QUOTE_FUTARCHIC_LIQUIDITY).mul(
          new BN(10).pow(new BN(USDC_DECIMALS)),
        ),
        passThresholdBps: PASS_THRESHOLD_BPS,
        slotsPerProposal: THREE_DAYS_IN_SLOTS,
        initialSpendingLimit: {
          amountPerMonth: new BN(SPENDING_LIMIT).mul(
            new BN(10).pow(new BN(USDC_DECIMALS)),
          ),
          members: SPENDING_MEMBERS,
        },
        nonce: nonce,
      },
      quoteMint: USDC,
      squadsProgramConfigTreasury: squadsProgramConfigTreasury,
    })
    .instruction();

  ixs.push(initializeDaoIx);

  const umi = createUmi(provider.connection);
  umi.use(mplTokenMetadata());
  umi.use(signerIdentity(payer.publicKey));

  const umiMint = UmiPublicKey(TOKEN.toBase58());
  const umiUpdateAuthority = UmiPublicKey(squadsMultisigVault.toBase58()); // TODO: Confirm this.

  // Generate Umi instructions
  const umiInstructions = createV1(umi, {
    mint: umiMint,
    updateAuthority: payer.publicKey,
    name: "MetaDAO", // TODO: Review this is correct.
    symbol: "META", // TODO: Review this is correct.
    uri: "https://raw.githubusercontent.com/metaDAOproject/futarchy/refs/heads/develop/scripts/assets/META/META.json",
    sellerFeeBasisPoints: percentAmount(0),
    creators: null,
    isCollection: false,
    collectionDetails: null,
    // masterEdition: null,
    decimals: 6,
    tokenStandard: TokenStandard.Fungible,
    isMutable: true, // TODO: Review this is correct.
    payer: payer.publicKey,
  }).getInstructions();

  const asset = getMetadataAddr(TOKEN);

  const umiUpdateInstructions = updateMetadataAccountV2(umi, {
    newUpdateAuthority: umiUpdateAuthority,
    metadata: UmiPublicKey(asset[0].toBase58()),
  }).getInstructions();

  // Convert Umi instructions to web3.js instructions
  const metadataInstructions = umiInstructions.map((umiInstruction) =>
    toWeb3JsInstruction(umiInstruction),
  );
  const updateMetadataInstructions = umiUpdateInstructions.map(
    (umiInstruction) => toWeb3JsInstruction(umiInstruction),
  );

  ixs.push(...metadataInstructions);
  ixs.push(...updateMetadataInstructions);

  try {
    // We transfer authority to the Squads multisig
    const transferMintAuthorityTx = createSetAuthorityInstruction(
      TOKEN,
      payer.publicKey,
      AuthorityType.MintTokens,
      squadsMultisigVault,
    );
    // const revokeFreezeAuthorityTx = token.createSetAuthorityInstruction(TOKEN, payer.publicKey, token.AuthorityType.FreezeAccount, null);

    ixs.push(transferMintAuthorityTx);
    // txns.push(revokeFreezeAuthorityTx);

    // Get the latest blockhash
    const { blockhash } = await provider.connection.getLatestBlockhash();

    // Create a TransactionMessage
    const message = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    // Create a VersionedTransaction
    const versionedTx = new VersionedTransaction(message);
    versionedTx.sign([payer]);

    // Try simulation with the versioned transaction
    const simulation =
      await provider.connection.simulateTransaction(versionedTx);
    console.log("Simulation complete");
    console.log(simulation);

    console.log("About to send transaction... Sleeping for 10 seconds");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const txHash = await provider.connection.sendRawTransaction(
      versionedTx.serialize(),
    );
    console.log("Transaction hash:", txHash);
    await provider.connection.confirmTransaction(txHash, "confirmed");
  } catch (error) {
    console.error(error);
  }
};

initializeNewDaoAndToken();
