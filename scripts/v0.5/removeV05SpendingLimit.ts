import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const SQUADS_MULTISIG_ADDRESS = new PublicKey("7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY");
const SQUADS_VAULT = new PublicKey("rK7cW554iF9v8eNcH8DwLWX4a435DeB1TcUURnSjkcr");
const DAO_ADDRESS = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");

// Configuration - set these values
const SPENDING_LIMIT_TO_REMOVE = new PublicKey("SPENDING_LIMIT_PDA_HERE"); // The spending limit PDA to remove, still need to dynamically calculate
const RENT_COLLECTOR = new PublicKey("RENT_COLLECTOR_ADDRESS_HERE"); // Who receives the rent

async function main() {
    const multisigPda = SQUADS_MULTISIG_ADDRESS;
    
    // Get multisig account info
    const multisigAccountInfo = await multisig.accounts.Multisig.fromAccountAddress(
        provider.connection,
        multisigPda
    );

    const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
    console.log("Current transaction index:", currentTransactionIndex.toString());
    const transactionIndex = currentTransactionIndex + 1;

    // Get the vault PDA, this would be the general way to obtain it.
    // const [vaultPda] = multisig.getVaultPda({
    //     multisigPda,
    //     index: 0
    // });

    console.log("Vault address (config authority):", SQUADS_VAULT.toBase58());

    // Create the remove spending limit instruction
    const removeSpendingLimitIx = multisig.instructions.multisigRemoveSpendingLimit({
        multisigPda,
        configAuthority: DAO_ADDRESS, 
        spendingLimit: SPENDING_LIMIT_TO_REMOVE,
        rentCollector: payer.publicKey, 
        memo: "Removing spending limit",
    });

    // Create the transaction message for the vault
    const transactionMessage = new TransactionMessage({
        payerKey: payer.publicKey, // does the user pay for everything? can they? 
        recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
        instructions: [removeSpendingLimitIx],
    });

    // Create vault transaction
    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex.toString()),
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: payer.publicKey,
        vaultIndex: 0, // assuming 0th index vault
        ephemeralSigners: 0, // do we want to use ephemeral signers?
        transactionMessage,
    });

    // Create proposal
    const proposalCreateIx = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt((transactionIndex ).toString()),
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: payer.publicKey,
        isDraft: false,
    });

    // Add both instructions to create the proposal
    const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = payer.publicKey;
    
    // Sign with both accounts
    tx.sign(payer, PERMISSIONLESS_ACCOUNT);
    
    const txHash = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction(txHash, "confirmed");
    
    console.log("Remove spending limit proposal created successfully!");
    console.log("Transaction hash:", txHash);
    console.log("Proposal index:", transactionIndex.toString());
    console.log(`Proposed removal of spending limit: ${SPENDING_LIMIT_TO_REMOVE.toBase58()}`);
    console.log(`Rent will be returned to: ${RENT_COLLECTOR.toBase58()}`);

    // Get the proposal PDA
    const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(transactionIndex.toString()),
    });
    console.log("Proposal PDA:", proposalPda.toBase58());
}

main().catch((error) => {
    console.error("Error removing spending limit:", error);
    process.exit(1);
});