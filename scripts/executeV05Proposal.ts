import { PublicKey, Transaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import * as anchor from "@coral-xyz/anchor";
import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/futarchy/v0.5";

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

const SQUADS_MULTISIG_ADDRESS = new PublicKey("7AivcS5Sm3uneG7EKtjAmmgWeQ653v6B1Uzc3JiYWihY");
const PROPOSAL_PDA = new PublicKey("HDyg2gbibGfDf672KN9MU38Z5dnNVaSiTsVQw33WnY5Q");
const SQUADS_VAULT = new PublicKey("rK7cW554iF9v8eNcH8DwLWX4a435DeB1TcUURnSjkcr");

async function main() {
    const multisigPda = SQUADS_MULTISIG_ADDRESS;

    const proposalAccountInfo = await multisig.accounts.Proposal.fromAccountAddress(
        provider.connection,
        PROPOSAL_PDA
    );

    const currentTransactionIndex = Number(proposalAccountInfo.transactionIndex);
    console.log("Current transaction index:", currentTransactionIndex.toString());

    // Get the vault PDA
    // assumes 0th index vault, general way to obtain it
    // const [vaultPda] = multisig.getVaultPda({
    //     multisigPda,
    //     index: transactionIndex
    // });
    console.log("Vault address:", SQUADS_VAULT.toBase58());

    const proposalApproveIx = multisig.instructions.proposalApprove({
        multisigPda,
        transactionIndex: BigInt(currentTransactionIndex.toString()),
        member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    const vaultTxExecuteIx = multisig.instructions.vaultTransactionExecute({
        connection: provider.connection,
        multisigPda,
        transactionIndex: BigInt(currentTransactionIndex.toString()),
        member: PERMISSIONLESS_ACCOUNT.publicKey,
    });

    // Add both instructions to create the proposal
    const vaultTxExecuteIxResolved = await vaultTxExecuteIx;
    const tx = new Transaction().add(proposalApproveIx, vaultTxExecuteIxResolved.instruction);
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    tx.feePayer = payer.publicKey;
    
    // Sign with both accounts
    tx.sign(payer, PERMISSIONLESS_ACCOUNT);
    
    const txHash = await provider.connection.sendRawTransaction(tx.serialize());
    await provider.connection.confirmTransaction(txHash, "confirmed");
    
    console.log("USDC transfer proposal executed successfully!");
    console.log("Transaction hash:", txHash);
    console.log("Proposal index:", currentTransactionIndex.toString());

    // Get the proposal PDA
    const [proposalPda] = multisig.getProposalPda({
        multisigPda,
        transactionIndex: BigInt(currentTransactionIndex.toString()),
    });
    console.log("Proposal PDA:", proposalPda.toBase58());
}

main().catch((error) => {
    console.error("Error creating transfer:", error);
    process.exit(1);
});