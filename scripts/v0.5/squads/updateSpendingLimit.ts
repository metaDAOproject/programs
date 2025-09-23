import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";
import { getSquadsPdasFromDao } from "../utils/squads.js";
import { USDC } from "../consts.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey(
  "9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo",
);
const MINT = USDC;
const MEMBERS_TO_ADD = [
  new PublicKey("CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf"),
  new PublicKey("FWAVLoePxNurdxanrEnd9d7cSYpRzFYAE2CNFPotz15K"),
];
const PERIOD = multisig.generated.Period.Week;

// Configuration - set these values
const AMOUNT = 20_000_000; // 20 USDC (6 decimals)

async function main() {
  const { multisigPda, spendingLimitPda, vaultPda } =
    await getSquadsPdasFromDao(DAO_ADDRESS);

  // Get multisig account info
  const multisigAccountInfo =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      multisigPda,
    );

  const destinations = await Promise.all(
    MEMBERS_TO_ADD.map((member) =>
      getAssociatedTokenAddress(MINT, member, true),
    ),
  );

  const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
  console.log("Current transaction index:", currentTransactionIndex.toString());
  const transactionIndex = currentTransactionIndex + 1;

  console.log("Vault address (config authority):", vaultPda.toBase58());

  // Create the remove spending limit instruction
  const removeSpendingLimitIx =
    multisig.instructions.multisigRemoveSpendingLimit({
      multisigPda,
      configAuthority: DAO_ADDRESS,
      spendingLimit: spendingLimitPda[0],
      rentCollector: vaultPda,
      memo: "Removing spending limit",
    });

  const addSpendingLimitIx = multisig.instructions.multisigAddSpendingLimit({
    multisigPda,
    spendingLimit: spendingLimitPda[0],
    configAuthority: DAO_ADDRESS,
    rentPayer: vaultPda,
    createKey: DAO_ADDRESS,
    vaultIndex: 0, // again assumes we're 0th index for the vault
    mint: MINT,
    amount: BigInt(AMOUNT),
    period: PERIOD,
    members: MEMBERS_TO_ADD,
    destinations: destinations,
    memo: "Adding spending limit",
  });

  // Create the transaction message for the vault
  const transactionMessage = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
    instructions: [removeSpendingLimitIx, addSpendingLimitIx],
  });

  // Create vault transaction
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: vaultPda,
    vaultIndex: 0, // assuming 0th index vault
    ephemeralSigners: 0, // do we want to use ephemeral signers?
    transactionMessage,
  });

  // Create proposal
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
    creator: PERMISSIONLESS_ACCOUNT.publicKey,
    rentPayer: vaultPda,
    isDraft: false,
  });

  // Add both instructions to create the proposal
  const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;

  // Sign with both accounts
  tx.sign(payer, PERMISSIONLESS_ACCOUNT);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  console.log("Updating spending limit proposal created successfully!");
  console.log("Transaction hash:", txHash);
  console.log("Proposal index:", transactionIndex.toString());
  console.log(`Rent will be returned to: ${vaultPda.toBase58()}`);

  // Get the proposal PDA
  const [proposalPda] = multisig.getProposalPda({
    multisigPda,
    transactionIndex: BigInt(transactionIndex.toString()),
  });
  console.log("Proposal PDA:", proposalPda.toBase58());
}

main().catch((error) => {
  console.error("Error updating spending limit:", error);
  process.exit(1);
});
