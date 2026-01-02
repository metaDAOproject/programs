import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";

const SQUADS_PROPOSAL = new PublicKey(
  "8bWPpq7Dn34EQLJ4DtV9oPVU7aH2Umu11RGNnoPsQYPP",
);

const provider = anchor.AnchorProvider.env();

async function main() {
  console.log("=".repeat(60));
  console.log("DECODE SQUADS PROPOSAL");
  console.log("=".repeat(60));
  console.log("Squads Proposal:", SQUADS_PROPOSAL.toBase58());

  // The squads proposal PDA is derived from multisig + transaction index
  // We need to find the associated vault transaction

  // First, let's try to fetch the proposal account to get the multisig
  const proposalInfo =
    await provider.connection.getAccountInfo(SQUADS_PROPOSAL);
  if (!proposalInfo) {
    console.log("Proposal account not found");
    return;
  }

  // Decode the proposal to get multisig and transaction index
  const proposal = multisig.accounts.Proposal.fromAccountInfo(proposalInfo)[0];
  console.log("\nProposal Info:");
  console.log("  Multisig:", proposal.multisig.toBase58());
  console.log("  Transaction Index:", proposal.transactionIndex.toString());
  console.log("  Status:", Object.keys(proposal.status)[0]);

  // Now fetch the vault transaction
  const [vaultTxPda] = multisig.getTransactionPda({
    multisigPda: proposal.multisig,
    index: BigInt(proposal.transactionIndex.toString()),
  });

  console.log("  Vault Transaction PDA:", vaultTxPda.toBase58());

  const vaultTxInfo = await provider.connection.getAccountInfo(vaultTxPda);
  if (!vaultTxInfo) {
    console.log("Vault transaction not found");
    return;
  }

  const vaultTx =
    multisig.accounts.VaultTransaction.fromAccountInfo(vaultTxInfo)[0];

  console.log("\n--- VAULT TRANSACTION INSTRUCTIONS ---");

  const message = vaultTx.message;
  const accountKeys = message.accountKeys;

  for (let i = 0; i < message.instructions.length; i++) {
    const ix = message.instructions[i];
    const programId = accountKeys[ix.programIdIndex];
    const data = Buffer.from(ix.data);

    console.log(`\nInstruction ${i + 1}:`);
    console.log("  Program:", programId.toBase58());

    // Check if it's SPL Token program
    if (
      programId.toBase58() === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    ) {
      const discriminator = data[0];

      if (discriminator === 8) {
        // Burn
        const amount = data.readBigUInt64LE(1);
        console.log("  Type: BURN");
        console.log("  Amount (raw):", amount.toString());
        console.log(
          "  Amount (human):",
          (Number(amount) / 1e6).toLocaleString(),
        );
      } else if (discriminator === 3) {
        // Transfer
        const amount = data.readBigUInt64LE(1);
        console.log("  Type: TRANSFER");
        console.log("  Amount (raw):", amount.toString());
        console.log(
          "  Amount (human):",
          (Number(amount) / 1e6).toLocaleString(),
        );
      } else if (discriminator === 1) {
        // InitializeAccount
        console.log("  Type: INITIALIZE_ACCOUNT");
      } else {
        console.log(
          "  Type: Unknown SPL Token instruction, discriminator:",
          discriminator,
        );
        console.log("  Data (hex):", data.toString("hex"));
      }
    } else if (
      programId.toBase58() === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
    ) {
      console.log("  Type: Associated Token Account instruction");
    } else {
      console.log("  Data (hex):", data.toString("hex").slice(0, 64) + "...");
    }

    // Show accounts
    console.log("  Accounts:");
    for (let j = 0; j < ix.accountIndexes.length; j++) {
      const accountIndex = ix.accountIndexes[j];
      const account = accountKeys[accountIndex];
      console.log(`    ${j}: ${account.toBase58()}`);
    }
  }

  console.log("\n" + "=".repeat(60));
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
