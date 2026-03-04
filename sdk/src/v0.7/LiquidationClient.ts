import { AnchorProvider, Program } from "@coral-xyz/anchor";
import BN from "bn.js";
import { AccountInfo, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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

  async getLiquidation({
    baseMint,
    quoteMint,
    createKey,
  }: {
    baseMint: PublicKey;
    quoteMint: PublicKey;
    createKey: PublicKey;
  }): Promise<LiquidationAccount | null> {
    const liquidation = this.getLiquidationAddress({
      baseMint,
      quoteMint,
      createKey,
    });
    return this.fetchLiquidation(liquidation);
  }

  initializeLiquidationIx({
    durationSeconds,
    createKey,
    recordAuthority,
    liquidationAuthority,
    baseMint,
    quoteMint,
    payer = this.provider.publicKey,
  }: {
    durationSeconds: number;
    createKey: PublicKey;
    recordAuthority: PublicKey;
    liquidationAuthority: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    payer?: PublicKey;
  }) {
    const liquidation = this.getLiquidationAddress({
      baseMint,
      quoteMint,
      createKey,
    });

    const liquidationQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      liquidation,
      true,
    );

    return this.liquidationProgram.methods
      .initializeLiquidation({ durationSeconds })
      .accounts({
        payer,
        createKey,
        recordAuthority,
        liquidationAuthority,
        baseMint,
        quoteMint,
        liquidation,
        liquidationQuoteVault,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      });
  }

  setRefundRecordIx({
    baseAssigned,
    quoteRefundable,
    recordAuthority,
    liquidation,
    recipient,
    payer = this.provider.publicKey,
  }: {
    baseAssigned: BN;
    quoteRefundable: BN;
    recordAuthority: PublicKey;
    liquidation: PublicKey;
    recipient: PublicKey;
    payer?: PublicKey;
  }) {
    const refundRecord = this.getRefundRecordAddress({
      liquidation,
      recipient,
    });

    return this.liquidationProgram.methods
      .setRefundRecord({ baseAssigned, quoteRefundable })
      .accounts({
        payer,
        recordAuthority,
        liquidation,
        recipient,
        refundRecord,
        systemProgram: SystemProgram.programId,
      });
  }

  activateLiquidationIx({
    liquidationAuthority,
    liquidation,
    liquidationAuthorityQuoteAccount,
    quoteMint,
  }: {
    liquidationAuthority: PublicKey;
    liquidation: PublicKey;
    liquidationAuthorityQuoteAccount: PublicKey;
    quoteMint: PublicKey;
  }) {
    const liquidationQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      liquidation,
      true,
    );

    return this.liquidationProgram.methods.activateLiquidation().accounts({
      liquidationAuthority,
      liquidation,
      liquidationAuthorityQuoteAccount,
      liquidationQuoteVault,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
  }

  refundIx({
    recipient,
    liquidation,
    baseMint,
    recipientBaseAccount,
    quoteMint,
  }: {
    recipient: PublicKey;
    liquidation: PublicKey;
    baseMint: PublicKey;
    recipientBaseAccount?: PublicKey;
    quoteMint: PublicKey;
  }) {
    const refundRecord = this.getRefundRecordAddress({
      liquidation,
      recipient,
    });

    const resolvedRecipientBaseAccount =
      recipientBaseAccount ??
      getAssociatedTokenAddressSync(baseMint, recipient, true);

    const liquidationQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      liquidation,
      true,
    );

    const recipientQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      recipient,
      true,
    );

    return this.liquidationProgram.methods.refund().accounts({
      recipient,
      liquidation,
      refundRecord,
      baseMint,
      recipientBaseAccount: resolvedRecipientBaseAccount,
      liquidationQuoteVault,
      recipientQuoteAccount,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }

  withdrawRemainingQuoteIx({
    liquidationAuthority,
    liquidation,
    liquidationAuthorityQuoteAccount,
    quoteMint,
  }: {
    liquidationAuthority: PublicKey;
    liquidation: PublicKey;
    liquidationAuthorityQuoteAccount?: PublicKey;
    quoteMint: PublicKey;
  }) {
    const liquidationQuoteVault = getAssociatedTokenAddressSync(
      quoteMint,
      liquidation,
      true,
    );

    const resolvedLiquidationAuthorityQuoteAccount =
      liquidationAuthorityQuoteAccount ??
      getAssociatedTokenAddressSync(quoteMint, liquidationAuthority, true);

    return this.liquidationProgram.methods.withdrawRemainingQuote().accounts({
      liquidationAuthority,
      liquidation,
      liquidationQuoteVault,
      liquidationAuthorityQuoteAccount:
        resolvedLiquidationAuthorityQuoteAccount,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
  }

  async getRefundRecord({
    liquidation,
    recipient,
  }: {
    liquidation: PublicKey;
    recipient: PublicKey;
  }): Promise<RefundRecordAccount | null> {
    const refundRecord = this.getRefundRecordAddress({
      liquidation,
      recipient,
    });
    return this.fetchRefundRecord(refundRecord);
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
