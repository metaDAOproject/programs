import * as token from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { BanksClient } from "./client.js";
import { ProgramTestContext } from "./context.js";

// Ports of the spl-token-bankrun 0.2.6 helpers (https://github.com/metaDAOproject/spl-token-bankrun,
// https://www.npmjs.com/package/spl-token-bankrun), same signatures, served by the LiteSVM facade.

export async function createMint(
  banksClient: BanksClient,
  payer: Signer,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey | null,
  decimals: number,
  keypair = Keypair.generate(),
  programId = token.TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
  const rent = await banksClient.getRent();
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space: token.MINT_SIZE,
      lamports: Number(rent.minimumBalance(BigInt(token.MINT_SIZE))),
      programId,
    }),
    token.createInitializeMint2Instruction(
      keypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
      programId,
    ),
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, keypair);
  await banksClient.processTransaction(tx);
  return keypair.publicKey;
}

export async function createAccount(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  keypair?: Keypair,
  programId = token.TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
  if (!keypair) {
    return createAssociatedTokenAccount(
      banksClient,
      payer,
      mint,
      owner,
      programId,
    );
  }
  const rent = await banksClient.getRent();
  const mintState = await getMint(banksClient, mint, undefined, programId);
  const space = token.getAccountLenForMint(mintState);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: keypair.publicKey,
      space,
      lamports: Number(rent.minimumBalance(BigInt(space))),
      programId,
    }),
    token.createInitializeAccountInstruction(
      keypair.publicKey,
      mint,
      owner,
      programId,
    ),
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, keypair);
  await banksClient.processTransaction(tx);
  return keypair.publicKey;
}

export async function createAssociatedTokenAccount(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  owner: PublicKey,
  programId = token.TOKEN_PROGRAM_ID,
  associatedTokenProgramId = token.ASSOCIATED_TOKEN_PROGRAM_ID,
): Promise<PublicKey> {
  const associatedToken = token.getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    programId,
    associatedTokenProgramId,
  );
  const tx = new Transaction().add(
    token.createAssociatedTokenAccountInstruction(
      payer.publicKey,
      associatedToken,
      owner,
      mint,
      programId,
      associatedTokenProgramId,
    ),
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer);
  await banksClient.processTransaction(tx);
  return associatedToken;
}

export async function getMint(
  banksClient: BanksClient,
  address: PublicKey,
  _commitment?: unknown,
  programId = token.TOKEN_PROGRAM_ID,
): Promise<token.Mint> {
  const info = await banksClient.getAccount(address);
  return token.unpackMint(
    address,
    info ? { ...info, data: Buffer.from(info.data) } : null,
    programId,
  );
}

export async function getAccount(
  banksClient: BanksClient,
  address: PublicKey,
  _commitment?: unknown,
  programId = token.TOKEN_PROGRAM_ID,
): Promise<token.Account> {
  const info = await banksClient.getAccount(address);
  return token.unpackAccount(
    address,
    info ? { ...info, data: Buffer.from(info.data) } : null,
    programId,
  );
}

// Sets a token account's balance directly, without the mint authority.
export async function mintToOverride(
  context: ProgramTestContext,
  destination: PublicKey,
  amount: bigint,
): Promise<void> {
  const existing = await getAccount(context.banksClient, destination);
  const data = Buffer.alloc(token.ACCOUNT_SIZE);
  token.AccountLayout.encode(
    {
      mint: existing.mint,
      owner: existing.owner,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      delegatedAmount: 0n,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    data,
  );
  context.setAccount(destination, {
    data,
    executable: false,
    lamports: 1_000_000_000,
    owner: token.TOKEN_PROGRAM_ID,
  });
}

export async function mintTo(
  banksClient: BanksClient,
  payer: Signer,
  mint: PublicKey,
  destination: PublicKey,
  authority: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID,
) {
  const [authorityPublicKey, signers] = getSigners(authority, multiSigners);
  const tx = new Transaction().add(
    token.createMintToInstruction(
      mint,
      destination,
      authorityPublicKey,
      amount,
      multiSigners,
      programId,
    ),
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, ...signers);
  return banksClient.processTransaction(tx);
}

export async function transfer(
  banksClient: BanksClient,
  payer: Signer,
  source: PublicKey,
  destination: PublicKey,
  owner: Signer | PublicKey,
  amount: number | bigint,
  multiSigners: Signer[] = [],
  programId = token.TOKEN_PROGRAM_ID,
) {
  const [ownerPublicKey, signers] = getSigners(owner, multiSigners);
  const tx = new Transaction().add(
    token.createTransferInstruction(
      source,
      destination,
      ownerPublicKey,
      amount,
      multiSigners,
      programId,
    ),
  );
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.sign(payer, ...signers);
  return banksClient.processTransaction(tx);
}

export function getSigners(
  signerOrMultisig: Signer | PublicKey,
  multiSigners: Signer[],
): [PublicKey, Signer[]] {
  return signerOrMultisig instanceof PublicKey
    ? [signerOrMultisig, multiSigners]
    : [signerOrMultisig.publicKey, [signerOrMultisig]];
}
