import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  Keypair,
  AccountInfo,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { Launchpad, IDL as LaunchpadIDL } from "./types/launchpad.js";
import {
  LAUNCHPAD_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  LOW_FEE_RAYDIUM_CONFIG,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
  DEVNET_RAYDIUM_AUTHORITY,
  DEVNET_LOW_FEE_RAYDIUM_CONFIG,
  DEVNET_RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  MAINNET_USDC,
  DEVNET_USDC,
} from "./constants.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { FundingRecord, Launch } from "./types/index.js";
import {
  getDaoTreasuryAddr,
  getEventAuthorityAddr,
  getFundingRecordAddr,
  getLaunchAddr,
  getLaunchDaoAddr,
  getLaunchSignerAddr,
  getLiquidityPoolAddr,
  getMetadataAddr,
  getRaydiumCpmmLpMintAddr,
} from "./utils/pda.js";
import { AutocratClient } from "./AutocratClient.js";
import * as anchor from "@coral-xyz/anchor";

export type CreateLaunchpadClientParams = {
  provider: AnchorProvider;
  launchpadProgramId?: PublicKey;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  ammProgramId?: PublicKey;
};

export class LaunchpadClient {
  public launchpad: Program<Launchpad>;
  public provider: AnchorProvider;
  public autocratClient: AutocratClient;

