import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey, SystemProgram } from "@solana/web3.js";
import { MAINNET_USDC, BID_WALL_PROGRAM_ID } from "../v0.7/constants.js";
import { BidWallProgram, BidWallIDL, BidWall } from "../v0.7/types/index.js";
import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getBidWallAddr } from "../v0.7/utils/pda.js";

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
    initialAmmQuoteReserves,
    daoTreasury,
    authority,
    baseMint,
    creator = this.provider.publicKey,
    nonce = new BN(0),
    feeRecipient,
    quoteMint = MAINNET_USDC,
    payer = this.provider.publicKey,
  }: {
    amount: number;
    durationSeconds: number;
    initialAmmQuoteReserves: number;
    daoTreasury: PublicKey;
    creator?: PublicKey;
    nonce?: BN;
    authority?: PublicKey;
    baseMint: PublicKey;
    feeRecipient: PublicKey;
    quoteMint?: PublicKey;
    payer?: PublicKey;
  }) {
    const [bidWall] = getBidWallAddr({ creator, baseMint, nonce });

    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const creatorQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      creator,
      true,
    );

    return this.bidWallProgram.methods
      .initializeBidWall({
        amount: new BN(amount),
        nonce,
        durationSeconds,
        initialAmmQuoteReserves: new BN(initialAmmQuoteReserves),
      })
      .accounts({
        bidWall,
        payer,
        bidWallQuoteTokenAccount,
        creator,
        creatorQuoteTokenAccount,
        authority: authority ?? creator,
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
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const userTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      user,
      true,
    );

    const userQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      user,
      true,
    );

    const daoTreasuryQuoteTokenAccount = getAssociatedTokenAddressSync(
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
        userQuoteTokenAccount,
        bidWallQuoteTokenAccount,
        baseMint,
        quoteMint,
        daoTreasury,
        daoTreasuryQuoteTokenAccount,
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
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );

    const feeRecipientQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.collectFees().accounts({
      bidWall,
      bidWallQuoteTokenAccount,
      feeRecipient,
      feeRecipientQuoteTokenAccount,
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
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );
    const authorityQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      authority,
      true,
    );
    const feeRecipientQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.closeBidWall().accounts({
      bidWall,
      payer,
      authority,
      feeRecipient,
      bidWallQuoteTokenAccount,
      authorityQuoteTokenAccount,
      feeRecipientQuoteTokenAccount,
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
    const bidWallQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      bidWall,
      true,
    );
    const authorityQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      authority,
      true,
    );
    const feeRecipientQuoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      feeRecipient,
      true,
    );

    return this.bidWallProgram.methods.cancelBidWall().accounts({
      bidWall,
      payer,
      authority,
      feeRecipient,
      bidWallQuoteTokenAccount,
      authorityQuoteTokenAccount,
      feeRecipientQuoteTokenAccount,
      baseMint,
      quoteMint,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }
}
