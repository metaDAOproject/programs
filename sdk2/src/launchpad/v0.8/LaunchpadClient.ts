import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, AccountInfo } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  LAUNCHPAD_V0_8_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  MAINNET_USDC,
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
}
