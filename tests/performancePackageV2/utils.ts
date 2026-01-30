import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import * as token from "@solana/spl-token";
import { BanksClient } from "solana-bankrun";
import BN from "bn.js";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
  getMintGovernorAddr,
  getMintAuthorityAddr,
  getPerformancePackageV2Addr,
} from "@metadaoproject/futarchy/v0.7";
import type {
  OracleReaderV2,
  RewardFunctionV2,
} from "@metadaoproject/futarchy/v0.7";

/**
 * Creates a mint with the specified authority
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
 * Sets up a mint, mint governor, transfers authority to the governor, and adds a mint authority
 * for the specified authorized minter (typically a performance package PDA).
 */
export async function setupMintGovernorWithAuthority(
  banksClient: BanksClient,
  mintGovernorClient: MintGovernorClient,
  payer: Keypair,
  authorizedMinter: PublicKey,
  maxTotal: BN | null = null,
  decimals: number = 6,
): Promise<{
  mint: PublicKey;
  mintGovernor: PublicKey;
  mintGovernorCreateKey: Keypair;
  mintAuthority: PublicKey;
}> {
  // Create the mint with payer as authority initially
  const mint = await createMintWithAuthority(
    banksClient,
    payer,
    payer.publicKey,
    decimals,
  );

  // Initialize the mint governor
  const mintGovernorCreateKey = Keypair.generate();
  const [mintGovernor] = getMintGovernorAddr({
    mint,
    createKey: mintGovernorCreateKey.publicKey,
  });

  await mintGovernorClient
    .initializeMintGovernorIx({
      mint,
      createKey: mintGovernorCreateKey.publicKey,
      admin: payer.publicKey,
      payer: payer.publicKey,
    })
    .signers([mintGovernorCreateKey])
    .rpc();

  // Transfer authority to the governor
  await mintGovernorClient
    .transferAuthorityToGovernorIx({
      mintGovernor,
      mint,
      currentAuthority: payer.publicKey,
    })
    .rpc();

  // Add mint authority for the authorized minter (e.g., performance package PDA)
  await mintGovernorClient
    .addMintAuthorityIx({
      mintGovernor,
      admin: payer.publicKey,
      authorizedMinter,
      maxTotal,
    })
    .rpc();

  const [mintAuthority] = getMintAuthorityAddr({
    mintGovernor,
    authorizedMinter,
  });

  return {
    mint,
    mintGovernor,
    mintGovernorCreateKey,
    mintAuthority,
  };
}

/**
 * Creates a complete performance package setup including mint, mint governor, and PP account
 */
export async function setupPerformancePackageV2(
  banksClient: BanksClient,
  mintGovernorClient: MintGovernorClient,
  ppClient: PerformancePackageV2Client,
  payer: Keypair,
  {
    authority = payer.publicKey,
    recipient = payer.publicKey,
    oracleReader = { time: {} } as OracleReaderV2,
    rewardFunction,
    minUnlockTimestamp = new BN(0),
    maxTotal = null,
  }: {
    authority?: PublicKey;
    recipient?: PublicKey;
    oracleReader?: OracleReaderV2;
    rewardFunction: RewardFunctionV2;
    minUnlockTimestamp?: BN;
    maxTotal?: BN | null;
  },
): Promise<{
  performancePackage: PublicKey;
  createKey: Keypair;
  mint: PublicKey;
  mintGovernor: PublicKey;
  mintAuthority: PublicKey;
}> {
  const createKey = Keypair.generate();
  const [performancePackage] = getPerformancePackageV2Addr({
    createKey: createKey.publicKey,
  });

  // Setup mint governor with the PP as authorized minter
  const { mint, mintGovernor, mintAuthority } =
    await setupMintGovernorWithAuthority(
      banksClient,
      mintGovernorClient,
      payer,
      performancePackage,
      maxTotal,
    );

  // Initialize the performance package
  await ppClient
    .initializePerformancePackageIx({
      createKey: createKey.publicKey,
      mint,
      mintGovernor,
      mintAuthority,
      authority,
      recipient,
      payer: payer.publicKey,
      oracleReader,
      rewardFunction,
      minUnlockTimestamp,
    })
    .signers([createKey])
    .rpc();

  return {
    performancePackage,
    createKey,
    mint,
    mintGovernor,
    mintAuthority,
  };
}

/**
 * Helper to create a CliffLinear reward function
 */
export function createCliffLinearReward({
  startValue = new BN(0),
  cliffValue = new BN(100),
  endValue = new BN(1000),
  cliffAmount = new BN(100_000_000), // 100 tokens with 6 decimals
  totalAmount = new BN(1_000_000_000), // 1000 tokens with 6 decimals
}: {
  startValue?: BN;
  cliffValue?: BN;
  endValue?: BN;
  cliffAmount?: BN;
  totalAmount?: BN;
} = {}): RewardFunctionV2 {
  return {
    cliffLinear: {
      startValue,
      cliffValue,
      endValue,
      cliffAmount,
      totalAmount,
    },
  } as RewardFunctionV2;
}

/**
 * Helper to create a Threshold reward function
 */
export function createThresholdReward(
  tranches: Array<{ threshold: BN; cumulativeAmount: BN }>,
): RewardFunctionV2 {
  return {
    threshold: {
      tranches,
    },
  } as RewardFunctionV2;
}
