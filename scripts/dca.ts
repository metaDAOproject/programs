import { ComputeBudgetProgram, PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { AutocratClient, ConditionalVaultClient, MAINNET_USDC } from "@metadaoproject/futarchy/v0.4";
import * as token from "@solana/spl-token";
import { AmmClient } from "@metadaoproject/futarchy/v0.4";
import BN from "bn.js";

const PROPOSAL = new PublicKey("3hhWb9eWaGmPPaCJ8TCb9ZEyogpJT9NXNmPWL3YsFuyh");

const provider = anchor.AnchorProvider.env();
const autocratProgram = AutocratClient.createClient({ provider });
const vaultProgram = ConditionalVaultClient.createClient({ provider });
const ammProgram = AmmClient.createClient({ provider });
const payer = provider.wallet["payer"];

async function main() {
    try {
        const proposal = await autocratProgram.getProposal(PROPOSAL);

        const dao = await autocratProgram.getDao(proposal.dao);

        const usdcVault = proposal.quoteVault;
        const question = proposal.question;

        const {
            passBaseMint,
            passQuoteMint,
        } = autocratProgram.getProposalPdas(PROPOSAL, dao.tokenMint, dao.usdcMint, proposal.dao);

        const splitTx = await vaultProgram.splitTokensIx(question, usdcVault, MAINNET_USDC, new BN(25 * 1e6), 2).transaction();

        const swapTx = await ammProgram.swapIx(proposal.passAmm, passBaseMint, passQuoteMint, { buy: {}}, new BN(25 * 1e6), new BN(40 * 1e6)).transaction();

        const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }), splitTx, swapTx);

        const sig = await provider.sendAndConfirm(tx, undefined, { commitment: "confirmed" });

        console.log(`Transaction sent: ${sig}`);
        console.log(`Time: ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error("Error executing transaction:", error);
    }
}

async function runPeriodically() {
    console.log("Starting periodic transactions every 30 seconds...");
    
    // Execute immediately on start
    await main();
    
    // Then set up interval
    setInterval(async () => {
        await main();
    }, 30 * 1000); // 60 seconds in milliseconds
}

// Replace the original main call with the periodic version
runPeriodically().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});