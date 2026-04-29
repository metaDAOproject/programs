import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
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
import { PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID } from "../../constants.js";
import BN from "bn.js";
// import { OracleConfig } from "./types/index.js";
import { getChangeRequestAddr, getPerformancePackageAddr } from "./pda.js";
import { getEventAuthorityAddr } from "../../pda.js";
import { InitializePerformancePackageParams } from "./types/index.js";

export type CreatePriceBasedPerformancePackageClientParams = {
  provider: AnchorProvider;
  priceBasedTokenLockProgramId?: PublicKey;
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
    const performancePackage = getPerformancePackageAddr({
      createKey: params.createKey,
    })[0];

    const grantorTokenAccount =
      params.grantorTokenAccount ??
      getAssociatedTokenAddressSync(params.tokenMint, params.grantor, true);

    return this.program.methods
      .initializePerformancePackage(params.params)
      .accounts({
        performancePackage,
        createKey: params.createKey,
        tokenMint: params.tokenMint,
        grantorTokenAccount,
        performancePackageTokenVault: getAssociatedTokenAddressSync(
          params.tokenMint,
          performancePackage,
          true,
        ),
        grantor: params.grantor,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      });
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
    tokenMint: PublicKey;
    tokenRecipient: PublicKey;
  }) {
    return this.program.methods.completeUnlock().accounts({
      performancePackage: params.performancePackage,
      oracleAccount: params.oracleAccount,
      performancePackageTokenVault: getAssociatedTokenAddressSync(
        params.tokenMint,
        params.performancePackage,
        true,
      ),
      tokenMint: params.tokenMint,
      recipientTokenAccount: getAssociatedTokenAddressSync(
        params.tokenMint,
        params.tokenRecipient,
        true,
      ),
      tokenRecipient: params.tokenRecipient,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    });
  }

  public proposeChangeIx(params: {
    params: {
      changeType: any;
      pdaNonce: number;
    };
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

  public async getPerformancePackage(performancePackageAddress: PublicKey) {
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
