import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";
import { getSquadsPdasFromDao } from "../utils/squads.js";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const DAO_ADDRESS = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");

async function main() {
    const { multisigPda, spendingLimitPda, vaultPda } = await getSquadsPdasFromDao(DAO_ADDRESS);
    
    // Get multisig account info
    const multisigAccountInfo = await multisig.accounts.Multisig.fromAccountAddress(
        provider.connection,
        multisigPda
    );

    const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
    console.log("Current transaction index:", currentTransactionIndex.toString());
    const transactionIndex = currentTransactionIndex + 1;


    console.log("Vault address (config authority):", vaultPda.toBase58());

    // Create the remove spending limit instruction
    const removeSpendingLimitIx = multisig.instructions.multisigRemoveSpendingLimit({
        multisigPda,
        configAuthority: DAO_ADDRESS, 
        spendingLimit: spendingLimitPda,
        rentCollector: vaultPda, 
        memo: "Removing spending limit",
    });

    // Create the transaction message for the vault
    const transactionMessage = new TransactionMessage({
        payerKey: payer.publicKey, 
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
        ephemeralSigners: 0, 
        transactionMessage,
    });

    // Create proposal
    const proposalCreateIx = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex.toString()),
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