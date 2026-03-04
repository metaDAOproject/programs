import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { LIQUIDATION_PROGRAM_ID } from "../v0.7/constants.js";
import {
  LiquidationProgram,
  LiquidationIDL,
  LiquidationAccount,
  RefundRecordAccount,
} from "../v0.7/types/index.js";
import {
  getLiquidationAddr,
  getRefundRecordAddr,
  getEventAuthorityAddr,
} from "../v0.7/utils/pda.js";

export type CreateLiquidationClientParams = {
  provider: AnchorProvider;
  liquidationProgramId?: PublicKey;
};

export class LiquidationClient {
  public readonly provider: AnchorProvider;
  public readonly liquidationProgram: Program<LiquidationProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, liquidationProgramId: PublicKey) {
    this.provider = provider;
    this.programId = liquidationProgramId;
    this.liquidationProgram = new Program<LiquidationProgram>(
      LiquidationIDL,
      liquidationProgramId,
      provider,
    );
  }

  public static createClient(
    createLiquidationClientParams: CreateLiquidationClientParams,
  ): LiquidationClient {
    let { provider, liquidationProgramId } = createLiquidationClientParams;

    return new LiquidationClient(
      provider,
      liquidationProgramId || LIQUIDATION_PROGRAM_ID,
    );
  }

  public getProgramId(): PublicKey {
    return this.programId;
  }

  async fetchLiquidation(
    liquidation: PublicKey,
  ): Promise<LiquidationAccount | null> {
    return this.liquidationProgram.account.liquidation.fetchNullable(
      liquidation,
    );
  }

  async deserializeLiquidation(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<LiquidationAccount> {
    return this.liquidationProgram.coder.accounts.decode(
      "liquidation",
      accountInfo.data,
    );
  }

  async fetchRefundRecord(
    refundRecord: PublicKey,
  ): Promise<RefundRecordAccount | null> {
    return this.liquidationProgram.account.refundRecord.fetchNullable(
      refundRecord,
    );
  }

  async deserializeRefundRecord(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<RefundRecordAccount> {
    return this.liquidationProgram.coder.accounts.decode(
      "refundRecord",
      accountInfo.data,
    );
  }

  public getLiquidationAddress({
    baseMint,
    quoteMint,
    createKey,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    createKey: PublicKey;
  }): PublicKey {
    return getLiquidationAddr({ baseMint, quoteMint, createKey })[0];
  }

  public getRefundRecordAddress({
    liquidation,
    recipient,
  }: {
    liquidation: PublicKey;
    recipient: PublicKey;
  }): PublicKey {
    return getRefundRecordAddr({ liquidation, recipient })[0];
  }

  public getEventAuthorityAddress(): PublicKey {
    return getEventAuthorityAddr(this.programId)[0];
  }
}
