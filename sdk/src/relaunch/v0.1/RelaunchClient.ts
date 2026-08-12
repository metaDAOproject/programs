import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMint2Instruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  MAINNET_USDC,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEES_PROGRAM_ID,
  RELAUNCH_V0_1_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_ID,
  WHIRLPOOL_PROGRAM_ID,
} from "../../constants.js";
import { getDaoAddr } from "../../futarchy/v0.6/index.js";
import {
  RelaunchProgram,
  RelaunchIDL,
  RelaunchAccount,
  DepositRecordAccount,
} from "./types/index.js";
import {
  getRelaunchAddr,
  getRelaunchSignerAddr,
  getDepositRecordAddr,
} from "./pda.js";
import {
  getPumpCreatorVaultAuthorityAddr,
  getPumpPoolV2Addr,
  getPumpUserVolumeAccumulatorAddr,
  parsePumpGlobalConfig,
  parsePumpPool,
  PUMP_AMM_EVENT_AUTHORITY,
  PUMP_AMM_FEE_CONFIG,
  PUMP_AMM_GLOBAL_CONFIG,
  PUMP_AMM_GLOBAL_VOLUME_ACCUMULATOR,
} from "./pumpAmm.js";
import {
  getWhirlpoolOracleAddr,
  getWhirlpoolSwapTickArrayAddrs,
  MEMO_PROGRAM_ID,
  parseWhirlpool,
  USDC_SWAP_POOL,
} from "./whirlpool.js";
import { getEventAuthorityAddr, getMetadataAddr } from "../../pda.js";

export type CreateRelaunchClientParams = {
  provider: AnchorProvider;
  relaunchProgramId?: PublicKey;
};

