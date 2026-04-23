import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, AccountInfo, ComputeBudgetProgram } from "@solana/web3.js";
import { Launchpad, IDL as LaunchpadIDL } from "./types/launchpad.js";
import {
  Launchpad as v0_6_0_launchpad,
  IDL as v0_6_0_launchpadIDL,
} from "./types/launchpad.js";
import {
  LAUNCHPAD_V0_6_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  MAINNET_USDC,
  SQUADS_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  DAMM_V2_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET,
  LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
} from "../../constants.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import { FundingRecord, Launch } from "./types/index.js";
import {
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "./pda.js";
import { getEventAuthorityAddr, getMetadataAddr } from "../../pda.js";
import { FutarchyClient, getDaoAddr } from "../../futarchy/v0.6/index.js";
import {
  PriceBasedPerformancePackageClient,
  getPerformancePackageAddr,
} from "../../price_based_performance_package/v0.6/index.js";

import * as multisig from "@sqds/multisig";

export type CreateLaunchpadClientParams = {
  provider: AnchorProvider;
  launchpadProgramId?: PublicKey;
  futarchyProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  priceBasedUnlockProgramId?: PublicKey;
};

export class LaunchpadClient {
  public launchpad: Program<Launchpad>;
  public provider: AnchorProvider;
  // useful for parsing old events
  public v0_6_0_launchpad: Program<v0_6_0_launchpad>;
  public futarchyClient: FutarchyClient;
  public priceBasedUnlock: PriceBasedPerformancePackageClient;

  private constructor(params: CreateLaunchpadClientParams) {
    this.provider = params.provider;
    this.launchpad = new Program(
      LaunchpadIDL,
      params.launchpadProgramId || LAUNCHPAD_V0_6_PROGRAM_ID,
      this.provider,
    );
    this.v0_6_0_launchpad = new Program<v0_6_0_launchpad>(
      v0_6_0_launchpadIDL,
      params.launchpadProgramId || LAUNCHPAD_V0_6_PROGRAM_ID,
      this.provider,
    );
    this.futarchyClient = FutarchyClient.createClient({
      provider: this.provider,
      futarchyProgramId: params.futarchyProgramId,
      conditionalVaultProgramId: params.conditionalVaultProgramId,
    });
    this.priceBasedUnlock = PriceBasedPerformancePackageClient.createClient({
      provider: this.provider,
      priceBasedTokenLockProgramId: params.priceBasedUnlockProgramId,
    });
  }

  static createClient(params: CreateLaunchpadClientParams): LaunchpadClient {
    return new LaunchpadClient(params);
  }

  getProgramId(): PublicKey {
    return this.launchpad.programId;
  }

  async getLaunch(launch: PublicKey): Promise<Launch> {
    return await this.launchpad.account.launch.fetch(launch);
  }

  async fetchLaunch(launch: PublicKey): Promise<Launch | null> {
    return await this.launchpad.account.launch.fetchNullable(launch);
  }

  async deserializeLaunch(accountInfo: AccountInfo<Buffer>): Promise<Launch> {
    return this.launchpad.coder.accounts.decode("launch", accountInfo.data);
  }

  async getFundingRecord(fundingRecord: PublicKey): Promise<FundingRecord> {
    return await this.launchpad.account.fundingRecord.fetch(fundingRecord);
  }

  async fetchFundingRecord(
    fundingRecord: PublicKey,
  ): Promise<FundingRecord | null> {
    return await this.launchpad.account.fundingRecord.fetchNullable(
      fundingRecord,
    );
  }

  async deserializeFundingRecord(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<FundingRecord> {
    return this.launchpad.coder.accounts.decode(
      "fundingRecord",
      accountInfo.data,
    );
  }

  initializeLaunchIx({
    tokenName,
    tokenSymbol,
    tokenUri,
    minimumRaiseAmount,
    secondsForLaunch = 60 * 60 * 24 * 5, // 5 days
    baseMint,
    quoteMint = MAINNET_USDC,
    monthlySpendingLimitAmount,
    monthlySpendingLimitMembers,
    performancePackageGrantee,
    performancePackageTokenAmount,
    monthsUntilInsidersCanUnlock,
    teamAddress,
    launchAuthority = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    minimumRaiseAmount: BN;
    secondsForLaunch?: number;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    monthlySpendingLimitAmount: BN;
    monthlySpendingLimitMembers: PublicKey[];
    performancePackageGrantee: PublicKey;
    performancePackageTokenAmount: BN;
    monthsUntilInsidersCanUnlock: number;
    teamAddress: PublicKey;
    launchAuthority?: PublicKey;
    payer?: PublicKey;
  }) {
    const [launch] = getLaunchAddr(this.launchpad.programId, baseMint);
    const [launchSigner] = getLaunchSignerAddr(
      this.launchpad.programId,
      launch,
    );
    const quoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      launchSigner,
      true,
    );

    const baseVault = getAssociatedTokenAddressSync(
      baseMint,
      launchSigner,
      true,
    );
    const [tokenMetadata] = getMetadataAddr(baseMint);

    return this.launchpad.methods
      .initializeLaunch({
        minimumRaiseAmount,
        secondsForLaunch,
        tokenName,
        tokenSymbol,
        tokenUri,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers,
        performancePackageGrantee,
        performancePackageTokenAmount,
        monthsUntilInsidersCanUnlock,
        teamAddress,
      })
      .accounts({
        launch,
        launchSigner,
        quoteVault,
        baseVault,
        launchAuthority,
        quoteMint,
        baseMint,
        tokenMetadata,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        payer,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(quoteMint, launchSigner, true),
          launchSigner,
          quoteMint,
        ),
      ]);
    // .signers([tokenMintKp]);
  }

  startLaunchIx({
    launch,
    launchAuthority = this.provider.publicKey,
  }: {
    launch: PublicKey;
    launchAuthority?: PublicKey;
  }) {
    return this.launchpad.methods.startLaunch().accounts({
      launch,
      launchAuthority,
    });
  }

  fundIx({
    launch,
    amount,
    funder = this.provider.publicKey,
    quoteMint = MAINNET_USDC,
  }: {
    launch: PublicKey;
    amount: BN;
    funder?: PublicKey;
    quoteMint?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    const launchQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      launchSigner,
      true,
    );
    const funderQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      funder,
      true,
    );
    const [fundingRecord] = getFundingRecordAddr(
      this.launchpad.programId,
      launch,
      funder,
    );

    return this.launchpad.methods.fund(amount).accounts({
      launch,
      launchQuoteVault,
      fundingRecord,
      funder,
      funderQuoteAccount,
    });
  }

  closeLaunchIx({ launch }: { launch: PublicKey }) {
    return this.launchpad.methods.closeLaunch().accounts({
      launch,
    });
  }

  completeLaunchIx({
    launch,
    quoteMint = MAINNET_USDC,
    baseMint,
    finalRaiseAmount,
    launchAuthority,
    isDevnet = false,
    meteoraConfig = LAUNCHPAD_V0_6_MAINNET_METEORA_CONFIG,
  }: {
    launch: PublicKey;
    quoteMint?: PublicKey;
    baseMint: PublicKey;
    finalRaiseAmount: BN | null;
    launchAuthority: PublicKey | null;
    isDevnet?: boolean;
    meteoraConfig?: PublicKey;
  }) {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    const launchQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      launchSigner,
      true,
    );
    const launchBaseVault = getAssociatedTokenAddressSync(
      baseMint,
      launchSigner,
      true,
    );

    // const daoKp = Keypair.generate();
    const [dao] = getDaoAddr({
      nonce: new BN(0),
      daoCreator: launchSigner,
    });

    const [autocratEventAuthority] = getEventAuthorityAddr(
      this.futarchyClient.getProgramId(),
    );

    const [tokenMetadata] = getMetadataAddr(baseMint);

    const [multisigPda] = multisig.getMultisigPda({ createKey: dao });
    const [multisigVault] = multisig.getVaultPda({
      multisigPda,
      index: 0,
    });

    const [spendingLimit] = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    });

    const treasuryQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      multisigVault,
      true,
    );

    const [ammPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_position"), dao.toBuffer(), multisigVault.toBuffer()],
      this.futarchyClient.getProgramId(),
    );

    const [performancePackage] = getPerformancePackageAddr({
      createKey: launchSigner,
    });
    const performancePackageTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      performancePackage,
      true,
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority")],
      DAMM_V2_PROGRAM_ID,
    );

    const [positionNftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
      LAUNCHPAD_V0_6_PROGRAM_ID,
    );

    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    function getFirstKey(key1: PublicKey, key2: PublicKey) {
      const buf1 = key1.toBuffer();
      const buf2 = key2.toBuffer();
      // Buf1 > buf2
      if (Buffer.compare(buf1, buf2) === 1) {
        return buf1;
      }
      return buf2;
    }

    function getSecondKey(key1: PublicKey, key2: PublicKey) {
      const buf1 = key1.toBuffer();
      const buf2 = key2.toBuffer();
      // Buf1 > buf2
      if (Buffer.compare(buf1, buf2) === 1) {
        return buf2;
      }
      return buf1;
    }

    const [pool] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        meteoraConfig.toBuffer(),
        getFirstKey(baseMint, quoteMint),
        getSecondKey(baseMint, quoteMint),
      ],
      DAMM_V2_PROGRAM_ID,
    );

    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenAVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), baseMint.toBuffer(), pool.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenBVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), quoteMint.toBuffer(), pool.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_6_PROGRAM_ID,
    );

    const [dammV2EventAuthority] = getEventAuthorityAddr(DAMM_V2_PROGRAM_ID);

    return this.launchpad.methods
      .completeLaunch({ finalRaiseAmount })
      .accounts({
        launch,
        launchSigner,
        launchQuoteVault,
        launchBaseVault,
        launchAuthority,
        dao,
        treasuryQuoteAccount,
        quoteMint,
        baseMint,
        tokenMetadata,
        daoOwnedLpPosition: ammPosition,
        futarchyAmmQuoteVault: getAssociatedTokenAddressSync(
          quoteMint,
          dao,
          true,
        ),
        futarchyAmmBaseVault: getAssociatedTokenAddressSync(
          baseMint,
          dao,
          true,
        ),
        staticAccounts: {
          futarchyProgram: this.futarchyClient.getProgramId(),
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          autocratEventAuthority,
          squadsProgram: SQUADS_PROGRAM_ID,
          squadsProgramConfig: SQUADS_PROGRAM_CONFIG,
          squadsProgramConfigTreasury: isDevnet
            ? SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET
            : SQUADS_PROGRAM_CONFIG_TREASURY,
          priceBasedPerformancePackageProgram: this.priceBasedUnlock.programId,
          priceBasedPerformancePackageEventAuthority:
            this.priceBasedUnlock.getEventAuthorityAddress(),
        },
        squadsMultisig: multisigPda,
        squadsMultisigVault: multisigVault,
        spendingLimit,
        performancePackage,
        performancePackageTokenAccount,
        meteoraAccounts: {
          dammV2Program: DAMM_V2_PROGRAM_ID,
          positionNftMint,
          baseMint,
          quoteMint,
          config: meteoraConfig,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          positionNftAccount,
          pool,
          // baseMint,
          // quoteMint,
          poolCreatorAuthority,
          position,
          tokenAVault,
          tokenBVault,
          poolAuthority,
          dammV2EventAuthority,
        },
        // poolCreatorAuthority,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 850_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 255 * 1024 }),
      ]);
  }

  refundIx({
    launch,
    funder = this.provider.publicKey,
    quoteMint = MAINNET_USDC,
  }: {
    launch: PublicKey;
    funder?: PublicKey;
    quoteMint?: PublicKey;
  }) {
    const [launchSigner] = getLaunchSignerAddr(
      this.launchpad.programId,
      launch,
    );

    const [fundingRecord] = getFundingRecordAddr(
      this.launchpad.programId,
      launch,
      funder,
    );

    const launchQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      launchSigner,
      true,
    );
    const funderQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      funder,
      true,
    );

    return this.launchpad.methods.refund().accounts({
      launch,
      launchSigner,
      launchQuoteVault,
      funder,
      funderQuoteAccount,
      fundingRecord,
    });
  }

  claimIx(
    launch: PublicKey,
    baseMint: PublicKey,
    funder: PublicKey = this.provider.publicKey,
  ) {
    const [launchSigner] = getLaunchSignerAddr(
      this.launchpad.programId,
      launch,
    );
    const [fundingRecord] = getFundingRecordAddr(
      this.launchpad.programId,
      launch,
      funder,
    );

    return this.launchpad.methods
      .claim()
      .accounts({
        launch,
        fundingRecord,
        launchSigner,
        funder,
        funderTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          funder,
          true,
        ),
        baseMint,
        launchBaseVault: getAssociatedTokenAddressSync(
          baseMint,
          launchSigner,
          true,
        ),
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(baseMint, funder, true),
          funder,
          baseMint,
        ),
      ]);
  }

  getLaunchAddress({ baseMint }: { baseMint: PublicKey }): PublicKey {
    return getLaunchAddr(this.launchpad.programId, baseMint)[0];
  }

  getLaunchSignerAddress({ launch }: { launch: PublicKey }): PublicKey {
    return getLaunchSignerAddr(this.launchpad.programId, launch)[0];
  }

  getFundingRecordAddress({
    launch,
    funder,
  }: {
    launch: PublicKey;
    funder: PublicKey;
  }): PublicKey {
    return getFundingRecordAddr(this.launchpad.programId, launch, funder)[0];
  }
}