  private constructor(params: CreateLaunchpadClientParams) {
    this.provider = params.provider;
    this.launchpad = new Program(
      LaunchpadIDL,
      params.launchpadProgramId || LAUNCHPAD_PROGRAM_ID,
      this.provider
    );
    this.autocratClient = AutocratClient.createClient({
      provider: this.provider,
      autocratProgramId: params.autocratProgramId,
      conditionalVaultProgramId: params.conditionalVaultProgramId,
      ammProgramId: params.ammProgramId,
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
    fundingRecord: PublicKey
  ): Promise<FundingRecord | null> {
    return await this.launchpad.account.fundingRecord.fetchNullable(
      fundingRecord
    );
  }

  async deserializeFundingRecord(
    accountInfo: AccountInfo<Buffer>
  ): Promise<FundingRecord> {
    return this.launchpad.coder.accounts.decode(
      "fundingRecord",
      accountInfo.data
    );
  }

  // initializeLaunchIx(
  //   tokenName: string,
  //   tokenSymbol: string,
  //   tokenUri: string,
  //   minimumRaiseAmount: BN,
  //   secondsForLaunch: number,
  //   baseMint: PublicKey,
  //   quoteMint: PublicKey,
  //   launchAuthority: PublicKey = this.provider.publicKey,
  //   isDevnet: boolean = false,
  //   payer: PublicKey = this.provider.publicKey
  // ) {
  //   const [launch] = getLaunchAddr(this.launchpad.programId, baseMint);
  //   const [launchSigner] = getLaunchSignerAddr(
  //     this.launchpad.programId,
  //     launch
  //   );
  //   const quoteVault = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     launchSigner,
  //     true
  //   );

  //   const baseVault = getAssociatedTokenAddressSync(
  //     baseMint,
  //     launchSigner,
  //     true
  //   );
  //   const [tokenMetadata] = getMetadataAddr(baseMint);

  //   return this.launchpad.methods
  //     .initializeLaunch({
  //       minimumRaiseAmount,
  //       secondsForLaunch,
  //       tokenName,
  //       tokenSymbol,
  //       tokenUri,
  //     })
  //     .accounts({
  //       launch,
  //       launchSigner,
  //       quoteVault,
  //       baseVault,
  //       launchAuthority,
  //       quoteMint,
  //       baseMint,
  //       tokenMetadata,
  //       tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
  //       payer,
  //     })
  //     .preInstructions([
  //       createAssociatedTokenAccountIdempotentInstruction(
  //         payer,
  //         getAssociatedTokenAddressSync(quoteMint, launchSigner, true),
  //         launchSigner,
  //         quoteMint
  //       ),
  //     ]);
  //   // .signers([tokenMintKp]);
  // }

  // startLaunchIx(
  //   launch: PublicKey,
  //   launchAuthority: PublicKey = this.provider.publicKey
  // ) {
  //   return this.launchpad.methods.startLaunch().accounts({
  //     launch,
  //     launchAuthority,
  //   });
  // }

  // fundIx(
  //   launch: PublicKey,
  //   amount: BN,
  //   funder: PublicKey = this.provider.publicKey,
  //   quoteMint: PublicKey,
  //   isDevnet: boolean = false
  // ) {
  //   const USDC = isDevnet ? DEVNET_USDC : MAINNET_USDC;

  //   const [launchSigner] = getLaunchSignerAddr(
  //     this.launchpad.programId,
  //     launch
  //   );
  //   const launchQuoteVault = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     launchSigner,
  //     true
  //   );
  //   const funderQuoteAccount = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     funder,
  //     true
  //   );
  //   const [fundingRecord] = getFundingRecordAddr(
  //     this.launchpad.programId,
  //     launch,
  //     funder
  //   );

  //   return this.launchpad.methods.fund(amount).accounts({
  //     launch,
  //     launchQuoteVault,
  //     fundingRecord,
  //     funder,
  //     funderQuoteAccount,
  //     launchSigner,
  //   });
  // }

  // completeLaunchIx(
  //   launch: PublicKey,
  //   quoteMint: PublicKey,
  //   baseMint: PublicKey,
  //   isDevnet: boolean = false
  // ) {
  //   const USDC = isDevnet ? DEVNET_USDC : MAINNET_USDC;

  //   const [launchSigner] = getLaunchSignerAddr(
  //     this.launchpad.programId,
  //     launch
  //   );
  //   const launchQuoteVault = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     launchSigner,
  //     true
  //   );
  //   const launchBaseVault = getAssociatedTokenAddressSync(
  //     baseMint,
  //     launchSigner,
  //     true
  //   );

  //   // const daoKp = Keypair.generate();
  //   const [dao] = getLaunchDaoAddr(this.launchpad.programId, launch);
  //   const [daoTreasury] = getDaoTreasuryAddr(
  //     this.autocratClient.getProgramId(),
  //     dao
  //   );
  //   const treasuryQuoteAccount = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     daoTreasury,
  //     true
  //   );

  //   const [poolState] = getLiquidityPoolAddr(this.launchpad.programId, dao);

  //   const cpSwapProgramId = isDevnet
  //     ? DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID
  //     : RAYDIUM_CP_SWAP_PROGRAM_ID;

  //   const [lpMint] = getRaydiumCpmmLpMintAddr(poolState, isDevnet);

  //   const lpVault = getAssociatedTokenAddressSync(lpMint, launchSigner, true);

  //   const [poolTokenVault] = PublicKey.findProgramAddressSync(
  //     [
  //       anchor.utils.bytes.utf8.encode("pool_vault"),
  //       poolState.toBuffer(),
  //       baseMint.toBuffer(),
  //     ],
  //     cpSwapProgramId
  //   );

  //   const [poolUsdcVault] = PublicKey.findProgramAddressSync(
  //     [
  //       anchor.utils.bytes.utf8.encode("pool_vault"),
  //       poolState.toBuffer(),
  //       USDC.toBuffer(),
  //     ],
  //     cpSwapProgramId
  //   );

  //   const [observationState] = PublicKey.findProgramAddressSync(
  //     [anchor.utils.bytes.utf8.encode("observation"), poolState.toBuffer()],
  //     cpSwapProgramId
  //   );

  //   const [autocratEventAuthority] = getEventAuthorityAddr(
  //     this.autocratClient.getProgramId()
  //   );

  //   const [tokenMetadata] = getMetadataAddr(baseMint);

  //   return this.launchpad.methods
  //     .completeLaunch()
  //     .accounts({
  //       launch,
  //       launchSigner,
  //       launchQuoteVault,
  //       launchBaseVault,
  //       dao,
  //       daoTreasury,
  //       treasuryQuoteAccount,
  //       treasuryLpAccount: getAssociatedTokenAddressSync(
  //         lpMint,
  //         daoTreasury,
  //         true
  //       ),
  //       quoteMint,
  //       baseMint,
  //       tokenMetadata,
  //       lpMint,
  //       lpVault,
  //       poolTokenVault,
  //       poolUsdcVault,
  //       poolState,
  //       observationState,
  //       cpSwapProgram: cpSwapProgramId,
  //       authority: isDevnet ? DEVNET_RAYDIUM_AUTHORITY : RAYDIUM_AUTHORITY,
  //       ammConfig: isDevnet
  //         ? DEVNET_LOW_FEE_RAYDIUM_CONFIG
  //         : LOW_FEE_RAYDIUM_CONFIG,
  //       createPoolFee: isDevnet
  //         ? DEVNET_RAYDIUM_CREATE_POOL_FEE_RECEIVE
  //         : RAYDIUM_CREATE_POOL_FEE_RECEIVE,
  //       autocratProgram: this.autocratClient.getProgramId(),
  //       tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
  //       autocratEventAuthority,
  //     })
  //     .preInstructions([
  //       createAssociatedTokenAccountIdempotentInstruction(
  //         this.provider.publicKey,
  //         treasuryQuoteAccount,
  //         daoTreasury,
  //         USDC
  //       ),
  //     ]);
  // }

  // refundIx(
  //   launch: PublicKey,
  //   funder: PublicKey = this.provider.publicKey,
  //   quoteMint: PublicKey,
  //   isDevnet: boolean = false
  // ) {
  //   const [launchSigner] = getLaunchSignerAddr(
  //     this.launchpad.programId,
  //     launch
  //   );

  //   const [fundingRecord] = getFundingRecordAddr(
  //     this.launchpad.programId,
  //     launch,
  //     funder
  //   );

  //   const launchQuoteVault = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     launchSigner,
  //     true
  //   );
  //   const funderQuoteAccount = getAssociatedTokenAddressSync(
  //     quoteMint,
  //     funder,
  //     true
  //   );

  //   return this.launchpad.methods.refund().accounts({
  //     launch,
  //     launchSigner,
  //     launchQuoteVault,
  //     funder,
  //     funderQuoteAccount,
  //     fundingRecord,
  //   });
  // }

  // claimIx(
  //   launch: PublicKey,
  //   baseMint: PublicKey,
  //   funder: PublicKey = this.provider.publicKey
  // ) {
  //   const [launchSigner] = getLaunchSignerAddr(
  //     this.launchpad.programId,
  //     launch
  //   );
  //   const [fundingRecord] = getFundingRecordAddr(
  //     this.launchpad.programId,
  //     launch,
  //     funder
  //   );

  //   return this.launchpad.methods
  //     .claim()
  //     .accounts({
  //       launch,
  //       fundingRecord,
  //       launchSigner,
  //       funder,
  //       funderTokenAccount: getAssociatedTokenAddressSync(
  //         baseMint,
  //         funder,
  //         true
  //       ),
  //       baseMint,
  //       launchBaseVault: getAssociatedTokenAddressSync(
  //         baseMint,
  //         launchSigner,
  //         true
  //       ),
  //     })
  //     .preInstructions([
  //       createAssociatedTokenAccountIdempotentInstruction(
  //         this.provider.publicKey,
  //         getAssociatedTokenAddressSync(baseMint, funder, true),
  //         funder,
  //         baseMint
  //       ),
  //     ]);
  // }
}
