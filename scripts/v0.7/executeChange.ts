import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PriceBasedPerformancePackageClient } from "@metadaoproject/programs/price_based_performance_package";
import { PublicKey } from "@solana/web3.js";

// Set the change request to execute before running the script
const CHANGE_REQUEST = new PublicKey("");

const provider = anchor.AnchorProvider.env();

// The wallet must be the package's recipient for a change the authority
// proposed, and the authority for a change the recipient proposed
const executor = provider.wallet["payer"];

const priceBasedPerformancePackage =
  PriceBasedPerformancePackageClient.createClient({ provider });

// Prints BN fields as decimal strings instead of hex
const decimalBns = (_key: string, value: unknown) =>
  BN.isBN(value) ? value.toString() : value;

const executeChange = async () => {
  const changeRequest =
    await priceBasedPerformancePackage.getChangeRequest(CHANGE_REQUEST);

  console.log("Change request:", CHANGE_REQUEST.toBase58());
  console.log(
    "Performance package:",
    changeRequest.performancePackage.toBase58(),
  );
  console.log(
    "Proposed at:",
    new Date(changeRequest.proposedAt.toNumber() * 1_000).toISOString(),
  );
  console.log("Change:", JSON.stringify(changeRequest.changeType, decimalBns));
  console.log("Executor:", executor.publicKey.toBase58());

  const signature = await priceBasedPerformancePackage
    .executeChangeIx({
      performancePackage: changeRequest.performancePackage,
      changeRequest: CHANGE_REQUEST,
      executor: executor.publicKey,
    })
    .rpc();

  console.log("Execute change transaction sent:", signature);
};

executeChange().catch(console.error);
