import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PriceBasedPerformancePackage,
  IDL as PriceBasedPerformancePackageIDL,
} from "./types/price_based_performance_package.js";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID,
} from "../../constants.js";
import BN from "bn.js";
// import { OracleConfig } from "./types/index.js";
import { getChangeRequestAddr, getPerformancePackageAddr } from "./pda.js";
import { getEventAuthorityAddr } from "../../pda.js";
import {
  InitializePerformancePackageParams,
  InitializePerformancePackageWithLimitsParams,
  PerformancePackage,
  ProposeChangeParams,
} from "./types/index.js";

export type CreatePriceBasedPerformancePackageClientParams = {
  provider: AnchorProvider;
  priceBasedTokenLockProgramId?: PublicKey;
};

/** Burning sweeps the package's ATA for `quoteMint` into `quoteDestination` and closes it */
export type QuoteSweep = {
  quoteMint: PublicKey;
  quoteDestination: PublicKey;
};

export class PriceBasedPerformancePackageClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<PriceBasedPerformancePackage>;
  public readonly programId: PublicKey;

  constructor(
    provider: AnchorProvider,
    priceBasedTokenLockProgramId: PublicKey,
  ) {
    this.provider = provider;
    this.programId = priceBasedTokenLockProgramId;
    this.program = new Program<PriceBasedPerformancePackage>(
      PriceBasedPerformancePackageIDL,
      priceBasedTokenLockProgramId,
      provider,
    );
  }

  public static createClient(
    createClientParams: CreatePriceBasedPerformancePackageClientParams,
  ): PriceBasedPerformancePackageClient {
    let { provider, priceBasedTokenLockProgramId } = createClientParams;

    if (!priceBasedTokenLockProgramId) {
      priceBasedTokenLockProgramId = PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID;
    }

    return new PriceBasedPerformancePackageClient(
      provider,
      priceBasedTokenLockProgramId,
    );
  }

  public initializePerformancePackageIx(params: {
    params: InitializePerformancePackageParams;
    createKey: PublicKey;
    tokenMint: PublicKey;
    grantor: PublicKey;
    grantorTokenAccount?: PublicKey;
  }) {
    return this.program.methods
      .initializePerformancePackage(params.params)
      .accounts(this.initializePerformancePackageAccounts(params));
  }

  public initializePerformancePackageWithLimitsIx(params: {
    params: InitializePerformancePackageWithLimitsParams;
    createKey: PublicKey;
    tokenMint: PublicKey;
    grantor: PublicKey;
    grantorTokenAccount?: PublicKey;
  }) {
    return this.program.methods
      .initializePerformancePackageWithLimits(params.params)
      .accounts(this.initializePerformancePackageAccounts(params));
  }

  // Both initialisers share one accounts struct.
  private initializePerformancePackageAccounts({
    createKey,
    tokenMint,
    grantor,
    grantorTokenAccount,
  }: {
    createKey: PublicKey;
    tokenMint: PublicKey;
    grantor: PublicKey;
    grantorTokenAccount?: PublicKey;
  }) {
    const performancePackage = getPerformancePackageAddr({ createKey })[0];

    return {
      performancePackage,
      createKey,
      tokenMint,
      grantorTokenAccount:
        grantorTokenAccount ??
        getAssociatedTokenAddressSync(tokenMint, grantor, true),
      performancePackageTokenVault: getAssociatedTokenAddressSync(
        tokenMint,
        performancePackage,
        true,
      ),
      grantor,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  }

  public startUnlockIx(params: {
    performancePackage: PublicKey;
    oracleAccount: PublicKey;
    recipient: PublicKey;
  }) {
    return this.program.methods.startUnlock().accounts({
      performancePackage: params.performancePackage,
      oracleAccount: params.oracleAccount,
      recipient: params.recipient,
    });
  }

  public completeUnlockIx(params: {
    performancePackage: PublicKey;
    oracleAccount: PublicKey;
  }) {
    return this.program.methods.completeUnlock().accounts({
      performancePackage: params.performancePackage,
      oracleAccount: params.oracleAccount,
    });
  }

  public withdrawTokensIx({
    performancePackage,
    oracleAccount,
    tokenMint,
    recipient,
    amount,
    payer = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    oracleAccount: PublicKey;
    tokenMint: PublicKey;
    recipient: PublicKey;
    amount: BN;
    payer?: PublicKey;
  }) {
    return this.program.methods.withdrawTokens({ amount }).accounts({
      performancePackage,
      oracleAccount,
      performancePackageTokenVault: getAssociatedTokenAddressSync(
        tokenMint,
        performancePackage,
        true,
      ),
      tokenMint,
      recipientTokenAccount: getAssociatedTokenAddressSync(
        tokenMint,
        recipient,
        true,
      ),
      recipient,
      payer,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    });
  }

  // The Dao is the package's oracle account; futarchy's AMM vaults are the Dao's ATAs.
  public withdrawViaSellIx({
    performancePackage,
    dao,
    tokenMint,
    quoteMint,
    recipient,
    amount,
    minQuoteOut,
    payer = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    dao: PublicKey;
    tokenMint: PublicKey;
    quoteMint: PublicKey;
    recipient: PublicKey;
    amount: BN;
    minQuoteOut: BN;
    payer?: PublicKey;
  }) {
    return this.program.methods
      .withdrawViaSell({ amount, minQuoteOut })
      .accounts({
        performancePackage,
        dao,
        performancePackageTokenVault: getAssociatedTokenAddressSync(
          tokenMint,
          performancePackage,
          true,
        ),
        tokenMint,
        quoteMint,
        ammBaseVault: getAssociatedTokenAddressSync(tokenMint, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
        packageQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          performancePackage,
          true,
        ),
        recipientQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          recipient,
          true,
        ),
        recipient,
        payer,
        futarchyProgram: FUTARCHY_V0_6_PROGRAM_ID,
        futarchyEventAuthority: getEventAuthorityAddr(
          FUTARCHY_V0_6_PROGRAM_ID,
        )[0],
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ]);
  }

  public proposeChangeIx(params: {
    params: ProposeChangeParams;
    performancePackage: PublicKey;
    proposer: PublicKey;
  }) {
    const changeRequestAddress = this.getChangeRequestAddress(
      params.performancePackage,
      params.proposer,
      params.params.pdaNonce,
    );

    return this.program.methods.proposeChange(params.params).accounts({
      changeRequest: changeRequestAddress,
      performancePackage: params.performancePackage,
      proposer: params.proposer,
      systemProgram: SystemProgram.programId,
    });
  }

  public executeChangeIx(params: {
    performancePackage: PublicKey;
    changeRequest: PublicKey;
    executor: PublicKey;
  }) {
    return this.program.methods.executeChange().accounts({
      changeRequest: params.changeRequest,
      performancePackage: params.performancePackage,
      executor: params.executor,
    });
  }

  public changePerformancePackageAuthorityIx(params: {
    performancePackage: PublicKey;
    currentAuthority: PublicKey;
    newPerformancePackageAuthority: PublicKey;
  }) {
    return this.program.methods
      .changePerformancePackageAuthority({
        newPerformancePackageAuthority: params.newPerformancePackageAuthority,
      })
      .accounts({
        performancePackage: params.performancePackage,
        currentAuthority: params.currentAuthority,
      });
  }

  public burnPerformancePackageIx({
    performancePackage,
    tokenMint,
    recipient,
    admin = this.provider.publicKey,
    spillAccount = admin,
    quoteSweep,
  }: {
    performancePackage: PublicKey;
    tokenMint: PublicKey;
    recipient: PublicKey;
    admin?: PublicKey;
    spillAccount?: PublicKey;
    quoteSweep?: QuoteSweep;
  }) {
    return this.program.methods.burnPerformancePackage().accounts({
      performancePackage,
      performancePackageTokenVault: getAssociatedTokenAddressSync(
        tokenMint,
        performancePackage,
        true,
      ),
      recipient,
      recipientTokenAccount: getAssociatedTokenAddressSync(
        tokenMint,
        recipient,
        true,
      ),
      admin,
      spillAccount,
      tokenMint,
      quoteMint: quoteSweep?.quoteMint ?? null,
      packageQuoteAccount: quoteSweep
        ? getAssociatedTokenAddressSync(
            quoteSweep.quoteMint,
            performancePackage,
            true,
          )
        : null,
      quoteDestination: quoteSweep?.quoteDestination ?? null,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    });
  }

  public resizePerformancePackageIx(params: {
    performancePackage: PublicKey;
    payer: PublicKey;
  }) {
    return this.program.methods.resizePerformancePackage().accounts({
      performancePackage: params.performancePackage,
      payer: params.payer,
      systemProgram: SystemProgram.programId,
    });
  }

  public async getPerformancePackage(
    performancePackageAddress: PublicKey,
  ): Promise<PerformancePackage> {
    return await this.program.account.performancePackage.fetch(
      performancePackageAddress,
    );
  }

  public async getChangeRequest(changeRequestAddress: PublicKey) {
    return await this.program.account.changeRequest.fetch(changeRequestAddress);
  }

  public getChangeRequestAddress(
    performancePackage: PublicKey,
    proposer: PublicKey,
    pdaNonce: number,
  ): PublicKey {
    const [changeRequestAddress] = getChangeRequestAddr({
      programId: this.programId,
      performancePackage,
      proposer,
      pdaNonce,
    });
    return changeRequestAddress;
  }

  public getPerformancePackageTokenAccountAddress(
    performancePackage: PublicKey,
  ): PublicKey {
    const [performancePackageTokenAccountAddress] =
      PublicKey.findProgramAddressSync(
        [
          Buffer.from("performance_package_token_account"),
          performancePackage.toBuffer(),
        ],
        this.programId,
      );
    return performancePackageTokenAccountAddress;
  }

  public getEventAuthorityAddress(): PublicKey {
    return getEventAuthorityAddr(this.programId)[0];
  }
}
