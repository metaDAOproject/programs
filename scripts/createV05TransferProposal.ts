import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";
import { 
    createTransferInstruction, 
    getAssociatedTokenAddressSync,
    createAssociatedTokenAccountIdempotentInstruction 
} from "@solana/spl-token";

// we want transfer and config authority removal out the gate

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const SQUADS_MULTISIG_ADDRESS = new PublicKey("7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY");
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC
const SQUADS_VAULT = new PublicKey("rK7cW554iF9v8eNcH8DwLWX4a435DeB1TcUURnSjkcr");
const DAO_ADDRESS = new PublicKey("9NCPLEFgiu4XZdp9wtWMc1mXyY26VGeWsoKHCAPP3bAo");

// Configuration
const RECIPIENT = new PublicKey("RECIPIENT_ADDRESS_HERE"); // change this to the recipient's address when testing
const AMOUNT = 1_000_000; // 1 USDC (6 decimals)

async function main() {
    const multisigPda = SQUADS_MULTISIG_ADDRESS;
    
    const multisigAccountInfo = await multisig.accounts.Multisig.fromAccountAddress(
        provider.connection,
        multisigPda
    );

    const currentTransactionIndex = Number(multisigAccountInfo.transactionIndex);
    console.log("Current transaction index:", currentTransactionIndex.toString());
    const transactionIndex = currentTransactionIndex + 1;

    // Get the vault PDA
    // assumes 0th index vault, general way to obtain it
    // const [vaultPda] = multisig.getVaultPda({
    //     multisigPda,
    //     index: transactionIndex
    // });
    console.log("Vault address:", SQUADS_VAULT.toBase58());

    // Get token accounts
    const vaultUsdcAccount = getAssociatedTokenAddressSync(
        USDC_MINT,
        SQUADS_VAULT,
        true // Allow PDA owner
    );
    
    const recipientUsdcAccount = getAssociatedTokenAddressSync(
        USDC_MINT,
        RECIPIENT
    );

    // Create the instructions array for the vault transaction
    const vaultInstructions = [];

    // Add idempotent instruction to create recipient's USDC account if needed
    const createRecipientAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        payer.PublicKey,
        recipientUsdcAccount,  
        RECIPIENT,             
        USDC_MINT            
    );
    vaultInstructions.push(createRecipientAtaIx);

    // Add the transfer instruction
    const transferInstruction = createTransferInstruction(
        vaultUsdcAccount,     
        recipientUsdcAccount, 
        SQUADS_VAULT,            
        AMOUNT               
    );
    vaultInstructions.push(transferInstruction);

    // Create the transaction message for the vault
    const transactionMessage = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
        instructions: vaultInstructions, 
    });

    // Create vault transaction
    const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
        multisigPda,
        transactionIndex: BigInt(transactionIndex.toString()),
        creator: PERMISSIONLESS_ACCOUNT.publicKey,
        rentPayer: payer.publicKey,
        vaultIndex: 0, // need to check this
        ephemeralSigners: 0, // do we want to use ephemeral signers?
        transactionMessage,
    });

    // Create proposal
    const proposalCreateIx = multisig.instructions.proposalCreate({
        multisigPda,
        transactionIndex: BigInt((transactionIndex +1 ).toString()),
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
    
    console.log("USDC transfer proposal created successfully!");
    console.log("Transaction hash:", txHash);
    console.log("Proposal index:", transactionIndex.toString());
    console.log(`Proposed transfer: ${AMOUNT / 1_000_000} USDC from vault to ${RECIPIENT.toBase58()}`);

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