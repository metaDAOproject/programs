import {
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
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
  PriceMath,
  getDaoAddr,
} from "@metadaoproject/futarchy/v0.7";
import type {
  PerformancePackageV2OracleReader,
  PerformancePackageV2RewardFunction,
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
    oracleReader = { time: {} } as PerformancePackageV2OracleReader,
    rewardFunction,
    minUnlockTimestamp = new BN(0),
    maxTotal = null,
  }: {
    authority?: PublicKey;
    recipient?: PublicKey;
    oracleReader?: PerformancePackageV2OracleReader;
    rewardFunction: PerformancePackageV2RewardFunction;
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
  cliffValue = new BN(100),
  endValue = new BN(1000),
  cliffAmount = new BN(100_000_000), // 100 tokens with 6 decimals
  totalAmount = new BN(1_000_000_000), // 1000 tokens with 6 decimals
}: {
  cliffValue?: BN;
  endValue?: BN;
  cliffAmount?: BN;
  totalAmount?: BN;
} = {}): PerformancePackageV2RewardFunction {
  return {
    cliffLinear: {
      cliffValue,
      endValue,
      cliffAmount,
      totalAmount,
    },
  } as PerformancePackageV2RewardFunction;
}

/**
 * Helper to create a Threshold reward function
 */
export function createThresholdReward(
  tranches: Array<{ threshold: BN; cumulativeAmount: BN }>,
): PerformancePackageV2RewardFunction {
  return {
    threshold: {
      tranches,
    },
  } as PerformancePackageV2RewardFunction;
}

/**
 * Helper to create a FutarchyTwap oracle reader
 */
export function createFutarchyTwapOracle({
  amm,
  minDuration = 60, // Default 60 seconds
}: {
  amm: PublicKey;
  minDuration?: number;
}): PerformancePackageV2OracleReader {
  return {
    futarchyTwap: {
      amm,
      minDuration,
      startValue: new BN(0),
      startTime: new BN(0),
      endValue: new BN(0),
      endTime: new BN(0),
    },
  } as PerformancePackageV2OracleReader;
}

const THOUSAND_BUCK_PRICE = PriceMath.getAmmPrice(1000, 6, 6);

/**
 * Sets up a basic DAO for testing FutarchyTwap oracle
 */
export async function setupDaoForTwapTests(context: any): Promise<PublicKey> {
  // Create base and quote mints
  const baseMint = await createMintWithAuthority(
    context.banksClient,
    context.payer,
    context.payer.publicKey,
  );
  const quoteMint = await createMintWithAuthority(
    context.banksClient,
    context.payer,
    context.payer.publicKey,
  );

  // Create token accounts and mint tokens to payer
  const payerBaseAta = token.getAssociatedTokenAddressSync(
    baseMint,
    context.payer.publicKey,
    true,
  );
  const payerQuoteAta = token.getAssociatedTokenAddressSync(
    quoteMint,
    context.payer.publicKey,
    true,
  );

  const createAtaTx = new Transaction().add(
    token.createAssociatedTokenAccountIdempotentInstruction(
      context.payer.publicKey,
      payerBaseAta,
      context.payer.publicKey,
      baseMint,
    ),
    token.createAssociatedTokenAccountIdempotentInstruction(
      context.payer.publicKey,
      payerQuoteAta,
      context.payer.publicKey,
      quoteMint,
    ),
  );
  createAtaTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  createAtaTx.feePayer = context.payer.publicKey;
  createAtaTx.sign(context.payer);
  await context.banksClient.processTransaction(createAtaTx);

  // Mint tokens to payer
  const mintBaseTx = new Transaction().add(
    token.createMintToInstruction(
      baseMint,
      payerBaseAta,
      context.payer.publicKey,
      100_000_000_000, // 100k tokens
    ),
    token.createMintToInstruction(
      quoteMint,
      payerQuoteAta,
      context.payer.publicKey,
      100_000_000_000, // 100k tokens
    ),
  );
  mintBaseTx.recentBlockhash = (
    await context.banksClient.getLatestBlockhash()
  )[0];
  mintBaseTx.feePayer = context.payer.publicKey;
  mintBaseTx.sign(context.payer);
  await context.banksClient.processTransaction(mintBaseTx);

  // Initialize DAO
  const nonce = new BN(Math.floor(Math.random() * 1000000));

  await context.futarchy
    .initializeDaoIx({
      baseMint,
      quoteMint,
      params: {
        secondsPerProposal: 60 * 60 * 24 * 3,
        twapStartDelaySeconds: 60 * 60 * 24,
        twapInitialObservation: THOUSAND_BUCK_PRICE,
        twapMaxObservationChangePerUpdate: THOUSAND_BUCK_PRICE.divn(100),
        minQuoteFutarchicLiquidity: new BN(10_000),
        minBaseFutarchicLiquidity: new BN(10_000),
        passThresholdBps: 300,
        nonce,
        initialSpendingLimit: null,
        baseToStake: new BN(0),
        teamSponsoredPassThresholdBps: 300,
        teamAddress: context.payer.publicKey,
      },
      provideLiquidity: true,
    })
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
    ])
    .rpc();

  const [dao] = getDaoAddr({
    nonce,
    daoCreator: context.payer.publicKey,
  });

  return dao;
}
