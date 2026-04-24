// @ts-nocheck
// Legacy script
import * as anchor from "@coral-xyz/anchor";
import { AutocratClient, getDaoAddr } from "@metadaoproject/futarchy/v0.6";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import * as token from "@solana/spl-token";
import { SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET } from "../sdk/src/v0.6/constants.js";

// Constants from test utils
const TEN_SECONDS_IN_SLOTS = 25n;
const ONE_MINUTE_IN_SLOTS = TEN_SECONDS_IN_SLOTS * 6n;

async function main() {
  const provider = anchor.AnchorProvider.env();
  const autocratClient = AutocratClient.createClient({ provider });
  const payer = provider.wallet["payer"];

  console.log("Setting up Futarchy AMM...");
  console.log("Payer:", payer.publicKey.toString());

  // Step 1: Create META token mint (9 decimals)
  console.log("\n1. Creating META token mint...");
  const META = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey, // mint authority
    payer.publicKey, // freeze authority
    9, // 9 decimals like in tests
  );
  console.log("Created META mint:", META.toString());

  // Step 2: Create USDC token mint (6 decimals)
  console.log("\n2. Creating USDC token mint...");
  const USDC = await token.createMint(
    provider.connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    6, // 6 decimals for USDC
  );
  console.log("Created USDC mint:", USDC.toString());

  // Step 3: Create token accounts for the payer
  console.log("\n3. Creating token accounts...");
  await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    payer.publicKey,
  );
  console.log("Created META account for payer");

  await token.createAssociatedTokenAccount(
    provider.connection,
    payer,
    USDC,
    payer.publicKey,
  );
  console.log("Created USDC account for payer");

  // Step 4: Mint initial tokens to the payer
  console.log("\n4. Minting initial tokens...");
  await token.mintTo(
    provider.connection,
    payer,
    META,
    token.getAssociatedTokenAddressSync(META, payer.publicKey),
    payer,
    1000_00_00000n * 10n ** 9n, // Same amount as in test
  );
  console.log("Minted META tokens to payer");

  await token.mintTo(
    provider.connection,
    payer,
    USDC,
    token.getAssociatedTokenAddressSync(USDC, payer.publicKey),
    payer,
    1_000_000_000n * 1_000_000n, // Same amount as in test
  );
  console.log("Minted USDC tokens to payer");

  // Step 5: Initialize the DAO
  console.log("\n5. Initializing DAO...");
  const nonce = new BN(Math.random() * 2 ** 50);

  const [dao] = getDaoAddr({
    nonce,
    daoCreator: payer.publicKey,
  });

  await autocratClient
    .initializeDaoIx({
      baseMint: META,
      quoteMint: USDC,
      params: {
        nonce,
        twapStartDelaySlots: new BN(0),
        twapInitialObservation: new BN(0),
        twapMaxObservationChangePerUpdate: new BN("1000000000000000000"),
        minQuoteFutarchicLiquidity: new BN(0),
        slotsPerProposal: new BN((ONE_MINUTE_IN_SLOTS * 60n * 24n).toString()),
        passThresholdBps: 300,
        minBaseFutarchicLiquidity: new BN(0),
        initialSpendingLimit: null,
      },
      squadsProgramConfigTreasury: SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET,
    })
    .rpc();

  console.log("DAO initialized:", dao.toString());

  // Step 6: Initialize Futarchy AMM
  console.log("\n6. Initializing Futarchy AMM...");
  const [futarchyAmm] = PublicKey.findProgramAddressSync(
    [Buffer.from("futarchy_amm")],
    autocratClient.getProgramId(),
  );

  await autocratClient.autocrat.methods
    .initializeFutarchyAmm()
    .accounts({
      futarchyAmm,
      createKey: payer.publicKey,
      payer: payer.publicKey,
      dao,
      baseMint: META,
      quoteMint: USDC,
      ammBaseVault: token.getAssociatedTokenAddressSync(
        META,
        futarchyAmm,
        true,
      ),
      ammQuoteVault: token.getAssociatedTokenAddressSync(
        USDC,
        futarchyAmm,
        true,
      ),
    })
    .rpc();

  console.log("Futarchy AMM initialized:", futarchyAmm.toString());

  // Step 7: Provide liquidity to the AMM
  console.log("\n7. Providing liquidity to AMM...");
  const [ammPosition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("amm_position"),
      futarchyAmm.toBuffer(),
      payer.publicKey.toBuffer(),
    ],
    autocratClient.getProgramId(),
  );

  await autocratClient.autocrat.methods
    .provideLiquidity({
      quoteAmount: new BN(100_000 * 1_000_000), // 100,000 USDC
      maxBaseAmount: new BN(100_000 * 1_000_000), // 100,000 META equivalent
      minLiquidity: new BN(0),
    })
    .accounts({
      futarchyAmm,
      payer: payer.publicKey,
      ammBaseVault: token.getAssociatedTokenAddressSync(
        META,
        futarchyAmm,
        true,
      ),
      ammQuoteVault: token.getAssociatedTokenAddressSync(
        USDC,
        futarchyAmm,
        true,
      ),
      liquidityProvider: payer.publicKey,
      liquidityProviderBaseAccount: token.getAssociatedTokenAddressSync(
        META,
        payer.publicKey,
      ),
      liquidityProviderQuoteAccount: token.getAssociatedTokenAddressSync(
        USDC,
        payer.publicKey,
      ),
      ammPosition,
    })
    .rpc();

  console.log("Liquidity provided to AMM");

  // Step 8: Fetch and display results
  console.log("\n8. Fetching results...");
  const storedAmmPosition =
    await autocratClient.autocrat.account.ammPosition.fetch(ammPosition);
  console.log(
    "AMM Position liquidity:",
    storedAmmPosition.liquidity.toString(),
  );

  const futarchyAmmData =
    await autocratClient.autocrat.account.futarchyAmm.fetch(futarchyAmm);
  console.log(
    "Total AMM liquidity:",
    futarchyAmmData.totalLiquidity.toString(),
  );
  console.log(
    "Spot reserves - Base:",
    futarchyAmmData.state.spot.spot.baseReserves.toString(),
    "Quote:",
    futarchyAmmData.state.spot.spot.quoteReserves.toString(),
  );

  const storedDao = await autocratClient.getDao(dao);
  console.log("DAO data fetched successfully");

  console.log("\n✅ Futarchy AMM setup complete!");
  console.log("Summary:");
  console.log("- META Token:", META.toString());
  console.log("- USDC Token:", USDC.toString());
  console.log("- DAO:", dao.toString());
  console.log("- Futarchy AMM:", futarchyAmm.toString());
  console.log("- AMM Position:", ammPosition.toString());
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
