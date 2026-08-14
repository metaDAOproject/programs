import {
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";

// 1B tokens at 6 decimals — the supply of a pump token.
export const DEFAULT_OLD_SUPPLY = 1_000_000_000n * 10n ** 6n;

// Compiles instructions into a signed v0 transaction, resolving every
// account it can through the given lookup tables.
export async function buildV0Tx({
  banksClient,
  payerKey,
  instructions,
  signers,
  tables,
}: {
  banksClient: BanksClient;
  payerKey: PublicKey;
  instructions: TransactionInstruction[];
  signers: Keypair[];
  tables: AddressLookupTableAccount[];
}): Promise<VersionedTransaction> {
  const [blockhash] = (await banksClient.getLatestBlockhash())!;
  const message = new TransactionMessage({
    payerKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(tables);
  const tx = new VersionedTransaction(message);
  tx.sign(signers);
  return tx;
}

// Classic SPL mints are plain; Token-2022 mints get the pump-style shape:
// metadata pointer + mint-embedded token metadata, the only extensions the
// program's allowlist accepts.
export async function createOldMint(
  banksClient: BanksClient,
  payer: Signer,
  tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
  decimals: number = 6,
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  const rent = await banksClient.getRent();

  const tx = new Transaction();
  if (tokenProgram.equals(token.TOKEN_2022_PROGRAM_ID)) {
    const mintLen = token.getMintLen([token.ExtensionType.MetadataPointer]);
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        // Overfund so the token metadata TLV realloc stays rent-exempt.
        lamports: Number(rent.minimumBalance(BigInt(mintLen + 500))),
        space: mintLen,
        programId: tokenProgram,
      }),
      token.createInitializeMetadataPointerInstruction(
        mint,
        payer.publicKey,
        mint,
        tokenProgram,
      ),
      token.createInitializeMint2Instruction(
        mint,
        decimals,
        payer.publicKey,
        null,
        tokenProgram,
      ),
      token.createInitializeInstruction({
        programId: tokenProgram,
        mint,
        metadata: mint,
        name: "Old Token",
        symbol: "OLD",
        uri: "https://example.com/old.json",
        mintAuthority: payer.publicKey,
        updateAuthority: payer.publicKey,
      }),
    );
  } else {
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint,
        lamports: Number(rent.minimumBalance(BigInt(token.MINT_SIZE))),
        space: token.MINT_SIZE,
        programId: tokenProgram,
      }),
      token.createInitializeMint2Instruction(
        mint,
        decimals,
        payer.publicKey,
        null,
        tokenProgram,
      ),
    );
  }

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx);

  return mint;
}

export type SetupRelaunchParams = {
  banksClient: BanksClient;
  payer: Keypair;
  oldTokenProgram?: PublicKey;
  oldSupply?: bigint;
};

export type RelaunchSetup = {
  oldMint: PublicKey;
  oldTokenProgram: PublicKey;
  payerOldTokenAccount: PublicKey;
};

// Creates a pump-style old mint under the given token program, with the
// initial supply minted to the payer (who funds depositors in tests). The
// payer keeps mint authority so tests can fund depositors directly.
export async function setupRelaunch({
  banksClient,
  payer,
  oldTokenProgram = token.TOKEN_PROGRAM_ID,
  oldSupply = DEFAULT_OLD_SUPPLY,
}: SetupRelaunchParams): Promise<RelaunchSetup> {
  const oldMint = await createOldMint(banksClient, payer, oldTokenProgram);

  const payerOldTokenAccount = token.getAssociatedTokenAddressSync(
    oldMint,
    payer.publicKey,
    false,
    oldTokenProgram,
  );

  const tx = new Transaction().add(
    token.createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      payerOldTokenAccount,
      payer.publicKey,
      oldMint,
      oldTokenProgram,
    ),
    token.createMintToInstruction(
      oldMint,
      payerOldTokenAccount,
      payer.publicKey,
      oldSupply,
      [],
      oldTokenProgram,
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  await banksClient.processTransaction(tx);

  return { oldMint, oldTokenProgram, payerOldTokenAccount };
}
