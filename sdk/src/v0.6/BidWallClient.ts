import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  BID_WALL_PROGRAM_ID,
  DAMM_V2_PROGRAM_ID,
  LAUNCHPAD_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
  MAINNET_USDC,
} from "./constants.js";
import { BidWallProgram, BidWallIDL, BidWall } from "./types/index.js";
import { BN } from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  getBidWallAddr,
  getLaunchpadMeteoraPoolPositionAddr,
  getMeteoraPoolAddr,
} from "./utils/pda.js";

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
    minDuration,
    dao,
    authority,
    baseMint,
    quoteMint = MAINNET_USDC,
    payer = this.provider.publicKey,
    meteoraConfig = MAINNET_METEORA_CONFIG,
  }: {
    amount: number;
    minDuration: number;
    dao: PublicKey;
    authority: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    payer: PublicKey;
    meteoraConfig: PublicKey;
  }) {
    const [bidWall] = getBidWallAddr({ authority, baseMint });

    const [pool] = getMeteoraPoolAddr({ baseMint, quoteMint, meteoraConfig });

    const [position] = getLaunchpadMeteoraPoolPositionAddr({ baseMint });

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

    return this.bidWallProgram.methods
      .initializeBidWall({ amount: new BN(amount), minDuration })
      .accounts({
        bidWall,
        payer,
        authority: authority,
        dao: dao,
        bidWallUsdcTokenAccount,
        authorityUsdcTokenAccount,
        baseMint,
        quoteMint,
        pool,
        position,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  sellTokensIx({
    amount,
    bidWall,
    dao,
    daoTreasuryUsdcTokenAccount,
    baseMint,
    quoteMint = MAINNET_USDC,
    user = this.provider.publicKey,
    meteoraConfig = MAINNET_METEORA_CONFIG,
  }: {
    amount: number;
    bidWall: PublicKey;
    dao: PublicKey;
    daoTreasuryUsdcTokenAccount: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    user: PublicKey;
    meteoraConfig: PublicKey;
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
    const feeWalletUsdcTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      PublicKey.default,
      true,
    );

    const [pool] = getMeteoraPoolAddr({ baseMint, quoteMint, meteoraConfig });
    const [position] = getLaunchpadMeteoraPoolPositionAddr({ baseMint });

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
        dao,
        daoTreasuryUsdcTokenAccount,
        pool,
        position,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
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
    const feeWalletUsdcTokenAccount = getAssociatedTokenAddressSync(
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
      feeWalletUsdcTokenAccount,
      baseMint,
      usdcMint: MAINNET_USDC,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }
}
