import * as multisig from "@sqds/multisig";
import { METADAO_MULTISIG_VAULT } from "@metadaoproject/programs";
import { PublicKey, Transaction, TransactionMessage } from "@solana/web3.js";

import { createLaunchContext } from "../../utils/launch/provider.js";
import { requireLaunchAddress } from "./loadConfig.js";
import type { LaunchConfig } from "./types.js";

const METADAO_SQUADS_MULTISIG = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);

/**
 * Build (and optionally propose) an extend_launch vault transaction via MetaDAO Squads.
 * Pass --propose to create the vault tx + proposal; otherwise prints base64 message only.
 */
export async function extendLaunch(
  config: LaunchConfig,
  opts: { propose?: boolean } = {},
): Promise<void> {
  requireLaunchAddress(config);
  const { provider, payer, launchpad } = createLaunchContext();

  const durationSeconds = config.EXTEND_DURATION_SECONDS ?? 60 * 60 * 24; // 1 day

  const launch = config.LAUNCH_ADDRESS;
  const launchAccount = await launchpad.getLaunch(launch);

  console.log(`Extending launch: ${launch.toBase58()}`);
  console.log(`Current seconds_for_launch: ${launchAccount.secondsForLaunch}`);
  console.log(`Extension: ${durationSeconds} seconds`);
  console.log(
    `New seconds_for_launch: ${launchAccount.secondsForLaunch + durationSeconds}`,
  );

  const extendLaunchIx = await launchpad
    .extendLaunchIx({
      launch,
      durationSeconds,
      admin: METADAO_MULTISIG_VAULT,
    })
    .instruction();

  const transactionMessage = new TransactionMessage({
    instructions: [extendLaunchIx],
    payerKey: METADAO_MULTISIG_VAULT,
    recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
  });

  const compiledMessage = transactionMessage.compileToLegacyMessage();
  const base64Message = Buffer.from(compiledMessage.serialize()).toString(
    "base64",
  );
  console.log("\nTransaction message (base64):");
  console.log(base64Message);

  if (!opts.propose) {
    console.log(
      "\nDry build only. Re-run with --propose to create the Squads vault tx.",
    );
    return;
  }

  const metaDaoSquadsMultisigAccount =
    await multisig.accounts.Multisig.fromAccountAddress(
      provider.connection,
      METADAO_SQUADS_MULTISIG,
    );

  const transactionIndex =
    BigInt(metaDaoSquadsMultisigAccount.transactionIndex.toString()) + 1n;

  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: METADAO_SQUADS_MULTISIG,
    transactionIndex,
    creator: payer.publicKey,
    rentPayer: payer.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: METADAO_SQUADS_MULTISIG,
    transactionIndex,
    creator: payer.publicKey,
    rentPayer: payer.publicKey,
    isDraft: false,
  });

  const tx = new Transaction().add(vaultTxCreateIx, proposalCreateIx);
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const txHash = await provider.connection.sendRawTransaction(tx.serialize());
  await provider.connection.confirmTransaction(txHash, "confirmed");

  const [proposalPda] = multisig.getProposalPda({
    multisigPda: METADAO_SQUADS_MULTISIG,
    transactionIndex,
  });

  console.log("\nVault transaction + proposal created successfully!");
  console.log("Transaction signature:", txHash);
  console.log("Proposal index:", transactionIndex.toString());
  console.log("Proposal PDA:", proposalPda.toBase58());
}

export async function claimAdditionalTokens(
  config: LaunchConfig,
): Promise<void> {
  requireLaunchAddress(config);
  const { launchpad } = createLaunchContext();

  const launch = config.LAUNCH_ADDRESS;
  console.log(
    `Claiming additional token allocation for launch: ${launch.toBase58()}`,
  );

  const launchAccount = await launchpad.fetchLaunch(launch);
  if (!launchAccount) {
    throw new Error("Launch account not found");
  }

  console.log(
    `Additional tokens recipient: ${launchAccount.additionalTokensRecipient.toBase58()}`,
  );
  console.log(
    `Additional tokens amount: ${launchAccount.additionalTokensAmount.toString()}`,
  );

  const txSignature = await launchpad
    .claimAdditionalTokenAllocationIx({
      launch,
      baseMint: launchAccount.baseMint,
      additionalTokensRecipient: launchAccount.additionalTokensRecipient,
    })
    .rpc();

  console.log(`Additional token allocation claimed: ${txSignature}`);
}
