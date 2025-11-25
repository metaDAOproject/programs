import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import bs58 from "bs58";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function createIdlUpgradeTransaction(
  programId,
  bufferAddress,
  upgradeAuthority,
  connection,
) {
  // Derive IDL address
  const idlAddr = await anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("anchor:idl"), programId.toBuffer()],
    programId,
  );

  console.log("IDL Address:", idlAddr.toString());
  console.log("Buffer:", bufferAddress.toString());
  console.log("Authority:", upgradeAuthority.toString());

  // Create IDL upgrade instruction
  const data = Buffer.from([
    0x40, 0xf4, 0xbc, 0x78, 0xa7, 0xe9, 0x69, 0x0a, 0x03,
  ]);

  const idlUpgradeIx = new TransactionInstruction({
    keys: [
      { pubkey: bufferAddress, isWritable: true, isSigner: false },
      { pubkey: idlAddr, isWritable: true, isSigner: false },
      { pubkey: upgradeAuthority, isWritable: true, isSigner: true },
    ],
    programId,
    data,
  });

  // Create transaction
  const tx = new Transaction();
  tx.add(idlUpgradeIx);

  // Set recent blockhash and fee payer
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = vaultPda;

  // Serialize to base58
  const serializedTx = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const base58Tx = bs58.encode(serializedTx);

  console.log("\n=== Base58 Encoded Transaction ===");
  console.log(base58Tx);
  console.log("\n1. Copy this base58 string");
  console.log(
    "2. Go to Squads UI > Your Squad > Developers > TX Builder > import base58 encoded tx",
  );
  console.log("3. Paste the base58 string");
  // go from here

  return base58Tx;
}

// Usage
const programId = new PublicKey("MooNyh4CBUYEKyXVnjGYQ8mEiJDpGvJMdvrZx1iGeHV");
// input based on desired idl
const bufferAddress = new PublicKey("YOUR_IDL_BUFFER");
// generate this in the script?
const vaultPda = new PublicKey("6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf");
// hardcode this
const connection = new Connection(
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    "https://api.mainnet-beta.solana.com",
);

const base58Tx = await createIdlUpgradeTransaction(
  programId,
  bufferAddress,
  vaultPda,
  connection,
);
