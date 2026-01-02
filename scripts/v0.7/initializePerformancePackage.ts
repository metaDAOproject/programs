import * as anchor from "@coral-xyz/anchor";
import {
  LaunchpadClient,
  getLaunchAddr,
  getDaoAddr,
} from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

const initializePerformancePackage = async () => {
  const BASE_MINT = new PublicKey(
    "7EJRXkBfoAYtzAXE7PRry4gqh6NciY3Yt5YF3GR8LC8V",
  );

  const [launch] = getLaunchAddr(undefined, BASE_MINT);
  console.log("Launch address:", launch.toString());

  // Fetch the launch account
  const launchAccount = await launchpad.fetchLaunch(launch);
  console.log("\n=== Launch Account ===");
  console.log("State:", JSON.stringify(launchAccount.state));
  console.log("DAO stored on launch:", launchAccount.dao?.toString() ?? "None");
  console.log("DAO vault:", launchAccount.daoVault?.toString() ?? "None");
  console.log(
    "Performance package initialized:",
    launchAccount.isPerformancePackageInitialized,
  );
  console.log(
    "Performance package token amount:",
    launchAccount.performancePackageTokenAmount.toString(),
  );
  console.log(
    "Performance package grantee:",
    launchAccount.performancePackageGrantee?.toString() ?? "None",
  );

  // Get the launch signer
  const launchSigner = launchpad.getLaunchSignerAddress({ launch });
  console.log("\n=== Derived Addresses ===");
  console.log("Launch signer:", launchSigner.toString());

  // Derive what the client thinks the DAO should be
  const [derivedDao] = getDaoAddr({
    nonce: new BN(0),
    daoCreator: launchSigner,
  });
  console.log(
    "Derived DAO (nonce=0, creator=launchSigner):",
    derivedDao.toString(),
  );

  // Compare
  console.log("\n=== Comparison ===");
  console.log("Stored DAO:", launchAccount.dao?.toString() ?? "None");
  console.log("Derived DAO:", derivedDao.toString());
  console.log(
    "Match:",
    launchAccount.dao?.toString() === derivedDao.toString(),
  );

  if (launchAccount.dao?.toString() !== derivedDao.toString()) {
    console.log(
      "\n⚠️  DAO MISMATCH - The client will fail because it derives a different DAO",
    );
    console.log(
      "The stored DAO on the launch doesn't match what the client derives.",
    );
    console.log(
      "You may need to manually construct the instruction with the correct DAO.",
    );
  }

  if (launchAccount.isPerformancePackageInitialized) {
    console.log("\n✓ Performance package already initialized, nothing to do.");
    return;
  }

  if (!launchAccount.dao) {
    console.log(
      "\n✗ No DAO set on launch - cannot initialize performance package.",
    );
    return;
  }

  console.log("\n=== Attempting to initialize performance package ===");

  try {
    const txHash = await launchpad
      .initializePerformancePackageIx({
        launch,
        baseMint: BASE_MINT,
        payer: payer.publicKey,
      })
      .rpc();

    console.log("Transaction sent:", txHash);
    console.log("Performance package initialized successfully!");
  } catch (error) {
    console.error("\nError:", error);
  }
};

initializePerformancePackage().catch(console.error);
