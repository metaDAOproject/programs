import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { RELAUNCH_V0_1_PROGRAM_ID } from "../../constants.js";
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
import { getEventAuthorityAddr } from "../../pda.js";

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
