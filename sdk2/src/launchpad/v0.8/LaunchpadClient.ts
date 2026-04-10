import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, AccountInfo, ComputeBudgetProgram } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";
import {
  LAUNCHPAD_V0_8_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  MAINNET_USDC,
  SQUADS_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET,
  DAMM_V2_PROGRAM_ID,
  LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
  METADAO_MULTISIG_VAULT,
} from "../../constants.js";
import {
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "./pda.js";
import { getEventAuthorityAddr, getMetadataAddr } from "../../pda.js";
import {
  LaunchpadProgram,
  LaunchpadIDL,
  Launch,
  FundingRecord,
} from "./types/index.js";

import { FutarchyClient, getDaoAddr } from "../../futarchy/v0.6/index.js";
import {
  MintGovernorClient,
  getMintGovernorAddr,
  getMintAuthorityAddr,
} from "../../mint_governor/v0.7/index.js";
import {
  PerformancePackageV2Client,
  getPerformancePackageV2Addr,
} from "../../performance_package_v2/v0.7/index.js";
import { BidWallClient } from "../../bid_wall/v0.7/index.js";

export type CreateLaunchpadClientParams = {
  provider: AnchorProvider;
  launchpadProgramId?: PublicKey;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  mintGovernorProgramId?: PublicKey;
  performancePackageV2ProgramId?: PublicKey;
  bidWallProgramId?: PublicKey;
};

export class LaunchpadClient {
  public launchpad: Program<LaunchpadProgram>;
  public provider: AnchorProvider;
  public autocratClient: FutarchyClient;
  public mintGovernorClient: MintGovernorClient;
  public performancePackageV2: PerformancePackageV2Client;
  public bidWall: BidWallClient;

  private constructor(params: CreateLaunchpadClientParams) {
    this.provider = params.provider;
    this.launchpad = new Program<LaunchpadProgram>(
      LaunchpadIDL as any,
      params.launchpadProgramId || LAUNCHPAD_V0_8_PROGRAM_ID,
      this.provider,
    );
    this.autocratClient = FutarchyClient.createClient({
      provider: this.provider,
      autocratProgramId: params.autocratProgramId,
      conditionalVaultProgramId: params.conditionalVaultProgramId,
    });
    this.mintGovernorClient = MintGovernorClient.createClient({
      provider: this.provider,
      programId: params.mintGovernorProgramId,
    });
    this.performancePackageV2 = PerformancePackageV2Client.createClient({
      provider: this.provider,
      programId: params.performancePackageV2ProgramId,
    });
    this.bidWall = BidWallClient.createClient({
      provider: this.provider,
      bidWallProgramId: params.bidWallProgramId,
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

  getLaunchAddress({ baseMint }: { baseMint: PublicKey }): PublicKey {
    return getLaunchAddr(this.launchpad.programId, baseMint)[0];
  }

  getLaunchSignerAddress({ launch }: { launch: PublicKey }): PublicKey {
    return getLaunchSignerAddr(this.launchpad.programId, launch)[0];
  }

  getMintGovernorAddress({
    baseMint,
    launchSigner,
  }: {
    baseMint: PublicKey;
    launchSigner: PublicKey;
  }): PublicKey {
    return getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    })[0];
  }

  getMintAuthorityAddress({
    mintGovernor,
    authorizedMinter,
  }: {
    mintGovernor: PublicKey;
    authorizedMinter: PublicKey;
  }): PublicKey {
    return getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter,
    })[0];
  }

  getLaunchPerformancePackageAddress({
    launch,
  }: {
    launch: PublicKey;
  }): PublicKey {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    return getPerformancePackageV2Addr({ createKey: launchSigner })[0];
  }

  getLaunchDaoAddress({ launch }: { launch: PublicKey }): PublicKey {
    const launchSigner = this.getLaunchSignerAddress({ launch });

    return getDaoAddr({ nonce: new BN(0), daoCreator: launchSigner })[0];
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
    additionalTokensRecipient,
    additionalTokensAmount,
    accumulatorActivationDelaySeconds = 0,
    hasBidWall = false,
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
    additionalTokensRecipient?: PublicKey;
    additionalTokensAmount?: BN;
    accumulatorActivationDelaySeconds?: number;
    hasBidWall: boolean;
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

    // MintGovernor PDAs
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    });
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter: launchSigner,
    });
    const [mintGovernorEventAuthority] = getEventAuthorityAddr(
      this.mintGovernorClient.programId,
    );

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
        additionalTokensAmount: additionalTokensAmount ?? new BN(0),
        accumulatorActivationDelaySeconds,
        hasBidWall,
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
        additionalTokensRecipient: additionalTokensRecipient ?? null,
        mintGovernor,
        mintAuthority,
        mintGovernorProgram: this.mintGovernorClient.programId,
        mintGovernorEventAuthority,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(quoteMint, launchSigner, true),
          launchSigner,
          quoteMint,
        ),
      ]);
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
    payer = this.provider.publicKey,
    quoteMint = MAINNET_USDC,
  }: {
    launch: PublicKey;
    amount: BN;
    funder?: PublicKey;
    payer?: PublicKey;
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
      payer,
      funderQuoteAccount,
    });
  }

  closeLaunchIx({ launch }: { launch: PublicKey }) {
    return this.launchpad.methods.closeLaunch().accounts({
      launch,
    });
  }

  setFundingRecordApprovalIx({
    launch,
    funder,
    launchAuthority = this.provider.publicKey,
    approvedAmount,
  }: {
    launch: PublicKey;
    funder: PublicKey;
    launchAuthority?: PublicKey;
    approvedAmount: BN;
  }) {
    let fundingRecord = getFundingRecordAddr(
      this.launchpad.programId,
      launch,
      funder,
    )[0];

    return this.launchpad.methods
      .setFundingRecordApproval(approvedAmount)
      .accounts({
        launch,
        fundingRecord,
        launchAuthority,
      });
  }

  settleLaunchIx({
    launch,
    baseMint,
    quoteMint = MAINNET_USDC,
    launchAuthority,
    isDevnet = false,
    meteoraConfig = LAUNCHPAD_V0_8_MAINNET_METEORA_CONFIG,
    feeRecipient = METADAO_MULTISIG_VAULT,
    payer = this.provider.publicKey,
  }: {
    launch: PublicKey;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    launchAuthority: PublicKey | null;
    isDevnet?: boolean;
    meteoraConfig?: PublicKey;
    feeRecipient?: PublicKey;
    payer?: PublicKey;
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

    const [dao] = getDaoAddr({
      nonce: new BN(0),
      daoCreator: launchSigner,
    });

    const [futarchyEventAuthority] = getEventAuthorityAddr(
      this.autocratClient.getProgramId(),
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
      this.autocratClient.getProgramId(),
    );

    // MintGovernor PDAs
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.mintGovernorClient.programId,
      mint: baseMint,
      createKey: launchSigner,
    });
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.mintGovernorClient.programId,
      mintGovernor,
      authorizedMinter: launchSigner,
    });
    const [mintGovernorEventAuthority] = getEventAuthorityAddr(
      this.mintGovernorClient.programId,
    );

    // Meteora PDAs
    const [positionNftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
      this.launchpad.programId,
    );

    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    function getFirstKey(key1: PublicKey, key2: PublicKey) {
      const buf1 = key1.toBuffer();
      const buf2 = key2.toBuffer();
      if (Buffer.compare(buf1, buf2) === 1) {
        return buf1;
      }
      return buf2;
    }

    function getSecondKey(key1: PublicKey, key2: PublicKey) {
      const buf1 = key1.toBuffer();
      const buf2 = key2.toBuffer();
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
      this.launchpad.programId,
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority")],
      DAMM_V2_PROGRAM_ID,
    );

    const [dammV2EventAuthority] = getEventAuthorityAddr(DAMM_V2_PROGRAM_ID);

    // Bid wall PDAs
    const bidWall = this.bidWall.getBidWallAddress({
      baseMint,
      creator: launchSigner,
      nonce: new BN(0),
    });
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    return this.launchpad.methods
      .settleLaunch()
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
        payer,
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
          futarchyProgram: this.autocratClient.getProgramId(),
          tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
          futarchyEventAuthority,
          squadsProgram: SQUADS_PROGRAM_ID,
          squadsProgramConfig: SQUADS_PROGRAM_CONFIG,
          squadsProgramConfigTreasury: isDevnet
            ? SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET
            : SQUADS_PROGRAM_CONFIG_TREASURY,
          bidWallProgram: this.bidWall.programId,
          bidWallEventAuthority: this.bidWall.getEventAuthorityAddress(),
        },
        squadsMultisig: multisigPda,
        squadsMultisigVault: multisigVault,
        spendingLimit,
        bidWall,
        bidWallQuoteTokenAccount,
        feeRecipient,
        meteoraAccounts: {
          dammV2Program: DAMM_V2_PROGRAM_ID,
          positionNftMint,
          baseMint,
          quoteMint,
          config: meteoraConfig,
          token2022Program: TOKEN_2022_PROGRAM_ID,
          positionNftAccount,
          pool,
          poolCreatorAuthority,
          position,
          tokenAVault,
          tokenBVault,
          poolAuthority,
          dammV2EventAuthority,
        },
        mintGovernorAccounts: {
          mintGovernor,
          mintAuthority,
          mintGovernorProgram: this.mintGovernorClient.programId,
          mintGovernorEventAuthority,
        },
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
        ComputeBudgetProgram.requestHeapFrame({ bytes: 255 * 1024 }),
      ]);
  }
}
