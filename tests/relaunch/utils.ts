import {
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";

// 1B tokens at 6 decimals — the supply of a pump token.
export const DEFAULT_OLD_SUPPLY = 1_000_000_000n * 10n ** 6n;

export async function createOldMint(
  banksClient: BanksClient,
  payer: Signer,
  tokenProgram: PublicKey = token.TOKEN_PROGRAM_ID,
  decimals: number = 6,
): Promise<PublicKey> {
  const mintKeypair = Keypair.generate();
  const rent = await banksClient.getRent();
  const lamports = Number(rent.minimumBalance(BigInt(token.MINT_SIZE)));

  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      lamports,
      space: token.MINT_SIZE,
      programId: tokenProgram,
    }),
    token.createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      payer.publicKey,
      null,
      tokenProgram,
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx);

  return mintKeypair.publicKey;
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
