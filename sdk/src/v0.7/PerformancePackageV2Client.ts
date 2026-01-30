import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
  MINT_GOVERNOR_PROGRAM_ID,
} from "./constants.js";
import {
  getPerformancePackageV2Addr,
  getChangeRequestV2Addr,
} from "./utils/pda.js";
import {
  PerformancePackageV2 as PerformancePackageV2Program,
  IDL as PerformancePackageV2IDL,
} from "./types/performance_package_v2.js";
import type {
  PerformancePackageV2Account,
  ChangeRequestV2Account,
  OracleReaderV2,
  RewardFunctionV2,
} from "./types/index.js";

export type CreatePerformancePackageV2ClientParams = {
  provider: AnchorProvider;
  programId?: PublicKey;
};

export class PerformancePackageV2Client {
  public readonly provider: AnchorProvider;
  public readonly program: Program<PerformancePackageV2Program>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, programId: PublicKey) {
    this.provider = provider;
    this.programId = programId;
    this.program = new Program<PerformancePackageV2Program>(
      PerformancePackageV2IDL,
      programId,
      provider,
    );
  }

  public static createClient(
    params: CreatePerformancePackageV2ClientParams,
  ): PerformancePackageV2Client {
    const { provider, programId } = params;
    return new PerformancePackageV2Client(
      provider,
      programId || PERFORMANCE_PACKAGE_V2_PROGRAM_ID,
    );
  }

  getPerformancePackageAddr(createKey: PublicKey): [PublicKey, number] {
    return getPerformancePackageV2Addr({
      programId: this.programId,
      createKey,
    });
  }

  getChangeRequestAddr(
    performancePackage: PublicKey,
    proposer: PublicKey,
    pdaNonce: number,
  ): [PublicKey, number] {
    return getChangeRequestV2Addr({
      programId: this.programId,
      performancePackage,
      proposer,
      pdaNonce,
    });
  }

  async fetchPerformancePackage(
    performancePackage: PublicKey,
  ): Promise<PerformancePackageV2Account | null> {
    return this.program.account.performancePackage.fetchNullable(
      performancePackage,
    );
  }

  async deserializePerformancePackage(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<PerformancePackageV2Account> {
    return this.program.coder.accounts.decode(
      "performancePackage",
      accountInfo.data,
    );
  }

  async fetchChangeRequest(
    changeRequest: PublicKey,
  ): Promise<ChangeRequestV2Account | null> {
    return this.program.account.changeRequest.fetchNullable(changeRequest);
  }

  async deserializeChangeRequest(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<ChangeRequestV2Account> {
    return this.program.coder.accounts.decode(
      "changeRequest",
      accountInfo.data,
    );
  }

  initializePerformancePackageIx({
    createKey,
    mint,
    mintGovernor,
    mintAuthority,
    authority,
    recipient,
    payer = this.provider.publicKey,
    oracleReader,
    rewardFunction,
    minUnlockTimestamp,
  }: {
    createKey: PublicKey;
    mint: PublicKey;
    mintGovernor: PublicKey;
    mintAuthority: PublicKey;
    authority: PublicKey;
    recipient: PublicKey;
    payer?: PublicKey;
    oracleReader: OracleReaderV2;
    rewardFunction: RewardFunctionV2;
    minUnlockTimestamp: BN;
  }) {
    const [performancePackage] = this.getPerformancePackageAddr(createKey);

    return this.program.methods
      .initializePerformancePackage({
        oracleReader,
        rewardFunction,
        minUnlockTimestamp,
      })
      .accounts({
        performancePackage,
        mint,
        mintGovernor,
        mintAuthority,
        createKey,
        authority,
        recipient,
        payer,
        systemProgram: SystemProgram.programId,
      });
  }

  startUnlockIx({
    performancePackage,
    signer = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    signer?: PublicKey;
  }) {
    return this.program.methods.startUnlock().accounts({
      performancePackage,
      signer,
    });
  }

  completeUnlockIx({
    performancePackage,
    mintGovernor,
    mintAuthority,
    mint,
    recipient,
    signer = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    mintGovernor: PublicKey;
    mintAuthority: PublicKey;
    mint: PublicKey;
    recipient: PublicKey;
    signer?: PublicKey;
  }) {
    const recipientAta = getAssociatedTokenAddressSync(mint, recipient, true);

    return this.program.methods.completeUnlock().accounts({
      performancePackage,
      mintGovernor,
      mintAuthority,
      mint,
      recipientAta,
      signer,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      mintGovernorProgram: MINT_GOVERNOR_PROGRAM_ID,
    });
  }

  changeAuthorityIx({
    performancePackage,
    authority = this.provider.publicKey,
    newAuthority,
  }: {
    performancePackage: PublicKey;
    authority?: PublicKey;
    newAuthority: PublicKey;
  }) {
    return this.program.methods.changeAuthority().accounts({
      performancePackage,
      authority,
      newAuthority,
    });
  }

  proposeChangeIx({
    performancePackage,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
    pdaNonce,
    newRecipient = null,
    newOracleReader = null,
    newRewardFunction = null,
  }: {
    performancePackage: PublicKey;
    proposer?: PublicKey;
    payer?: PublicKey;
    pdaNonce: number;
    newRecipient?: PublicKey | null;
    newOracleReader?: OracleReaderV2 | null;
    newRewardFunction?: RewardFunctionV2 | null;
  }) {
    const [changeRequest] = this.getChangeRequestAddr(
      performancePackage,
      proposer,
      pdaNonce,
    );

    return this.program.methods
      .proposeChange({
        pdaNonce,
        newRecipient,
        newOracleReader,
        newRewardFunction,
      })
      .accounts({
        performancePackage,
        changeRequest,
        proposer,
        payer,
        systemProgram: SystemProgram.programId,
      });
  }

  executeChangeIx({
    performancePackage,
    changeRequest,
    executor = this.provider.publicKey,
    rentDestination = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    changeRequest: PublicKey;
    executor?: PublicKey;
    rentDestination?: PublicKey;
  }) {
    return this.program.methods.executeChange().accounts({
      performancePackage,
      changeRequest,
      executor,
      rentDestination,
    });
  }

  closePerformancePackageIx({
    performancePackage,
    admin = this.provider.publicKey,
    rentDestination = this.provider.publicKey,
  }: {
    performancePackage: PublicKey;
    admin?: PublicKey;
    rentDestination?: PublicKey;
  }) {
    return this.program.methods.closePerformancePackage().accounts({
      performancePackage,
      admin,
      rentDestination,
    });
  }
}
