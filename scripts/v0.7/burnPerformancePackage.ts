import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  PriceBasedPerformancePackageClient,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/programs";
import { PublicKey, TransactionMessage } from "@solana/web3.js";

// Set the performance package address before running the script
const performancePackage = new PublicKey("");
// Set both when the package's quote ATA exists (it does once the recipient has
// sold): its balance is swept into `quoteDestination` and the ATA is closed
const quoteMint: PublicKey | undefined = undefined;
const quoteDestination: PublicKey | undefined = undefined;

const provider = anchor.AnchorProvider.env();

// Payer MUST be a signer with permissions to propose transactions on Metadao DAO's multisig
const payer = provider.wallet["payer"];

const priceBasedPerformancePackage: PriceBasedPerformancePackageClient =
  new PriceBasedPerformancePackageClient(
    provider,
    PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  );

// We need both the multisig and vault addresses for the Metadao DAO
const metadaoSquadsMultisig = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);
const metadaoSquadsMultisigVault = METADAO_MULTISIG_VAULT;

// Retires a performance package: the recipient is paid what is already unlocked,
// the locked remainder is burned, and the package with its token accounts is closed
export const burnPerformancePackage = async () => {
  const performancePackageAccount =
    await priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );

  // Only Metadao DAO's multisig vault may burn a package
  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      anchor.getProvider().connection,
      metadaoSquadsMultisig,
    );

  // Prepare transaction message. The recipient's token account is created if
  // it is missing, paid by the vault; rent from the closed accounts goes to the payer.
  const burnPerformancePackageIx = await priceBasedPerformancePackage
    .burnPerformancePackageIx({
      performancePackage,
      tokenMint: performancePackageAccount.tokenMint,
      recipient: performancePackageAccount.recipient,
      admin: metadaoSquadsMultisigVault,
      spillAccount: payer.publicKey,
      quoteMint,
      quoteDestination,
    })
    .instruction();

  const transactionMessage = new TransactionMessage({
    instructions: [burnPerformancePackageIx],
    payerKey: metadaoSquadsMultisigVault,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
  });

  // Create vault transaction
  const vaultTxCreateSignature = await multisig.rpc.vaultTransactionCreate({
    connection: anchor.getProvider().connection,
    creator: payer.publicKey,
    feePayer: payer.publicKey,
    ephemeralSigners: 0,
    multisigPda: metadaoSquadsMultisig,
    transactionIndex:
      BigInt(metaDaoSquadsMultisigAccount.transactionIndex.toString()) + 1n,
    vaultIndex: 0,
    transactionMessage,
  });

  console.log(
    "Vault burn performance package transaction create signature:",
    vaultTxCreateSignature,
  );
  console.log("Go ahead and execute the transaction through Squads.");
};

burnPerformancePackage().catch(console.error);
