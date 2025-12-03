import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey, SystemProgram } from "@solana/web3.js";
import { BID_WALL_PROGRAM_ID, MAINNET_USDC } from "./constants.js";
import { BidWallProgram, BidWallIDL, BidWall } from "./types/index.js";
import { BN } from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getBidWallAddr } from "./utils/pda.js";

export type CreateBidWallClientParams = {
  provider: AnchorProvider;
  bidWallProgramId?: PublicKey;
};

export class BidWallClient {
  public readonly provider: AnchorProvider;
  public readonly bidWallProgram: Program<BidWallProgram>;

  constructor(provider: AnchorProvider, bidWallProgramId: PublicKey) {
    this.provider = provider;
    this.bidWallProgram = new Program<BidWallProgram>(
      BidWallIDL,
      bidWallProgramId,
      provider,
    );
  }

  public static createClient(
    createBidWallClientParams: CreateBidWallClientParams,
  ): BidWallClient {
    let { provider, bidWallProgramId } = createBidWallClientParams;

    return new BidWallClient(provider, bidWallProgramId || BID_WALL_PROGRAM_ID);
  }

  async fetchBidWall(bidWall: PublicKey): Promise<BidWall | null> {
    return this.bidWallProgram.account.bidWall.fetchNullable(bidWall);
  }

  async deserializeBidWall(accountInfo: AccountInfo<Buffer>): Promise<BidWall> {
    return this.bidWallProgram.coder.accounts.decode(
      "bidWall",
      accountInfo.data,
    );
  }

  initializeBidWallIx({
    amount,
    durationSeconds,
    initialAmmBaseReserves,
    initialAmmQuoteReserves,
    initialNav,
    initialDaoTreasuryQuoteAmount,
    daoTreasury,
    authority,
    baseMint,
    feeRecipient,
    quoteMint = MAINNET_USDC,
    payer = this.provider.publicKey,
  }: {
    amount: number;
    durationSeconds: number;
    initialAmmBaseReserves: number;
    initialAmmQuoteReserves: number;
    initialNav: number;
    initialDaoTreasuryQuoteAmount: number;
    authority: PublicKey;
    daoTreasury: PublicKey;
    baseMint: PublicKey;
    feeRecipient: PublicKey;
    quoteMint: PublicKey;
    payer: PublicKey;
  }) {
    const [bidWall] = getBidWallAddr({ authority, baseMint });

    const bidWallUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const authorityUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      authority,
      true,
    );

    const daoTreasuryUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      daoTreasury,
      true,
    );

    return this.bidWallProgram.methods
      .initializeBidWall({
        amount: new BN(amount),
        durationSeconds,
        initialAmmBaseReserves: new BN(initialAmmBaseReserves),
        initialAmmQuoteReserves: new BN(initialAmmQuoteReserves),
        initialNav: new BN(initialNav),
        initialDaoTreasuryQuoteAmount: new BN(initialDaoTreasuryQuoteAmount),
      })
      .accounts({
        bidWall,
        payer,
        authority: authority,
        bidWallUsdcTokenAccount,
        authorityUsdcTokenAccount,
        baseMint,
        quoteMint,
        feeRecipient,
        daoTreasury,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  sellTokensIx({
    amount,
    bidWall,
    baseMint,
    daoTreasury,
    quoteMint = MAINNET_USDC,
    user = this.provider.publicKey,
  }: {
    amount: number;
    bidWall: PublicKey;
    baseMint: PublicKey;
    daoTreasury: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
  }) {
    const bidWallUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const userTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      user,
      true,
    );

    const userUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user,
      true,
    );

    const daoTreasuryUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      daoTreasury,
      true,
    );

    return this.bidWallProgram.methods
      .sellTokens({ amountIn: new BN(amount) })
      .accounts({
        bidWall,
        user,
        userTokenAccount,
        userUsdcTokenAccount,
        bidWallUsdcTokenAccount,
        baseMint,
        quoteMint,
        daoTreasury,
        daoTreasuryUsdcTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  collectFeesIx({
    bidWall,
    feeRecipient,
    quoteMint = MAINNET_USDC,
  }: {
    bidWall: PublicKey;
    feeRecipient: PublicKey;
    quoteMint: PublicKey;
  }) {
    const bidWallUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const feeRecipientUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.collectFees().accounts({
      bidWall,
      bidWallUsdcTokenAccount,
      feeRecipient,
      feeRecipientUsdcTokenAccount,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }

  closeBidWallIx({
    bidWall,
    authority,
    baseMint,
    feeRecipient = PublicKey.default,
    quoteMint = MAINNET_USDC,
    payer = this.provider.publicKey,
  }: {
    bidWall: PublicKey;
    authority: PublicKey;
    baseMint: PublicKey;
    feeRecipient: PublicKey;
    quoteMint: PublicKey;
    payer: PublicKey;
  }) {
    const bidWallUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );
    const authorityUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      authority,
      true,
    );
    const feeRecipientUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.closeBidWall().accounts({
      bidWall,
      payer,
      authority,
      feeRecipient,
      bidWallUsdcTokenAccount,
      authorityUsdcTokenAccount,
      feeRecipientUsdcTokenAccount,
      baseMint,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }

  cancelBidWallIx({
    bidWall,
    authority,
    baseMint,
    feeRecipient = PublicKey.default,
    quoteMint = MAINNET_USDC,
    payer = this.provider.publicKey,
  }: {
    bidWall: PublicKey;
    authority: PublicKey;
    baseMint: PublicKey;
    feeRecipient: PublicKey;
    quoteMint: PublicKey;
    payer: PublicKey;
  }) {
    const bidWallUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );
    const authorityUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      authority,
      true,
    );
    const feeRecipientUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.cancelBidWall().accounts({
      bidWall,
      payer,
      authority,
      feeRecipient,
      bidWallUsdcTokenAccount,
      authorityUsdcTokenAccount,
      feeRecipientUsdcTokenAccount,
      baseMint,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }
}
