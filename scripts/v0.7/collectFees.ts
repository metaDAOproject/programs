import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import {
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  FUTARCHY_V0_6_PROGRAM_ID,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/programs";
import { PublicKey, TransactionMessage } from "@solana/web3.js";

// Set the DAO address before running the script
const dao = new PublicKey("");

const provider = anchor.AnchorProvider.env();

// Payer MUST be the non-Squads signer - tSTp6B6kE9o6ZaTmHm2ZwnJBBtgd3x112tapxFhmBEQ
const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  [],
);

// We need both the multisig and vault addresses for the Metadao DAO
const metadaoSquadsMultisig = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);
const metadaoSquadsMultisigVault = METADAO_MULTISIG_VAULT;

export const collectFees = async () => {
  const daoAccount = await futarchy.fetchDao(dao);

  // We call the collect fees instruction from Metadao DAO's multisig account
  // It's the only one that can call the collect fees instruction
  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      anchor.getProvider().connection,
      metadaoSquadsMultisig,
    );

  // Prepare transaction message
  const collectFeesIx = await futarchy
    .collectFeesIx({
      dao,
      baseMint: daoAccount.baseMint,
      quoteMint: daoAccount.quoteMint,
    })
    .instruction();

  const transactionMessage = new TransactionMessage({
    instructions: [collectFeesIx],
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
    "Vault collect fees transaction create signature:",
    vaultTxCreateSignature,
  );
  console.log("Go ahead and execute the transaction through Squads.");
};

collectFees().catch(console.error);
