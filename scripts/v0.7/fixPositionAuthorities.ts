import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  LAUNCHPAD_PROGRAM_ID,
  FutarchyClient,
  getLaunchAddr,
  getLaunchSignerAddr,
  METADAO_MULTISIG_VAULT,
} from "@metadaoproject/futarchy/v0.7";
import { LAUNCHPAD_PROGRAM_ID as V06_LAUNCHPAD_PROGRAM_ID } from "@metadaoproject/futarchy/v0.6";
import { PublicKey, TransactionMessage } from "@solana/web3.js";
import bs58 from "bs58";

const provider = anchor.AnchorProvider.env();

const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  [],
);

const metadaoSquadsMultisig = new PublicKey(
  "8N3Tvc6B1wEVKVC6iD4s6eyaCNqX2ovj2xze2q3Q9DWH",
);
const metadaoSquadsMultisigVault = METADAO_MULTISIG_VAULT;

const BATCH_SIZE = 10;

function getDiscriminator(accountName: string): Buffer {
  return Buffer.from(
    anchor.BorshAccountsCoder.accountDiscriminator(accountName),
  );
}

async function main() {
  // 1. Fetch all DAO accounts
  console.log("Fetching all DAO accounts...");
  const daoDiscriminator = getDiscriminator("Dao");
  const daoAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(daoDiscriminator),
          },
        },
      ],
    },
  );
  console.log(`Found ${daoAccounts.length} DAOs`);

  // Build map: DAO pubkey -> { squadsMultisigVault, v07LaunchSigner, v06LaunchSigner }
  const daoMap = new Map<
    string,
    {
      squadsMultisigVault: PublicKey;
      v07LaunchSigner: PublicKey;
      v06LaunchSigner: PublicKey;
    }
  >();

  for (const { pubkey, account } of daoAccounts) {
    const dao = futarchy.autocrat.coder.accounts.decode("dao", account.data);
    const [v07Launch] = getLaunchAddr(LAUNCHPAD_PROGRAM_ID, dao.baseMint);
    const [v07LaunchSigner] = getLaunchSignerAddr(
      LAUNCHPAD_PROGRAM_ID,
      v07Launch,
    );
    const [v06Launch] = getLaunchAddr(V06_LAUNCHPAD_PROGRAM_ID, dao.baseMint);
    const [v06LaunchSigner] = getLaunchSignerAddr(
      V06_LAUNCHPAD_PROGRAM_ID,
      v06Launch,
    );
    daoMap.set(pubkey.toBase58(), {
      squadsMultisigVault: dao.squadsMultisigVault,
      v07LaunchSigner,
      v06LaunchSigner,
    });
  }

  // 2. Fetch all AmmPosition accounts
  console.log("Fetching all AmmPosition accounts...");
  const positionDiscriminator = getDiscriminator("AmmPosition");
  const positionAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(positionDiscriminator),
          },
        },
      ],
    },
  );
  console.log(`Found ${positionAccounts.length} AmmPositions\n`);

  // 3. Filter to affected positions
  const affectedDaos: { daoPubkey: PublicKey; positionPubkey: PublicKey }[] =
    [];

  for (const { pubkey, account } of positionAccounts) {
    const position = futarchy.autocrat.coder.accounts.decode(
      "ammPosition",
      account.data,
    );

    const daoPubkey = (position.dao as PublicKey).toBase58();
    const daoInfo = daoMap.get(daoPubkey);
    if (!daoInfo) continue;

    // Check if this position's address was derived from dao + squadsMultisigVault
    const [expectedPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        new PublicKey(daoPubkey).toBuffer(),
        daoInfo.squadsMultisigVault.toBuffer(),
      ],
      FUTARCHY_PROGRAM_ID,
    );
    const derivedFromVault = pubkey.toBase58() === expectedPda.toBase58();
    if (!derivedFromVault) continue;

    // Check if current authority is a launch signer (i.e. bug-affected)
    const positionAuthority = (
      position.positionAuthority as PublicKey
    ).toBase58();
    const isV07LaunchSigner =
      positionAuthority === daoInfo.v07LaunchSigner.toBase58();
    const isV06LaunchSigner =
      positionAuthority === daoInfo.v06LaunchSigner.toBase58();

    if (!isV07LaunchSigner && !isV06LaunchSigner) continue;

    const version = isV07LaunchSigner ? "v0.7" : "v0.6";
    console.log(`Affected position: ${pubkey.toBase58()}`);
    console.log(`  DAO:                ${daoPubkey}`);
    console.log(
      `  Current authority:  ${positionAuthority} (${version} launch signer)`,
    );
    console.log(
      `  Expected authority: ${daoInfo.squadsMultisigVault.toBase58()}`,
    );
    console.log();

    affectedDaos.push({
      daoPubkey: new PublicKey(daoPubkey),
      positionPubkey: pubkey,
    });
  }

  if (affectedDaos.length === 0) {
    console.log("No affected positions found. Nothing to fix.");
    return;
  }

  // 4. Build fix instructions
  console.log(
    `Building fix instructions for ${affectedDaos.length} affected positions...`,
  );
  const instructions = [];
  for (const { daoPubkey } of affectedDaos) {
    const ix = await futarchy
      .adminFixPositionAuthorityIx({
        dao: daoPubkey,
        admin: metadaoSquadsMultisigVault,
      })
      .instruction();
    instructions.push(ix);
  }

  // 5. Batch into groups
  const batches = [];
  for (let i = 0; i < instructions.length; i += BATCH_SIZE) {
    batches.push(instructions.slice(i, i + BATCH_SIZE));
  }

  // 6. Output base64 messages for inspection
  console.log(
    `\n=== Base64 Transaction Messages (${batches.length} batches) ===\n`,
  );
  for (let i = 0; i < batches.length; i++) {
    const message = new TransactionMessage({
      payerKey: metadaoSquadsMultisigVault,
      recentBlockhash: (await provider.connection.getLatestBlockhash())
        .blockhash,
      instructions: batches[i],
    });
    const compiled = message.compileToLegacyMessage();
    const base64 = Buffer.from(compiled.serialize()).toString("base64");
    console.log(`Batch ${i + 1} (${batches[i].length} instructions):`);
    console.log(base64);
    console.log();
  }

  // 7. Summary
  console.log("=== Summary ===");
  console.log(`Total affected positions: ${affectedDaos.length}`);
  console.log(`Number of batches:        ${batches.length}`);
  console.log(`DAOs involved:`);
  const uniqueDaos = new Set(affectedDaos.map((a) => a.daoPubkey.toBase58()));
  for (const dao of uniqueDaos) {
    console.log(`  - ${dao}`);
  }

  // 8. Safety gate
  console.log(
    "\nReturning early. Uncomment code and remove the return below to create Squads proposals.",
  );
  return;

  // // 9. Create Squads vault transactions + proposals
  // const squadsMultisigAccount =
  //   await multisig.accounts.Multisig.fromAccountAddress(
  //     provider.connection,
  //     metadaoSquadsMultisig,
  //   );
  // let txIndex =
  //   BigInt(squadsMultisigAccount.transactionIndex.toString()) + 1n;

  // for (let i = 0; i < batches.length; i++) {
  //   const transactionMessage = new TransactionMessage({
  //     payerKey: metadaoSquadsMultisigVault,
  //     recentBlockhash: (await provider.connection.getLatestBlockhash())
  //       .blockhash,
  //     instructions: batches[i],
  //   });

  //   // Create vault transaction
  //   const vaultTxSig = await multisig.rpc.vaultTransactionCreate({
  //     connection: provider.connection,
  //     creator: payer.publicKey,
  //     feePayer: payer.publicKey,
  //     ephemeralSigners: 0,
  //     multisigPda: metadaoSquadsMultisig,
  //     transactionIndex: txIndex,
  //     vaultIndex: 0,
  //     transactionMessage,
  //   });
  //   console.log(`Vault tx ${txIndex} (batch ${i + 1}): ${vaultTxSig}`);

  //   // Create proposal
  //   const proposalSig = await multisig.rpc.proposalCreate({
  //     connection: provider.connection,
  //     creator: payer.publicKey,
  //     feePayer: payer.publicKey,
  //     multisigPda: metadaoSquadsMultisig,
  //     transactionIndex: txIndex,
  //   });
  //   console.log(`Proposal ${txIndex} (batch ${i + 1}): ${proposalSig}`);

  //   txIndex++;
  // }

  // console.log("\nAll Squads proposals created.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
