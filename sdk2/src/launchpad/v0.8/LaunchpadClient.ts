import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey, AccountInfo } from "@solana/web3.js";
import { LAUNCHPAD_V0_8_PROGRAM_ID } from "../../constants.js";
import BN from "bn.js";
import {
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchSignerAddr,
} from "./pda.js";
import {
  LaunchpadProgram,
  LaunchpadIDL,
  Launch,
  FundingRecord,
} from "./types/index.js";

import { FutarchyClient, getDaoAddr } from "../../futarchy/v0.6/index.js";
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
  performancePackageV2ProgramId?: PublicKey;
  bidWallProgramId?: PublicKey;
};

export class LaunchpadClient {
  public launchpad: Program<LaunchpadProgram>;
  public provider: AnchorProvider;
  public autocratClient: FutarchyClient;
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
}
