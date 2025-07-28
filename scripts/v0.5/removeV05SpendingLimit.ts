import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const SQUADS_MULTISIG_ADDRESS = new PublicKey("7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY");
const SQUADS_VAULT = new PublicKey("rK7cW554iF9v8eNcH8DwLWX4a435DeB1TcUURnSjkcr");
const DAO_ADDRESS = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");

async function main() {
    const multisigPda = SQUADS_MULTISIG_ADDRESS;
    
    // Get multisig account info
    const multisigAccountInfo = await multisig.accounts.Multisig.fromAccountAddress(
        provider.connection,
        multisigPda
    );

    // this works because the DAO_ADDRESS was used as the createKey on dao initialization, ASSUMING we haven't since removed it
    const spendingLimitPda = await multisig.getSpendingLimitPda({ 
        multisigPda,
        createKey: DAO_ADDRESS,
    })

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
        spendingLimit: spendingLimitPda[0],
        rentCollector: SQUADS_VAULT, 
        memo: "Removing spending limit",
    });

    // Create the transaction message for the vault
    const transactionMessage = new TransactionMessage({
        payerKey: payer.PublicKey, 
        recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
        instructions: [removeSpendingLimitIx],
    });

    // Create vault transaction
    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex.toString()),
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: payer.PublicKey,
        vaultIndex: 0, // assuming 0th index vault
        ephemeralSigners: 0, 
        transactionMessage,
    });

    // Create proposal
    const proposalCreateIx = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt((transactionIndex ).toString()),
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: payer.PublicKey,
        isDraft: false,
    });

    // Add both instructions to create the proposal
    const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = payer.PublicKey;
    
    // Sign with both accounts
    tx.sign(payer, PERMISSIONLESS_ACCOUNT);
    
    const txHash = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction(txHash, "confirmed");
    
    console.log("Remove spending limit proposal created successfully!");
    console.log("Transaction hash:", txHash);
    console.log("Proposal index:", transactionIndex.toString());
    console.log(`Proposed removal of spending limit: ${spendingLimitPda[0].toBase58()}`);

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