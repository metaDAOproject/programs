import {
  ComputeBudgetProgram,
  Keypair,
  Transaction,
  PublicKey,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient, FutarchyClient } from "@metadaoproject/futarchy/v0.6";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";

dotenv.config();

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

// Calculate discriminator for an account type using Anchor's method
function getDiscriminator(accountName: string): Buffer {
  return Buffer.from(
    anchor.BorshAccountsCoder.accountDiscriminator(accountName),
  );
}

async function dumpAccount(
  publicKey: PublicKey,
  outputDir: string,
  accountType: string,
) {
  const accountInfo = await provider.connection.getAccountInfo(publicKey);

  if (!accountInfo) {
    console.error(`Account ${publicKey.toBase58()} not found`);
    return;
  }

  // Create output in the same format as `solana account -o`
  const accountData = {
    pubkey: publicKey.toBase58(),
    account: {
      lamports: accountInfo.lamports,
      data: [accountInfo.data.toString("base64"), "base64"],
      owner: accountInfo.owner.toBase58(),
      executable: accountInfo.executable,
      rentEpoch: "U64_MAX_PLACEHOLDER",
    },
  };

  // Write to file
  const filename = path.join(outputDir, `${publicKey.toBase58()}.json`);
  fs.writeFileSync(
    filename,
    JSON.stringify(accountData, null, 2).replace(
      '"U64_MAX_PLACEHOLDER"',
      "18446744073709551615",
    ),
  );

  console.log(`Dumped ${accountType}: ${publicKey.toBase58()}`);
}

async function main() {
  const futarchy = FutarchyClient.createClient({ provider });

  const daosDir = "daos";
  const proposalsDir = "proposals";
  if (!fs.existsSync(daosDir)) {
    fs.mkdirSync(daosDir);
  }
  if (!fs.existsSync(proposalsDir)) {
    fs.mkdirSync(proposalsDir);
  }

  // Debug: Print discriminators
  const daoDiscriminator = getDiscriminator("Dao");
  const proposalDiscriminator = getDiscriminator("Proposal");
  console.log(`DAO discriminator (hex): ${daoDiscriminator.toString("hex")}`);
  console.log(`DAO discriminator (base58): ${bs58.encode(daoDiscriminator)}`);
  console.log(
    `Proposal discriminator (hex): ${proposalDiscriminator.toString("hex")}`,
  );
  console.log(
    `Proposal discriminator (base58): ${bs58.encode(proposalDiscriminator)}`,
  );
  console.log(`Program ID: ${futarchy.autocrat.programId.toBase58()}\n`);

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
  for (const { pubkey } of daoAccounts) {
    await dumpAccount(pubkey, daosDir, "DAO");
  }

  const proposalAccounts = await provider.connection.getProgramAccounts(
    futarchy.autocrat.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(getDiscriminator("Proposal")),
          },
        },
      ],
    },
  );

  console.log(`Found ${proposalAccounts.length} Proposals`);
  for (const { pubkey } of proposalAccounts) {
    await dumpAccount(pubkey, proposalsDir, "Proposal");
  }
}

// Make sure the promise rejection is handled
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
