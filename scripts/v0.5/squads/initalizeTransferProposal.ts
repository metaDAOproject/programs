import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { getSquadsPdasFromDao } from "../../utils/squads.js";
import { USDC } from "../../consts.js";

// we want transfer and config authority removal out the gate

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const MINT = USDC; // Mainnet USDC

// Configuration
const DAO_ADDRESS = new PublicKey(
  "7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY",
);
const RECIPIENT = new PublicKey("CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf"); // change this to the recipient's address when testing
const AMOUNT = 1_000_000; // 1 USDC (6 decimals)

async function main() {
  const { multisigPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);

  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
  console.log("Current transaction index:", currentTransactionIndex.toString());
  const transactionIndex = currentTransactionIndex + 1;

  console.log("Vault address:", vaultPda.toBase58());

  // Get token accounts
  const vaultUsdcAccount = getAssociatedTokenAddressSync(
    MINT,
    vaultPda,
    true, // Allow PDA owner
  );

  const recipientUsdcAccount = getAssociatedTokenAddressSync(MINT, RECIPIENT);
  // TODO: check if the vault has a balance of the token

  // Add idempotent instruction to create recipient's USDC account if needed
  const createRecipientAtaIx =
    createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      recipientUsdcAccount,
      RECIPIENT,
      MINT,
    );

  // Add the transfer instruction
  const transferInstruction = createTransferInstruction(
    vaultUsdcAccount,
    recipientUsdcAccount,
    vaultPda,
    AMOUNT,
  );

  // Create the transaction message for the vault
  const transactionMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: [transferInstruction],
  });

  // Create vault transaction
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: vaultPda, // TODO: Review
    vaultIndex: 0,
    ephemeralSigners: 0, // do we want to use ephemeral signers?
    transactionMessage,
  });

  // Create proposal
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: vaultPda, // TODO: Review
    isDraft: false,
  });

  // Add both instructions to create the proposal
  const tx = new Transaction().add(
    createRecipientAtaIx,
    vaultTxCreateIx,
    proposalCreateIx,
  );
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;

  // Sign with both accounts
  tx.sign(payer, PERMISSIONLESS_ACCOUNT);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("USDC transfer proposal created successfully!");
  console.log("Transaction hash:", txHash);
  console.log("Proposal index:", transactionIndex.toString());
  console.log(
    `Proposed transfer: ${
      AMOUNT / 1_000_000
    } USDC from vault to ${RECIPIENT.toBase58()}`,
  );

  // Get the proposal PDA
  const [proposalPda] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
  });
  console.log("Proposal PDA:", proposalPda.toBase58());
}

main().catch((error) => {
  console.error("Error creating transfer:", error);
  process.exit(1);
});
