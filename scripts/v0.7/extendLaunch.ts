import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { LaunchpadClient } from "@metadaoproject/programs/launchpad/v0.7";
import { METADAO_MULTISIG_VAULT } from "@metadaoproject/programs";
import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";

// Set the launch address before running the script
const launch = new PublicKey("");

// Set the number of seconds to extend the launch by
const durationSeconds = 60 * 60 * 24; // 1 day

const provider = anchor.AnchorProvider.env();

// Payer MUST be a signer with permissions to propose transactions on MetaDAO's multisig
const payer = provider.wallet["payer"];

const launchpad: LaunchpadClient = LaunchpadClient.createClient({ provider });

// MetaDAO Squads multisig and vault addresses
const metadaoSquadsMultisig = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);
const metadaoSquadsMultisigVault = METADAO_MULTISIG_VAULT;

export const extendLaunch = async () => {
  const launchAccount = await launchpad.getLaunch(launch);

  console.log(`Extending launch: ${launch.toBase58()}`);
  console.log(`Current seconds_for_launch: ${launchAccount.secondsForLaunch}`);
  console.log(`Extension: ${durationSeconds} seconds`);
  console.log(
    `New seconds_for_launch: ${launchAccount.secondsForLaunch + durationSeconds}`,
  );

  // Build the extend_launch instruction
  const extendLaunchIx = await launchpad
    .extendLaunchIx({
      launch,
      durationSeconds,
      admin: metadaoSquadsMultisigVault,
    })
    .instruction();

  // Build the transaction message with the multisig vault as payer
  const transactionMessage = new TransactionMessage({
    instructions: [extendLaunchIx],
    payerKey: metadaoSquadsMultisigVault,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
  });

  // Log the transaction message as base64
  const compiledMessage = transactionMessage.compileToLegacyMessage();
  const base64Message = Buffer.from(compiledMessage.serialize()).toString(
    "base64",
  );
  console.log("\nTransaction message (base64):");
  console.log(base64Message);

  // TODO: Uncomment this when ready to extend the launch
  return;

  // Fetch the current multisig state to get the next transaction index
  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      metadaoSquadsMultisig,
    );

  const transactionIndex =
    BigInt(metaDaoSquadsMultisigAccount.transactionIndex.toString()) + 1n;

  // Create vault transaction instruction
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: metadaoSquadsMultisig,
    transactionIndex,
    creator: payer.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  // Create proposal instruction
  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: metadaoSquadsMultisig,
    transactionIndex,
    creator: payer.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  // Build, sign, and send the transaction
  const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  const [proposalPda] = multisig.getProposalPda({
    multisigPda: metadaoSquadsMultisig,
    transactionIndex,
  });

  console.log("\nVault transaction + proposal created successfully!");
  console.log("Transaction signature:", txHash);
  console.log("Proposal index:", transactionIndex.toString());
  console.log("Proposal PDA:", proposalPda.toBase58());
  console.log("Go ahead and approve/execute the transaction through Squads.");
};

extendLaunch().catch(console.error);
