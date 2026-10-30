import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";

// Every Anchor IDL instruction starts with this tag, then the variant byte.
const IDL_IX_TAG = Buffer.from("40f4bc78a7e9690a", "hex");

// IDL account layout: 8-byte discriminator, 32-byte authority, 4-byte payload
// length, then the zlib-compressed IDL JSON.
export const IDL_ACCOUNT_HEADER_LEN = 44;

enum IdlInstruction {
  Create = 0,
  CreateBuffer = 1,
  Write = 2,
  SetBuffer = 3,
  SetAuthority = 4,
  Close = 5,
  Resize = 6,
}

const u32 = (value: number) => {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
};

const u64 = (value: number) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
};

const encode = (variant: IdlInstruction, ...fields: Buffer[]) =>
  Buffer.concat([IDL_IX_TAG, Buffer.from([variant]), ...fields]);

// The canonical IDL account of a program and the PDA that signs its creation.
export const getIdlAddress = async (programId: PublicKey) => {
  const [base] = PublicKey.findProgramAddressSync([], programId);
  const idlAddress = await PublicKey.createWithSeed(
    base,
    "anchor:idl",
    programId,
  );
  return { base, idlAddress };
};

export const decodeIdlAccount = (data: Buffer) => {
  const authority = new PublicKey(data.subarray(8, 40));
  const payloadLength = data.readUInt32LE(40);
  return {
    authority,
    payload: data.subarray(
      IDL_ACCOUNT_HEADER_LEN,
      IDL_ACCOUNT_HEADER_LEN + payloadLength,
    ),
  };
};

// Creates the canonical IDL account, capped at 10,000 bytes, with `from` as
// its authority.
export const idlCreateIx = ({
  programId,
  from,
  idlAddress,
  base,
  dataLen,
}: {
  programId: PublicKey;
  from: PublicKey;
  idlAddress: PublicKey;
  base: PublicKey;
  dataLen: number;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: idlAddress, isSigner: false, isWritable: true },
      { pubkey: base, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: programId, isSigner: false, isWritable: false },
    ],
    data: encode(IdlInstruction.Create, u64(dataLen)),
  });

// Initializes a buffer account already allocated to the program.
export const idlCreateBufferIx = ({
  programId,
  buffer,
  authority,
}: {
  programId: PublicKey;
  buffer: PublicKey;
  authority: PublicKey;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: encode(IdlInstruction.CreateBuffer),
  });

// Appends bytes to an IDL account or buffer.
export const idlWriteIx = ({
  programId,
  idl,
  authority,
  data,
}: {
  programId: PublicKey;
  idl: PublicKey;
  authority: PublicKey;
  data: Buffer;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: idl, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: encode(IdlInstruction.Write, u32(data.length), data),
  });

// Copies a buffer's bytes into the IDL account.
export const idlSetBufferIx = ({
  programId,
  buffer,
  idl,
  authority,
}: {
  programId: PublicKey;
  buffer: PublicKey;
  idl: PublicKey;
  authority: PublicKey;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: buffer, isSigner: false, isWritable: true },
      { pubkey: idl, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: encode(IdlInstruction.SetBuffer),
  });

export const idlSetAuthorityIx = ({
  programId,
  idl,
  authority,
  newAuthority,
}: {
  programId: PublicKey;
  idl: PublicKey;
  authority: PublicKey;
  newAuthority: PublicKey;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: idl, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: encode(IdlInstruction.SetAuthority, newAuthority.toBuffer()),
  });

// Closes an IDL account or buffer, sending its lamports to `solDestination`.
export const idlCloseIx = ({
  programId,
  account,
  authority,
  solDestination,
}: {
  programId: PublicKey;
  account: PublicKey;
  authority: PublicKey;
  solDestination: PublicKey;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: solDestination, isSigner: false, isWritable: true },
    ],
    data: encode(IdlInstruction.Close),
  });

// Grows an empty IDL account by up to 10,000 bytes towards `dataLen` bytes in
// total, with the authority paying the extra rent.
export const idlResizeIx = ({
  programId,
  idl,
  authority,
  dataLen,
}: {
  programId: PublicKey;
  idl: PublicKey;
  authority: PublicKey;
  dataLen: number;
}) =>
  new TransactionInstruction({
    programId,
    keys: [
      { pubkey: idl, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encode(IdlInstruction.Resize, u64(dataLen)),
  });
