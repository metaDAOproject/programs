import {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";
import {
  MintGovernorClient,
  getMintGovernorAddr,
} from "@metadaoproject/futarchy";

/**
 * Creates a mint with the payer as the mint authority
 */
export async function createMintWithAuthority(
  banksClient: BanksClient,
  payer: Keypair,
  mintAuthority: PublicKey,
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
      null, // freeze authority
    ),
  );

  tx.recentBlockhash = (await banksClient.getLatestBlockhash())[0];
  tx.feePayer = payer.publicKey;
  tx.sign(payer, mintKeypair);

  await banksClient.processTransaction(tx);

  return mintKeypair.publicKey;
}

/**
 * Initializes a mint governor for a given mint with the payer as admin
 */
export async function initializeMintGovernorWithDefaults(
  _banksClient: BanksClient,
  mintGovernorClient: MintGovernorClient,
  payer: Keypair,
  mint: PublicKey,
  admin: PublicKey = payer.publicKey,
): Promise<{
  mintGovernor: PublicKey;
  createKey: Keypair;
}> {
  const createKey = Keypair.generate();

  const [mintGovernor] = getMintGovernorAddr({
    mint,
    createKey: createKey.publicKey,
  });

  await mintGovernorClient
    .initializeMintGovernorIx({
      mint,
      createKey: createKey.publicKey,
      admin,
      payer: payer.publicKey,
    })
    .signers([createKey])
    .rpc();

  return {
    mintGovernor,
    createKey,
  };
}

/**
 * Creates a mint and initializes a mint governor for it
 */
export async function createMintAndGovernor(
  banksClient: BanksClient,
  mintGovernorClient: MintGovernorClient,
  payer: Keypair,
  admin: PublicKey = payer.publicKey,
  decimals: number = 6,
): Promise<{
  mint: PublicKey;
  mintGovernor: PublicKey;
  createKey: Keypair;
}> {
  // Create the mint with payer as authority initially
  const mint = await createMintWithAuthority(
    banksClient,
    payer,
    payer.publicKey,
    decimals,
  );

  // Initialize the governor
  const { mintGovernor, createKey } = await initializeMintGovernorWithDefaults(
    banksClient,
    mintGovernorClient,
    payer,
    mint,
    admin,
  );

  return {
    mint,
    mintGovernor,
    createKey,
  };
}

/**
 * Creates a mint, initializes a governor, and transfers authority to the governor
 */
export async function setupMintWithGovernor(
  banksClient: BanksClient,
  mintGovernorClient: MintGovernorClient,
  payer: Keypair,
  admin: PublicKey = payer.publicKey,
  decimals: number = 6,
): Promise<{
  mint: PublicKey;
  mintGovernor: PublicKey;
  createKey: Keypair;
}> {
  const { mint, mintGovernor, createKey } = await createMintAndGovernor(
    banksClient,
    mintGovernorClient,
    payer,
    admin,
    decimals,
  );

  // Transfer authority to the governor
  await mintGovernorClient
    .transferAuthorityToGovernorIx({
      mintGovernor,
      mint,
      currentAuthority: payer.publicKey,
    })
    .rpc();

  return {
    mint,
    mintGovernor,
    createKey,
  };
}
