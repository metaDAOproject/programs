import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  CONDITIONAL_VAULT_PROGRAM_ID,
  FUTARCHY_PROGRAM_ID,
  FutarchyClient,
  LaunchpadClient,
  MAINNET_USDC,
  METADAO_MULTISIG_VAULT,
  MAINNET_METEORA_CONFIG as V0_6_MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy/v0.6";
import { PublicKey, TransactionMessage } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "bn.js";

const provider = anchor.AnchorProvider.env();

// Payer MUST be the non-Squads signer - tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ
const payer = provider.wallet["payer"];
const launchpad = LaunchpadClient.createClient({ provider });

const REFUND_RECIPIENT = new PublicKey(
  "AVWu68KKjThyjPf1BG9vumvjLrZt9KZrsADHBjFHbWAR",
);
const REFUND_AMOUNT = new BN(250_000 * 1_000_000);
const LAUNCH = new PublicKey("9kx7UDFzFt7e2V4pFtawnupKKvRR3EhV7P1Pxmc5XCQj");

const metadaoSquadsMultisig = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);

// Set the DAO address before running the script

export const returnFunds = async () => {
  console.log("Returning funds...");

  const launchSigner = launchpad.getLaunchSignerAddress({ launch: LAUNCH });

  const returnFundsIx = await launchpad.launchpad.methods
    .returnFunds({ amount: REFUND_AMOUNT })
    .accounts({
      launch: LAUNCH,
      recipient: REFUND_RECIPIENT,
      recipientQuoteAccount: getAssociatedTokenAddressSync(
        MAINNET_USDC,
        REFUND_RECIPIENT,
      ),
      launchQuoteVault: getAssociatedTokenAddressSync(
        MAINNET_USDC,
        launchSigner,
        true,
      ),
      launchSigner,
      admin: METADAO_MULTISIG_VAULT,
    })
    .instruction();

  const transactionMessage = new TransactionMessage({
    instructions: [returnFundsIx],
    payerKey: METADAO_MULTISIG_VAULT,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
  });

  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      metadaoSquadsMultisig,
    );

  // Create vault transaction
  const vaultTxCreateSignature = await multisig.rpc.vaultTransactionCreate({
    connection: provider.connection,
    creator: payer.publicKey,
    feePayer: payer,
    ephemeralSigners: 0,
    multisigPda: metadaoSquadsMultisig,
    transactionIndex:
      BigInt(metaDaoSquadsMultisigAccount.transactionIndex.toString()) + 1n,
    vaultIndex: 0,
    transactionMessage,
  });

  console.log(
    "Created multisig transaction to return funds",
    vaultTxCreateSignature,
  );
};

returnFunds().catch(console.error);
