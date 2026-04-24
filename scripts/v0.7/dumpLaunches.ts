import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { LaunchpadClient } from "@metadaoproject/futarchy/launchpad/v0.7";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import bs58 from "bs58";

dotenv.config();

const provider = anchor.AnchorProvider.env();

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
  const launchpad = LaunchpadClient.createClient({ provider });

  const launchesDir = "test-ledger-accounts";
  if (!fs.existsSync(launchesDir)) {
    fs.mkdirSync(launchesDir);
  }

  const launchDiscriminator = getDiscriminator("Launch");
  console.log(
    `Launch discriminator (hex): ${launchDiscriminator.toString("hex")}`,
  );
  console.log(
    `Launch discriminator (base58): ${bs58.encode(launchDiscriminator)}`,
  );
  console.log(`Program ID: ${launchpad.launchpad.programId.toBase58()}\n`);

  const launchAccounts = await provider.connection.getProgramAccounts(
    launchpad.launchpad.programId,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(launchDiscriminator),
          },
        },
      ],
    },
  );

  console.log(`Found ${launchAccounts.length} Launches`);
  for (const { pubkey } of launchAccounts) {
    await dumpAccount(pubkey, launchesDir, "Launch");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