export class RelaunchClient {
  public readonly provider: AnchorProvider;
  public readonly relaunchProgram: Program<RelaunchProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, relaunchProgramId: PublicKey) {
    this.provider = provider;
    this.programId = relaunchProgramId;
    this.relaunchProgram = new Program<RelaunchProgram>(
      RelaunchIDL,
      relaunchProgramId,
      provider,
    );
  }

  public static createClient(
    createRelaunchClientParams: CreateRelaunchClientParams,
  ): RelaunchClient {
    let { provider, relaunchProgramId } = createRelaunchClientParams;

    return new RelaunchClient(
      provider,
      relaunchProgramId || RELAUNCH_V0_1_PROGRAM_ID,
    );
  }

  public getProgramId(): PublicKey {
    return this.programId;
  }

  initializeRelaunchIx({
    newMint,
    oldMint,
    oldTokenProgram,
    sourcePool,
    sourceQuoteMint,
    tokenName,
    tokenSymbol,
    tokenUri,
    secondsForDeposits,
    gracePeriodSeconds,
    thresholdBps,
    // Zero amount with no members initializes without a spending limit.
    monthlySpendingLimitAmount = new BN(0),
    monthlySpendingLimitMembers = [],
    teamAddress,
    mintAuthority = this.provider.publicKey,
    admin = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    newMint: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    sourcePool: PublicKey;
    sourceQuoteMint: PublicKey;
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    secondsForDeposits: number;
    gracePeriodSeconds: number;
    thresholdBps: number;
    monthlySpendingLimitAmount?: BN;
    monthlySpendingLimitMembers?: PublicKey[];
    teamAddress: PublicKey;
    mintAuthority?: PublicKey;
    admin?: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunch = this.getRelaunchAddress({ newMint });
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const newTokenVault = getAssociatedTokenAddressSync(
      newMint,
      relaunchSigner,
      true,
    );
    const sourceQuoteVault = getAssociatedTokenAddressSync(
      sourceQuoteMint,
      relaunchSigner,
      true,
    );
    const usdcVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      relaunchSigner,
      true,
    );
    const [tokenMetadata] = getMetadataAddr(newMint);

    return this.relaunchProgram.methods
      .initializeRelaunch({
        tokenName,
        tokenSymbol,
        tokenUri,
        secondsForDeposits,
        gracePeriodSeconds,
        thresholdBps,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers,
        teamAddress,
      })
      .accounts({
        relaunch,
        newMint,
        mintAuthority,
        relaunchSigner,
        oldMint,
        sourcePool,
        sourceQuoteMint,
        usdcMint: MAINNET_USDC,
        oldTokenVault,
        newTokenVault,
        sourceQuoteVault,
        usdcVault,
        tokenMetadata,
        admin,
        payer,
        oldTokenProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ]);
  }

  startDepositsIx({
    relaunch,
    admin = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    admin?: PublicKey;
  }) {
    return this.relaunchProgram.methods.startDeposits().accounts({
      relaunch,
      admin,
    });
  }

  depositIx({
    relaunch,
    oldMint,
    oldTokenProgram,
    amount,
    depositor = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    amount: BN;
    depositor?: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const depositorTokenAccount = getAssociatedTokenAddressSync(
      oldMint,
      depositor,
      false,
      oldTokenProgram,
    );

    return this.relaunchProgram.methods.deposit({ amount }).accounts({
      relaunch,
      depositRecord,
      oldMint,
      oldTokenVault,
      depositor,
      depositorTokenAccount,
      payer,
      oldTokenProgram,
    });
  }

  closeDepositsIx({ relaunch }: { relaunch: PublicKey }) {
    return this.relaunchProgram.methods.closeDeposits().accounts({
      relaunch,
    });
  }

  depositViaBuyIx({
    relaunch,
    oldMint,
    oldTokenProgram,
    sourceQuoteMint,
    sourcePool,
    poolBaseTokenAccount,
    poolQuoteTokenAccount,
    coinCreator,
    protocolFeeRecipient,
    buybackFeeRecipient,
    baseOut,
    maxQuoteIn,
    depositor = this.provider.publicKey,
    payer = this.provider.publicKey,
    depositorQuoteAccount = getAssociatedTokenAddressSync(
      sourceQuoteMint,
      depositor,
    ),
  }: {
    relaunch: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    sourceQuoteMint: PublicKey;
    sourcePool: PublicKey;
    poolBaseTokenAccount: PublicKey;
    poolQuoteTokenAccount: PublicKey;
    coinCreator: PublicKey;
    protocolFeeRecipient: PublicKey;
    buybackFeeRecipient: PublicKey;
    baseOut: BN;
    maxQuoteIn: BN;
    depositor?: PublicKey;
    payer?: PublicKey;
    depositorQuoteAccount?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const sourceQuoteVault = getAssociatedTokenAddressSync(
      sourceQuoteMint,
      relaunchSigner,
      true,
    );
    const coinCreatorVaultAuthority =
      getPumpCreatorVaultAuthorityAddr(coinCreator);

    return this.relaunchProgram.methods
      .depositViaBuy({ baseOut, maxQuoteIn })
      .accounts({
        relaunch,
        depositRecord,
        depositor,
        payer,
        relaunchSigner,
        oldMint,
        sourceQuoteMint,
        oldTokenVault,
        sourceQuoteVault,
        depositorQuoteAccount,
        sourcePool,
        pumpGlobalConfig: PUMP_AMM_GLOBAL_CONFIG,
        protocolFeeRecipient,
        protocolFeeRecipientTokenAccount: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          protocolFeeRecipient,
          true,
        ),
        poolBaseTokenAccount,
        poolQuoteTokenAccount,
        coinCreatorVaultAta: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          coinCreatorVaultAuthority,
          true,
        ),
        coinCreatorVaultAuthority,
        globalVolumeAccumulator: PUMP_AMM_GLOBAL_VOLUME_ACCUMULATOR,
        userVolumeAccumulator: getPumpUserVolumeAccumulatorAddr(relaunchSigner),
        pumpFeeConfig: PUMP_AMM_FEE_CONFIG,
        pumpFeeProgram: PUMP_FEES_PROGRAM_ID,
        poolV2: getPumpPoolV2Addr(oldMint),
        buybackFeeRecipient,
        buybackFeeRecipientTokenAccount: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          buybackFeeRecipient,
          true,
        ),
        pumpEventAuthority: PUMP_AMM_EVENT_AUTHORITY,
        pumpAmmProgram: PUMP_AMM_PROGRAM_ID,
        baseTokenProgram: oldTokenProgram,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ]);
  }

  executeSellIx({
    relaunch,
    oldMint,
    oldTokenProgram,
    sourceQuoteMint,
    sourcePool,
    poolBaseTokenAccount,
    poolQuoteTokenAccount,
    coinCreator,
    protocolFeeRecipient,
    buybackFeeRecipient,
    minQuoteOut,
    admin = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    sourceQuoteMint: PublicKey;
    sourcePool: PublicKey;
    poolBaseTokenAccount: PublicKey;
    poolQuoteTokenAccount: PublicKey;
    coinCreator: PublicKey;
    protocolFeeRecipient: PublicKey;
    buybackFeeRecipient: PublicKey;
    minQuoteOut: BN;
    admin?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const sourceQuoteVault = getAssociatedTokenAddressSync(
      sourceQuoteMint,
      relaunchSigner,
      true,
    );
    const coinCreatorVaultAuthority =
      getPumpCreatorVaultAuthorityAddr(coinCreator);

    return this.relaunchProgram.methods
      .executeSell({ minQuoteOut })
      .accounts({
        relaunch,
        admin,
        relaunchSigner,
        oldMint,
        sourceQuoteMint,
        oldTokenVault,
        sourceQuoteVault,
        sourcePool,
        pumpGlobalConfig: PUMP_AMM_GLOBAL_CONFIG,
        protocolFeeRecipient,
        protocolFeeRecipientTokenAccount: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          protocolFeeRecipient,
          true,
        ),
        poolBaseTokenAccount,
        poolQuoteTokenAccount,
        coinCreatorVaultAta: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          coinCreatorVaultAuthority,
          true,
        ),
        coinCreatorVaultAuthority,
        pumpFeeConfig: PUMP_AMM_FEE_CONFIG,
        pumpFeeProgram: PUMP_FEES_PROGRAM_ID,
        poolV2: getPumpPoolV2Addr(oldMint),
        buybackFeeRecipient,
        buybackFeeRecipientTokenAccount: getAssociatedTokenAddressSync(
          sourceQuoteMint,
          buybackFeeRecipient,
          true,
        ),
        pumpEventAuthority: PUMP_AMM_EVENT_AUTHORITY,
        pumpAmmProgram: PUMP_AMM_PROGRAM_ID,
        baseTokenProgram: oldTokenProgram,
        quoteTokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
      ]);
  }

  executeUsdcSwapIx({
    relaunch,
    whirlpoolWsolVault,
    whirlpoolUsdcVault,
    tickArrays,
    minUsdcOut,
    whirlpool = USDC_SWAP_POOL,
    admin = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    whirlpoolWsolVault: PublicKey;
    whirlpoolUsdcVault: PublicKey;
    tickArrays: [PublicKey, PublicKey, PublicKey];
    minUsdcOut: BN;
    whirlpool?: PublicKey;
    admin?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });

    const sourceQuoteVault = getAssociatedTokenAddressSync(
      NATIVE_MINT,
      relaunchSigner,
      true,
    );
    const usdcVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      relaunchSigner,
      true,
    );

    return this.relaunchProgram.methods
      .executeUsdcSwap({ minUsdcOut })
      .accounts({
        relaunch,
        admin,
        relaunchSigner,
        sourceQuoteVault,
        usdcVault,
        whirlpool,
        wsolMint: NATIVE_MINT,
        usdcMint: MAINNET_USDC,
        whirlpoolWsolVault,
        whirlpoolUsdcVault,
        tickArray0: tickArrays[0],
        tickArray1: tickArrays[1],
        tickArray2: tickArrays[2],
        oracle: getWhirlpoolOracleAddr(whirlpool),
        memoProgram: MEMO_PROGRAM_ID,
        whirlpoolProgram: WHIRLPOOL_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      });
  }

  // Swaps the whole WSOL vault to USDC as the admin (the provider wallet),
  // deriving the whirlpool account set from the pinned pool's live state.
  // When minUsdcOut is not given, it is computed from the pool's spot price
  // minus slippageBps (which must also cover the swap fee + price impact).
  async executeUsdcSwap({
    relaunch,
    minUsdcOut,
    slippageBps = 100,
  }: {
    relaunch: PublicKey;
    minUsdcOut?: BN;
    slippageBps?: number;
  }): Promise<TransactionSignature> {
    const whirlpoolAccount =
      await this.provider.connection.getAccountInfo(USDC_SWAP_POOL);
    if (whirlpoolAccount === null) {
      throw new Error(`whirlpool ${USDC_SWAP_POOL.toBase58()} does not exist`);
    }
    const whirlpool = parseWhirlpool(whirlpoolAccount.data);

    if (minUsdcOut === undefined) {
      const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
      const wsolIn = await this.fetchTokenBalance(
        getAssociatedTokenAddressSync(NATIVE_MINT, relaunchSigner, true),
      );
      // Spot price in USDC-raw per WSOL-raw is (sqrtPrice / 2^64)^2.
      const spotOut =
        (wsolIn * whirlpool.sqrtPrice * whirlpool.sqrtPrice) >> 128n;
      const floor = (spotOut * (10_000n - BigInt(slippageBps))) / 10_000n;
      minUsdcOut = new BN(floor.toString());
    }

    return this.executeUsdcSwapIx({
      relaunch,
      whirlpoolWsolVault: whirlpool.tokenVaultA,
      whirlpoolUsdcVault: whirlpool.tokenVaultB,
      tickArrays: getWhirlpoolSwapTickArrayAddrs(
        USDC_SWAP_POOL,
        whirlpool.tickCurrentIndex,
        whirlpool.tickSpacing,
        true,
      ),
      minUsdcOut,
    }).rpc();
  }

  completeRelaunchIx({
    relaunch,
    newMint,
    payer = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    newMint: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });

    const newTokenVault = getAssociatedTokenAddressSync(
      newMint,
      relaunchSigner,
      true,
    );
    const usdcVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      relaunchSigner,
      true,
    );
    const [tokenMetadata] = getMetadataAddr(newMint);

    const [dao] = getDaoAddr({ nonce: new BN(0), daoCreator: relaunchSigner });
    const [futarchyEventAuthority] = getEventAuthorityAddr(
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [multisigVault] = multisig.getVaultPda({ multisigPda, index: 0 });
    const [spendingLimit] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    });

    const [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), multisigVault.toBuffer()],
      FUTARCHY_V0_6_PROGRAM_ID,
    );

    return this.relaunchProgram.methods
      .completeRelaunch()
      .accounts({
        relaunch,
        payer,
        relaunchSigner,
        newMint,
        usdcMint: MAINNET_USDC,
        newTokenVault,
        usdcVault,
        tokenMetadata,
        dao,
        futarchyAmmBaseVault: getAssociatedTokenAddressSync(newMint, dao, true),
        futarchyAmmQuoteVault: getAssociatedTokenAddressSync(
          MAINNET_USDC,
          dao,
          true,
        ),
        ammPosition,
        squadsMultisig: multisigPda,
        squadsMultisigVault: multisigVault,
        spendingLimit,
        squadsProgramConfig: SQUADS_PROGRAM_CONFIG,
        squadsProgramConfigTreasury: SQUADS_PROGRAM_CONFIG_TREASURY,
        treasuryUsdcAccount: getAssociatedTokenAddressSync(
          MAINNET_USDC,
          multisigVault,
          true,
        ),
        futarchyProgram: FUTARCHY_V0_6_PROGRAM_ID,
        futarchyEventAuthority,
        squadsProgram: SQUADS_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
      ]);
  }

  // Completes the relaunch as any cranker (the provider wallet), reading the
  // new mint from the stored relaunch.
  async completeRelaunch({
    relaunch,
  }: {
    relaunch: PublicKey;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    return this.completeRelaunchIx({
      relaunch,
      newMint: storedRelaunch.newMint,
    }).rpc();
  }

  markFailedIx({ relaunch }: { relaunch: PublicKey }) {
    return this.relaunchProgram.methods.markFailed().accounts({
      relaunch,
    });
  }

  claimRefundIx({
    relaunch,
    oldMint,
    oldTokenProgram,
    depositor = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    depositor?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const depositorTokenAccount = getAssociatedTokenAddressSync(
      oldMint,
      depositor,
      false,
      oldTokenProgram,
    );

    return this.relaunchProgram.methods.claimRefund().accounts({
      relaunch,
      depositRecord,
      oldMint,
      oldTokenVault,
      relaunchSigner,
      depositor,
      depositorTokenAccount,
      oldTokenProgram,
    });
  }

  claimIx({
    relaunch,
    newMint,
    depositor = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    newMint: PublicKey;
    depositor?: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });

    const newTokenVault = getAssociatedTokenAddressSync(
      newMint,
      relaunchSigner,
      true,
    );
    const depositorTokenAccount = getAssociatedTokenAddressSync(
      newMint,
      depositor,
      false,
    );

    return this.relaunchProgram.methods
      .claim()
      .accounts({
        relaunch,
        depositRecord,
        newMint,
        newTokenVault,
        relaunchSigner,
        depositor,
        depositorTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          depositorTokenAccount,
          depositor,
          newMint,
        ),
      ]);
  }

  // Deposits from the provider wallet, reading the old mint and its owner
  // program from the stored relaunch.
  async deposit({
    relaunch,
    amount,
  }: {
    relaunch: PublicKey;
    amount: BN;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    const oldMintAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.oldMint,
    );
    if (oldMintAccount === null) {
      throw new Error(
        `old mint ${storedRelaunch.oldMint.toBase58()} does not exist`,
      );
    }

    return this.depositIx({
      relaunch,
      oldMint: storedRelaunch.oldMint,
      oldTokenProgram: oldMintAccount.owner,
      amount,
    }).rpc();
  }

  // Buys baseOut old tokens off the source pool as the provider wallet and
  // credits them as a deposit, deriving the pump account set like
  // executeSell. When maxQuoteIn is not given, it is computed live from the
  // pool reserves: the constant-product input for the exact output plus
  // slippageBps (which must also cover pump's swap fees). For WSOL-quoted
  // pools, any shortfall in the depositor's WSOL ATA is wrapped from SOL in
  // a separate preparatory transaction — the buy transaction sits within a
  // few bytes of the 1232-byte legacy size limit and cannot absorb the wrap
  // instructions for Token-2022 old mints.
  async depositViaBuy({
    relaunch,
    baseOut,
    maxQuoteIn,
    slippageBps = 100,
  }: {
    relaunch: PublicKey;
    baseOut: BN;
    maxQuoteIn?: BN;
    slippageBps?: number;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    const oldMintAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.oldMint,
    );
    if (oldMintAccount === null) {
      throw new Error(
        `old mint ${storedRelaunch.oldMint.toBase58()} does not exist`,
      );
    }

    const poolAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.sourcePool,
    );
    if (poolAccount === null) {
      throw new Error(
        `source pool ${storedRelaunch.sourcePool.toBase58()} does not exist`,
      );
    }
    const pool = parsePumpPool(poolAccount.data);

    const globalConfigAccount = await this.provider.connection.getAccountInfo(
      PUMP_AMM_GLOBAL_CONFIG,
    );
    if (globalConfigAccount === null) {
      throw new Error("pump_amm global config does not exist");
    }
    const globalConfig = parsePumpGlobalConfig(globalConfigAccount.data);

    if (maxQuoteIn === undefined) {
      const [baseReserve, quoteReserve] = await Promise.all(
        [pool.poolBaseTokenAccount, pool.poolQuoteTokenAccount].map((address) =>
          this.fetchTokenBalance(address),
        ),
      );
      const baseOutBig = BigInt(baseOut.toString());
      if (baseOutBig >= baseReserve) {
        throw new Error(
          `baseOut ${baseOutBig} exceeds the pool's base reserve ${baseReserve}`,
        );
      }
      const grossIn = (quoteReserve * baseOutBig) / (baseReserve - baseOutBig);
      const cap = (grossIn * (10_000n + BigInt(slippageBps))) / 10_000n;
      maxQuoteIn = new BN(cap.toString());
    }

    if (storedRelaunch.sourceQuoteMint.equals(NATIVE_MINT)) {
      const wsolAta = getAssociatedTokenAddressSync(
        NATIVE_MINT,
        this.provider.publicKey,
      );
      let wsolAtaAccount: AccountInfo<Buffer> | null = null;
      try {
        wsolAtaAccount = await this.provider.connection.getAccountInfo(wsolAta);
      } catch {
        // anchor-bankrun's connection proxy throws for missing accounts
        // instead of returning null.
      }
      const wsolBalance =
        wsolAtaAccount === null
          ? 0n
          : AccountLayout.decode(wsolAtaAccount.data).amount;
      const shortfall = BigInt(maxQuoteIn.toString()) - wsolBalance;
      if (shortfall > 0n) {
        await this.provider.sendAndConfirm!(
          new Transaction().add(
            createAssociatedTokenAccountIdempotentInstruction(
              this.provider.publicKey,
              wsolAta,
              this.provider.publicKey,
              NATIVE_MINT,
            ),
            SystemProgram.transfer({
              fromPubkey: this.provider.publicKey,
              toPubkey: wsolAta,
              lamports: Number(shortfall),
            }),
            createSyncNativeInstruction(wsolAta),
          ),
        );
      }
    }

    return this.depositViaBuyIx({
      relaunch,
      oldMint: storedRelaunch.oldMint,
      oldTokenProgram: oldMintAccount.owner,
      sourceQuoteMint: storedRelaunch.sourceQuoteMint,
      sourcePool: storedRelaunch.sourcePool,
      poolBaseTokenAccount: pool.poolBaseTokenAccount,
      poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
      coinCreator: pool.coinCreator,
      protocolFeeRecipient: globalConfig.protocolFeeRecipients[0],
      buybackFeeRecipient: globalConfig.buybackFeeRecipients[0],
      baseOut,
      maxQuoteIn,
    }).rpc();
  }

  // Sells the whole old-token vault as the admin (the provider wallet),
  // deriving the pump account set from the stored relaunch, its pool, and
  // pump's global config. When minQuoteOut is not given, it is computed live
  // from the pool reserves: the constant-product output of the sell minus
  // slippageBps (which must also cover pump's swap fees).
  async executeSell({
    relaunch,
    minQuoteOut,
    slippageBps = 100,
  }: {
    relaunch: PublicKey;
    minQuoteOut?: BN;
    slippageBps?: number;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    const oldMintAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.oldMint,
    );
    if (oldMintAccount === null) {
      throw new Error(
        `old mint ${storedRelaunch.oldMint.toBase58()} does not exist`,
      );
    }

    const poolAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.sourcePool,
    );
    if (poolAccount === null) {
      throw new Error(
        `source pool ${storedRelaunch.sourcePool.toBase58()} does not exist`,
      );
    }
    const pool = parsePumpPool(poolAccount.data);

    const globalConfigAccount = await this.provider.connection.getAccountInfo(
      PUMP_AMM_GLOBAL_CONFIG,
    );
    if (globalConfigAccount === null) {
      throw new Error("pump_amm global config does not exist");
    }
    const globalConfig = parsePumpGlobalConfig(globalConfigAccount.data);

    if (minQuoteOut === undefined) {
      const [baseIn, baseReserve, quoteReserve] = await Promise.all(
        [
          storedRelaunch.oldTokenVault,
          pool.poolBaseTokenAccount,
          pool.poolQuoteTokenAccount,
        ].map((address) => this.fetchTokenBalance(address)),
      );
      const grossOut = (quoteReserve * baseIn) / (baseReserve + baseIn);
      const floor = (grossOut * (10_000n - BigInt(slippageBps))) / 10_000n;
      minQuoteOut = new BN(floor.toString());
    }

    return this.executeSellIx({
      relaunch,
      oldMint: storedRelaunch.oldMint,
      oldTokenProgram: oldMintAccount.owner,
      sourceQuoteMint: storedRelaunch.sourceQuoteMint,
      sourcePool: storedRelaunch.sourcePool,
      poolBaseTokenAccount: pool.poolBaseTokenAccount,
      poolQuoteTokenAccount: pool.poolQuoteTokenAccount,
      coinCreator: pool.coinCreator,
      protocolFeeRecipient: globalConfig.protocolFeeRecipients[0],
      buybackFeeRecipient: globalConfig.buybackFeeRecipients[0],
      minQuoteOut,
    }).rpc();
  }

  private async fetchTokenBalance(address: PublicKey): Promise<bigint> {
    const accountInfo = await this.provider.connection.getAccountInfo(address);
    if (accountInfo === null) {
      throw new Error(`token account ${address.toBase58()} does not exist`);
    }
    return AccountLayout.decode(accountInfo.data).amount;
  }

  // Claims a refund for the given depositor (the provider wallet by default),
  // reading the old mint and its owner program from the stored relaunch.
  async claimRefund({
    relaunch,
    depositor = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    depositor?: PublicKey;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    const oldMintAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.oldMint,
    );
    if (oldMintAccount === null) {
      throw new Error(
        `old mint ${storedRelaunch.oldMint.toBase58()} does not exist`,
      );
    }

    return this.claimRefundIx({
      relaunch,
      oldMint: storedRelaunch.oldMint,
      oldTokenProgram: oldMintAccount.owner,
      depositor,
    }).rpc();
  }

  // Claims the depositor's pro-rata share of the new token (the provider
  // wallet by default), reading the new mint from the stored relaunch.
  async claim({
    relaunch,
    depositor = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    depositor?: PublicKey;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    return this.claimIx({
      relaunch,
      newMint: storedRelaunch.newMint,
      depositor,
    }).rpc();
  }

  // Builds the create-mint-to-self pre-instructions: a `createAccountWithSeed`
  // + `initializeMint2` pair with the payer as mint authority, so
  // `initialize_relaunch` can take the authority from a mint the payer
  // provably controls.
  async createNewMintIxs({
    payer = this.provider.publicKey,
    seed = Keypair.generate().publicKey.toBase58().slice(0, 32),
  }: {
    payer?: PublicKey;
    seed?: string;
  } = {}) {
    const newMint = await PublicKey.createWithSeed(
      payer,
      seed,
      TOKEN_PROGRAM_ID,
    );
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE,
      );

    const instructions = [
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer,
        basePubkey: payer,
        seed,
        newAccountPubkey: newMint,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(newMint, 6, payer, null),
    ];

    return { newMint, instructions };
  }

  // Creates the new mint and initializes the relaunch in a single
  // transaction, signed entirely by the provider wallet.
  async initializeRelaunch({
    oldMint,
    sourcePool,
    sourceQuoteMint,
    tokenName,
    tokenSymbol,
    tokenUri,
    secondsForDeposits,
    gracePeriodSeconds,
    thresholdBps,
    monthlySpendingLimitAmount,
    monthlySpendingLimitMembers,
    teamAddress,
    admin,
  }: {
    oldMint: PublicKey;
    sourcePool: PublicKey;
    sourceQuoteMint: PublicKey;
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    secondsForDeposits: number;
    gracePeriodSeconds: number;
    thresholdBps: number;
    monthlySpendingLimitAmount?: BN;
    monthlySpendingLimitMembers?: PublicKey[];
    teamAddress: PublicKey;
    admin?: PublicKey;
  }): Promise<{
    newMint: PublicKey;
    relaunch: PublicKey;
    txSignature: TransactionSignature;
  }> {
    const { newMint, instructions } = await this.createNewMintIxs();

    const oldMintAccount =
      await this.provider.connection.getAccountInfo(oldMint);
    if (oldMintAccount === null) {
      throw new Error(`old mint ${oldMint.toBase58()} does not exist`);
    }

    const txSignature = await this.initializeRelaunchIx({
      newMint,
      oldMint,
      oldTokenProgram: oldMintAccount.owner,
      sourcePool,
      sourceQuoteMint,
      tokenName,
      tokenSymbol,
      tokenUri,
      secondsForDeposits,
      gracePeriodSeconds,
      thresholdBps,
      monthlySpendingLimitAmount,
      monthlySpendingLimitMembers,
      teamAddress,
      admin,
    })
      .preInstructions(instructions)
      .rpc();

    return {
      newMint,
      relaunch: this.getRelaunchAddress({ newMint }),
      txSignature,
    };
  }

  async fetchRelaunch(relaunch: PublicKey): Promise<RelaunchAccount | null> {
    return this.relaunchProgram.account.relaunch.fetchNullable(relaunch);
  }

  async deserializeRelaunch(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<RelaunchAccount> {
    return this.relaunchProgram.coder.accounts.decode(
      "relaunch",
      accountInfo.data,
    );
  }

  async fetchDepositRecord(
    depositRecord: PublicKey,
  ): Promise<DepositRecordAccount | null> {
    return this.relaunchProgram.account.depositRecord.fetchNullable(
      depositRecord,
    );
  }

  async deserializeDepositRecord(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<DepositRecordAccount> {
    return this.relaunchProgram.coder.accounts.decode(
      "depositRecord",
      accountInfo.data,
    );
  }

  async getRelaunch({
    newMint,
  }: {
    newMint: PublicKey;
  }): Promise<RelaunchAccount | null> {
    const relaunch = this.getRelaunchAddress({ newMint });
    return this.fetchRelaunch(relaunch);
  }

  async getDepositRecord({
    relaunch,
    depositor,
  }: {
    relaunch: PublicKey;
    depositor: PublicKey;
  }): Promise<DepositRecordAccount | null> {
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });
    return this.fetchDepositRecord(depositRecord);
  }

  public getRelaunchAddress({ newMint }: { newMint: PublicKey }): PublicKey {
    return getRelaunchAddr({ programId: this.programId, newMint })[0];
  }

  public getRelaunchSignerAddress({
    relaunch,
  }: {
    relaunch: PublicKey;
  }): PublicKey {
    return getRelaunchSignerAddr({ programId: this.programId, relaunch })[0];
  }

  public getDepositRecordAddress({
    relaunch,
    depositor,
  }: {
    relaunch: PublicKey;
    depositor: PublicKey;
  }): PublicKey {
    return getDepositRecordAddr({
      programId: this.programId,
      relaunch,
      depositor,
    })[0];
  }

  public getEventAuthorityAddress(): PublicKey {
    return getEventAuthorityAddr(this.programId)[0];
  }
}
