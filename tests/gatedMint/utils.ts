import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient, ProgramTestContext } from "solana-bankrun";
import {
  GatedMintClient,
  getGatedMintConfigAddr,
  getWhitelistedUserAddr,
} from "@metadaoproject/programs";

export async function createMintWithFreezeAuthority(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey,
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
      programId: token.TOKEN_PROGRAM_ID,
    }),
    token.createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      mintAuthority,
      freezeAuthority,
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx);

  return mintKeypair.publicKey;
}

export async function setupGatedMint(
  banksClient: BanksClient,
  gatedMintClient: GatedMintClient,
  payer: Keypair,
  admin: PublicKey = payer.publicKey,
  whitelistAdmin: PublicKey | null = null,
  decimals: number = 6,
): Promise<{
  mint: PublicKey;
  gatedMintConfig: PublicKey;
  admin: PublicKey;
}> {
  const mint = await createMintWithFreezeAuthority(
    banksClient,
    payer,
    payer.publicKey,
    payer.publicKey,
    decimals,
  );

  await gatedMintClient
    .initializeGatedMintIx({
      mint,
      currentFreezeAuthority: payer.publicKey,
      admin,
      whitelistAdmin,
      payer: payer.publicKey,
    })
    .rpc();

  const [gatedMintConfig] = getGatedMintConfigAddr({ mint });

  return { mint, gatedMintConfig, admin };
}

export async function whitelistUser(
  gatedMintClient: GatedMintClient,
  mint: PublicKey,
  authority: Keypair,
  user: PublicKey,
  payer: Keypair,
): Promise<PublicKey> {
  const providerKey = gatedMintClient.provider.publicKey;
  const signers: Keypair[] = [];
  if (!authority.publicKey.equals(providerKey)) {
    signers.push(authority);
  }
  if (
    !payer.publicKey.equals(providerKey) &&
    !payer.publicKey.equals(authority.publicKey)
  ) {
    signers.push(payer);
  }

  await gatedMintClient
    .addWhitelistedUserIx({
      mint,
      authority: authority.publicKey,
      user,
      payer: payer.publicKey,
    })
    .signers(signers)
    .rpc();

  const [whitelistedUser] = getWhitelistedUserAddr({ mint, user });
  return whitelistedUser;
}

const TOKEN_ACCOUNT_STATE_OFFSET = 108;
// SPL token account states — the byte at TOKEN_ACCOUNT_STATE_OFFSET.
export const TOKEN_STATE_INITIALIZED = 1;
export const TOKEN_STATE_FROZEN = 2;

// Read the SPL token account state byte (1 = initialized/thawed, 2 = frozen).
export async function getTokenAccountState(
  banksClient: BanksClient,
  tokenAccount: PublicKey,
): Promise<number> {
  const acc = await banksClient.getAccount(tokenAccount);
  if (!acc) {
    throw new Error(`token account ${tokenAccount.toBase58()} not found`);
  }
  return acc.data[TOKEN_ACCOUNT_STATE_OFFSET];
}

// Force a token account into the frozen state by patching its raw account data.
// Reproduces the gated-mint "frozen by default" state without a freeze authority.
export async function freezeTokenAccount(
  context: ProgramTestContext,
  banksClient: BanksClient,
  tokenAccount: PublicKey,
): Promise<void> {
  const acc = await banksClient.getAccount(tokenAccount);
  if (!acc) {
    throw new Error(`token account ${tokenAccount.toBase58()} not found`);
  }
  const data = Buffer.from(acc.data);
  data[TOKEN_ACCOUNT_STATE_OFFSET] = TOKEN_STATE_FROZEN;
  context.setAccount(tokenAccount, {
    data,
    executable: acc.executable,
    owner: acc.owner,
    lamports: acc.lamports,
  });
}
