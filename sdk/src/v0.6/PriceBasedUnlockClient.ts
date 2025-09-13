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
  PriceBasedUnlock,
  IDL as PriceBasedUnlockIDL,
} from "./types/price_based_unlock.js";
import { PRICE_BASED_TOKEN_LOCK_PROGRAM_ID } from "./constants.js";
import BN from "bn.js";
import { OracleConfig } from "./types/index.js";
import { getEventAuthorityAddr } from "./utils/pda.js";

export type CreatePriceBasedTokenLockClientParams = {
  provider: AnchorProvider;
  priceBasedTokenLockProgramId?: PublicKey;
};

export class PriceBasedUnlockClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<PriceBasedUnlock>;
  public readonly programId: PublicKey;

  constructor(
    provider: AnchorProvider,
    priceBasedTokenLockProgramId: PublicKey,
  ) {
    this.provider = provider;
    this.programId = priceBasedTokenLockProgramId;
    this.program = new Program<PriceBasedUnlock>(
      PriceBasedUnlockIDL,
      priceBasedTokenLockProgramId,
      provider,
    );
  }

  public static createClient(
    createClientParams: CreatePriceBasedTokenLockClientParams,
  ): PriceBasedUnlockClient {
    let { provider, priceBasedTokenLockProgramId } = createClientParams;

    if (!priceBasedTokenLockProgramId) {
      priceBasedTokenLockProgramId = PRICE_BASED_TOKEN_LOCK_PROGRAM_ID;
    }

    return new PriceBasedUnlockClient(provider, priceBasedTokenLockProgramId);
  }

  public initializeLockerIx(params: {
    params: {
      priceThreshold: BN;
      tokenAmount: BN;
      unlockTimestamp: BN;
      oracleConfig: OracleConfig;
      twapLengthSeconds: BN;
      tokenRecipient: PublicKey;
      lockerAuthority: PublicKey;
    };
    createKey: PublicKey;
    tokenMint: PublicKey;
    fromTokenAccount: PublicKey;
    tokenAuthority: PublicKey;
    payer: PublicKey;
  }) {
    const lockerTokenAccount = this.getLockerTokenAccountAddress(
      this.getLockerAddress(params.createKey),
    );

    return this.program.methods
      .initializeLocker({
        priceThreshold: params.params.priceThreshold,
        tokenAmount: params.params.tokenAmount,
        unlockTimestamp: params.params.unlockTimestamp,
        oracleConfig: params.params.oracleConfig,
        twapLengthSeconds: params.params.twapLengthSeconds,
        beneficiary: params.params.tokenRecipient,
        lockerAuthority: params.params.lockerAuthority,
      })
      .accounts({
        locker: this.getLockerAddress(params.createKey),
        createKey: params.createKey,
        tokenMint: params.tokenMint,
        fromTokenAccount: params.fromTokenAccount,
        tokenAuthority: params.tokenAuthority,
        lockerTokenAccount,
        payer: params.payer,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        eventAuthority: this.getEventAuthorityAddress(),
        program: this.programId,
      });
  }

  public startUnlockIx(params: {
    locker: PublicKey;
    oracleAccount: PublicKey;
    recipient: PublicKey;
  }) {
    return this.program.methods.startUnlock().accounts({
      locker: params.locker,
      oracleAccount: params.oracleAccount,
      recipient: params.recipient,
      eventAuthority: this.getEventAuthorityAddress(),
      program: this.programId,
    });
  }

  public completeUnlockIx(params: {
    locker: PublicKey;
    oracleAccount: PublicKey;
    tokenMint: PublicKey;
    tokenRecipient: PublicKey;
    payer: PublicKey;
  }) {
    return this.program.methods.completeUnlock().accounts({
      locker: params.locker,
      oracleAccount: params.oracleAccount,
      lockerTokenAccount: this.getLockerTokenAccountAddress(params.locker),
      tokenMint: params.tokenMint,
      recipientTokenAccount: getAssociatedTokenAddressSync(
        params.tokenMint,
        params.tokenRecipient,
      ),
      tokenRecipient: params.tokenRecipient,
      payer: params.payer,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      eventAuthority: this.getEventAuthorityAddress(),
      program: this.programId,
    });
  }

  public proposeChangeIx(params: {
    params: {
      changeType: any;
      pdaNonce: number;
    };
    locker: PublicKey;
    proposer: PublicKey;
    payer: PublicKey;
  }) {
    const changeRequestAddress = this.getChangeRequestAddress(
      params.locker,
      params.proposer,
      params.params.pdaNonce,
    );

    return this.program.methods.proposeChange(params.params).accounts({
      changeRequest: changeRequestAddress,
      locker: params.locker,
      proposer: params.proposer,
      systemProgram: SystemProgram.programId,
      eventAuthority: this.getEventAuthorityAddress(),
      program: this.programId,
    });
  }

  public executeChangeIx(params: {
    locker: PublicKey;
    changeRequest: PublicKey;
    executor: PublicKey;
  }) {
    return this.program.methods.executeChange().accounts({
      changeRequest: params.changeRequest,
      locker: params.locker,
      executor: params.executor,
      eventAuthority: this.getEventAuthorityAddress(),
      program: this.programId,
    });
  }

  public changeLockerAuthorityIx(params: {
    locker: PublicKey;
    currentAuthority: PublicKey;
    newLockerAuthority: PublicKey;
  }) {
    return this.program.methods
      .changeLockerAuthority({
        newLockerAuthority: params.newLockerAuthority,
      })
      .accounts({
        locker: params.locker,
        currentAuthority: params.currentAuthority,
        eventAuthority: this.getEventAuthorityAddress(),
        program: this.programId,
      });
  }

  public async getLocker(lockerAddress: PublicKey) {
    return await this.program.account.locker.fetch(lockerAddress);
  }

  public async getChangeRequest(changeRequestAddress: PublicKey) {
    return await this.program.account.changeRequest.fetch(changeRequestAddress);
  }

  public getLockerAddress(createKey: PublicKey): PublicKey {
    const [lockerAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker"), createKey.toBuffer()],
      this.programId,
    );
    return lockerAddress;
  }

  public getChangeRequestAddress(
    locker: PublicKey,
    proposer: PublicKey,
    pdaNonce: number,
  ): PublicKey {
    const [changeRequestAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("change_request"),
        locker.toBuffer(),
        proposer.toBuffer(),
        Buffer.from(new Uint8Array(new Uint32Array([pdaNonce]).buffer)),
      ],
      this.programId,
    );
    return changeRequestAddress;
  }

  public getLockerTokenAccountAddress(locker: PublicKey): PublicKey {
    const [lockerTokenAccountAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("locker_token_account"), locker.toBuffer()],
      this.programId,
    );
    return lockerTokenAccountAddress;
  }

  public getEventAuthorityAddress(): PublicKey {
    return getEventAuthorityAddr(this.programId)[0];
  }
}
