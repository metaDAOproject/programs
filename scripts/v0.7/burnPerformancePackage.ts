import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
  PriceBasedPerformancePackageClient,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/futarchy";
import { PublicKey, TransactionMessage } from "@solana/web3.js";

// Set the performance package address before running the script
const performancePackage = new PublicKey("");

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

// This should only be run once per DAO/AMM
// It's meant to be a one-off operation that reduces liquidity to a target K (the inital pool's liquidity) and collect it as "fees"
// We're using this because we didn't track LP fee collection in the pool state, nor did we exclude those fees from liquidity
export const burnPerformancePackage = async () => {
  const performancePackageAccount =
    await priceBasedPerformancePackage.getPerformancePackage(
      performancePackage,
    );

  // We call the collect fees instruction from Metadao DAO's multisig account
  // It's the only one that can call the collect fees instruction
  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      anchor.getProvider().connection,
      metadaoSquadsMultisig,
    );

  // Prepare transaction message
  const burnPerformancePackageIx =
    await priceBasedPerformancePackage.program.methods
      .burnPerformancePackage()
      .accounts({
        performancePackage,
        performancePackageTokenVault:
          performancePackageAccount.performancePackageTokenVault,
        tokenMint: performancePackageAccount.tokenMint,
        admin: metadaoSquadsMultisigVault,
        spillAccount: payer.publicKey,
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
