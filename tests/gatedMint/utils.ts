import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";
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
