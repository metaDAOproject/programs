import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import { FUTARCHY_V0_6_PROGRAM_ID } from "@metadaoproject/programs";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createHash } from "crypto";
import { METADAO_MULTISIG } from "../utils/adminApproval.js";
import {
  IDL_ACCOUNT_HEADER_LEN,
  decodeIdlAccount,
  getIdlAddress,
  idlCreateBufferIx,
  idlSetAuthorityIx,
  idlWriteIx,
} from "../utils/idlInstructions.js";
import { sendAndConfirm } from "../utils/transactions.js";

// Copies a program's live on-chain IDL, byte for byte, into a new IDL buffer
// owned by the ops multisig vault. proposeIdlAccountResize.ts then copies the
// buffer back into a larger IDL account.

const PROGRAM_ID = FUTARCHY_V0_6_PROGRAM_ID;
const MULTISIG = METADAO_MULTISIG;

// Bytes per write transaction, the chunk size `anchor idl write-buffer` uses.
const WRITE_CHUNK_SIZE = 600;

const provider = anchor.AnchorProvider.env();
const payer: Keypair = provider.wallet["payer"];
const connection = provider.connection;

const send = async (transaction: Transaction, signers: Keypair[] = []) => {
  transaction.recentBlockhash = (
    await connection.getLatestBlockhash()
  ).blockhash;
  transaction.feePayer = payer.publicKey;
  transaction.sign(payer, ...signers);
  return sendAndConfirm(provider, transaction);
};

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [vault] = multisig.getVaultPda({ multisigPda: MULTISIG, index: 0 });
  const { idlAddress } = await getIdlAddress(PROGRAM_ID);

  const idlAccount = await connection.getAccountInfo(idlAddress, "confirmed");
  if (!idlAccount || !idlAccount.owner.equals(PROGRAM_ID)) {
    throw new Error(
      `No IDL account for ${PROGRAM_ID.toBase58()} at ${idlAddress.toBase58()}`,
    );
  }
  const { authority, payload } = decodeIdlAccount(idlAccount.data);
  if (!authority.equals(vault)) {
    throw new Error(
      `IDL authority is ${authority.toBase58()}, not the vault ${vault.toBase58()}`,
    );
  }
  console.log("Program:", PROGRAM_ID.toBase58());
  console.log("IDL account:", idlAddress.toBase58());
  console.log(
    `IDL payload: ${payload.length} bytes, sha256 ${sha256(payload)}`,
  );

  const buffer = Keypair.generate();
  const space = IDL_ACCOUNT_HEADER_LEN + payload.length;
  const lamports = await connection.getMinimumBalanceForRentExemption(space);
  await send(
    new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: buffer.publicKey,
        space,
        lamports,
        programId: PROGRAM_ID,
      }),
      idlCreateBufferIx({
        programId: PROGRAM_ID,
        buffer: buffer.publicKey,
        authority: payer.publicKey,
      }),
    ),
    [buffer],
  );
  console.log("IDL buffer created:", buffer.publicKey.toBase58());

  for (let offset = 0; offset < payload.length; offset += WRITE_CHUNK_SIZE) {
    const chunk = payload.subarray(offset, offset + WRITE_CHUNK_SIZE);
    await send(
      new Transaction().add(
        idlWriteIx({
          programId: PROGRAM_ID,
          idl: buffer.publicKey,
          authority: payer.publicKey,
          data: chunk,
        }),
      ),
    );
    console.log(`Wrote ${offset + chunk.length}/${payload.length} bytes`);
  }

  await send(
    new Transaction().add(
      idlSetAuthorityIx({
        programId: PROGRAM_ID,
        idl: buffer.publicKey,
        authority: payer.publicKey,
        newAuthority: vault,
      }),
    ),
  );

  const bufferAccount = await connection.getAccountInfo(
    buffer.publicKey,
    "confirmed",
  );
  const staged = decodeIdlAccount(bufferAccount!.data);
  if (!staged.payload.equals(payload) || !staged.authority.equals(vault)) {
    throw new Error("The buffer does not match the live IDL");
  }
  console.log(
    `Buffer verified: ${staged.payload.length} bytes, same as the live IDL, authority ${vault.toBase58()}`,
  );
  console.log(
    `Set IDL_BUFFER_ADDRESS in proposeIdlAccountResize.ts to ${buffer.publicKey.toBase58()}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
