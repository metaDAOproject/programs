import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import {
  createInitializeMint2Instruction,
  getAssociatedTokenAddressSync,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  MAINNET_USDC,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  RELAUNCH_V0_1_PROGRAM_ID,
} from "../../constants.js";
import {
  RelaunchProgram,
  RelaunchIDL,
  RelaunchAccount,
  DepositRecordAccount,
} from "./types/index.js";
import {
  getRelaunchAddr,
  getRelaunchSignerAddr,
  getDepositRecordAddr,
} from "./pda.js";
import { getEventAuthorityAddr, getMetadataAddr } from "../../pda.js";

export type CreateRelaunchClientParams = {
  provider: AnchorProvider;
  relaunchProgramId?: PublicKey;
};

export class RelaunchClient {
  public readonly provider: AnchorProvider;
  public readonly relaunchProgram: Program<RelaunchProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, relaunchProgramId: PublicKey) {
    this.provider = provider;
    this.programId = relaunchProgramId;
    this.relaunchProgram = new Program<RelaunchProgram>(
      RelaunchIDL,
      relaunchProgramId,
      provider,
    );
  }

  public static createClient(
    createRelaunchClientParams: CreateRelaunchClientParams,
  ): RelaunchClient {
    let { provider, relaunchProgramId } = createRelaunchClientParams;

    return new RelaunchClient(
      provider,
      relaunchProgramId || RELAUNCH_V0_1_PROGRAM_ID,
    );
  }

  public getProgramId(): PublicKey {
    return this.programId;
  }

  initializeRelaunchIx({
    newMint,
    oldMint,
    oldTokenProgram,
    sourcePool,
    sourceQuoteMint,
    tokenName,
    tokenSymbol,
    tokenUri,
    secondsForDeposits,
    gracePeriodSeconds,
    thresholdBps,
    // Zero amount with no members initializes without a spending limit.
    monthlySpendingLimitAmount = new BN(0),
    monthlySpendingLimitMembers = [],
    teamAddress,
    mintAuthority = this.provider.publicKey,
    admin = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    newMint: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    sourcePool: PublicKey;
    sourceQuoteMint: PublicKey;
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    secondsForDeposits: number;
    gracePeriodSeconds: number;
    thresholdBps: number;
    monthlySpendingLimitAmount?: BN;
    monthlySpendingLimitMembers?: PublicKey[];
    teamAddress: PublicKey;
    mintAuthority?: PublicKey;
    admin?: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunch = this.getRelaunchAddress({ newMint });
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const newTokenVault = getAssociatedTokenAddressSync(
      newMint,
      relaunchSigner,
      true,
    );
    const sourceQuoteVault = getAssociatedTokenAddressSync(
      sourceQuoteMint,
      relaunchSigner,
      true,
    );
    const usdcVault = getAssociatedTokenAddressSync(
      MAINNET_USDC,
      relaunchSigner,
      true,
    );
    const [tokenMetadata] = getMetadataAddr(newMint);

    return this.relaunchProgram.methods
      .initializeRelaunch({
        tokenName,
        tokenSymbol,
        tokenUri,
        secondsForDeposits,
        gracePeriodSeconds,
        thresholdBps,
        monthlySpendingLimitAmount,
        monthlySpendingLimitMembers,
        teamAddress,
      })
      .accounts({
        relaunch,
        newMint,
        mintAuthority,
        relaunchSigner,
        oldMint,
        sourcePool,
        sourceQuoteMint,
        usdcMint: MAINNET_USDC,
        oldTokenVault,
        newTokenVault,
        sourceQuoteVault,
        usdcVault,
        tokenMetadata,
        admin,
        payer,
        oldTokenProgram,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ]);
  }

  startDepositsIx({
    relaunch,
    admin = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    admin?: PublicKey;
  }) {
    return this.relaunchProgram.methods.startDeposits().accounts({
      relaunch,
      admin,
    });
  }

  depositIx({
    relaunch,
    oldMint,
    oldTokenProgram,
    amount,
    depositor = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    relaunch: PublicKey;
    oldMint: PublicKey;
    oldTokenProgram: PublicKey;
    amount: BN;
    depositor?: PublicKey;
    payer?: PublicKey;
  }) {
    const relaunchSigner = this.getRelaunchSignerAddress({ relaunch });
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });

    const oldTokenVault = getAssociatedTokenAddressSync(
      oldMint,
      relaunchSigner,
      true,
      oldTokenProgram,
    );
    const depositorTokenAccount = getAssociatedTokenAddressSync(
      oldMint,
      depositor,
      false,
      oldTokenProgram,
    );

    return this.relaunchProgram.methods.deposit({ amount }).accounts({
      relaunch,
      depositRecord,
      oldMint,
      oldTokenVault,
      depositor,
      depositorTokenAccount,
      payer,
      oldTokenProgram,
    });
  }

  closeDepositsIx({ relaunch }: { relaunch: PublicKey }) {
    return this.relaunchProgram.methods.closeDeposits().accounts({
      relaunch,
    });
  }

  markFailedIx({ relaunch }: { relaunch: PublicKey }) {
    return this.relaunchProgram.methods.markFailed().accounts({
      relaunch,
    });
  }

  // Deposits from the provider wallet, reading the old mint and its owner
  // program from the stored relaunch.
  async deposit({
    relaunch,
    amount,
  }: {
    relaunch: PublicKey;
    amount: BN;
  }): Promise<TransactionSignature> {
    const storedRelaunch = await this.fetchRelaunch(relaunch);
    if (storedRelaunch === null) {
      throw new Error(`relaunch ${relaunch.toBase58()} does not exist`);
    }

    const oldMintAccount = await this.provider.connection.getAccountInfo(
      storedRelaunch.oldMint,
    );
    if (oldMintAccount === null) {
      throw new Error(
        `old mint ${storedRelaunch.oldMint.toBase58()} does not exist`,
      );
    }

    return this.depositIx({
      relaunch,
      oldMint: storedRelaunch.oldMint,
      oldTokenProgram: oldMintAccount.owner,
      amount,
    }).rpc();
  }

  // Builds the create-mint-to-self pre-instructions: a `createAccountWithSeed`
  // + `initializeMint2` pair with the payer as mint authority, so
  // `initialize_relaunch` can take the authority from a mint the payer
  // provably controls.
  async createNewMintIxs({
    payer = this.provider.publicKey,
    seed = Keypair.generate().publicKey.toBase58().slice(0, 32),
  }: {
    payer?: PublicKey;
    seed?: string;
  } = {}) {
    const newMint = await PublicKey.createWithSeed(
      payer,
      seed,
      TOKEN_PROGRAM_ID,
    );
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        MINT_SIZE,
      );

    const instructions = [
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer,
        basePubkey: payer,
        seed,
        newAccountPubkey: newMint,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(newMint, 6, payer, null),
    ];

    return { newMint, instructions };
  }

  // Creates the new mint and initializes the relaunch in a single
  // transaction, signed entirely by the provider wallet.
  async initializeRelaunch({
    oldMint,
    sourcePool,
    sourceQuoteMint,
    tokenName,
    tokenSymbol,
    tokenUri,
    secondsForDeposits,
    gracePeriodSeconds,
    thresholdBps,
    monthlySpendingLimitAmount,
    monthlySpendingLimitMembers,
    teamAddress,
    admin,
  }: {
    oldMint: PublicKey;
    sourcePool: PublicKey;
    sourceQuoteMint: PublicKey;
    tokenName: string;
    tokenSymbol: string;
    tokenUri: string;
    secondsForDeposits: number;
    gracePeriodSeconds: number;
    thresholdBps: number;
    monthlySpendingLimitAmount?: BN;
    monthlySpendingLimitMembers?: PublicKey[];
    teamAddress: PublicKey;
    admin?: PublicKey;
  }): Promise<{
    newMint: PublicKey;
    relaunch: PublicKey;
    txSignature: TransactionSignature;
  }> {
    const { newMint, instructions } = await this.createNewMintIxs();

    const oldMintAccount =
      await this.provider.connection.getAccountInfo(oldMint);
    if (oldMintAccount === null) {
      throw new Error(`old mint ${oldMint.toBase58()} does not exist`);
    }

    const txSignature = await this.initializeRelaunchIx({
      newMint,
      oldMint,
      oldTokenProgram: oldMintAccount.owner,
      sourcePool,
      sourceQuoteMint,
      tokenName,
      tokenSymbol,
      tokenUri,
      secondsForDeposits,
      gracePeriodSeconds,
      thresholdBps,
      monthlySpendingLimitAmount,
      monthlySpendingLimitMembers,
      teamAddress,
      admin,
    })
      .preInstructions(instructions)
      .rpc();

    return {
      newMint,
      relaunch: this.getRelaunchAddress({ newMint }),
      txSignature,
    };
  }

  async fetchRelaunch(relaunch: PublicKey): Promise<RelaunchAccount | null> {
    return this.relaunchProgram.account.relaunch.fetchNullable(relaunch);
  }

  async deserializeRelaunch(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<RelaunchAccount> {
    return this.relaunchProgram.coder.accounts.decode(
      "relaunch",
      accountInfo.data,
    );
  }

  async fetchDepositRecord(
    depositRecord: PublicKey,
  ): Promise<DepositRecordAccount | null> {
    return this.relaunchProgram.account.depositRecord.fetchNullable(
      depositRecord,
    );
  }

  async deserializeDepositRecord(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<DepositRecordAccount> {
    return this.relaunchProgram.coder.accounts.decode(
      "depositRecord",
      accountInfo.data,
    );
  }

  async getRelaunch({
    newMint,
  }: {
    newMint: PublicKey;
  }): Promise<RelaunchAccount | null> {
    const relaunch = this.getRelaunchAddress({ newMint });
    return this.fetchRelaunch(relaunch);
  }

  async getDepositRecord({
    relaunch,
    depositor,
  }: {
    relaunch: PublicKey;
    depositor: PublicKey;
  }): Promise<DepositRecordAccount | null> {
    const depositRecord = this.getDepositRecordAddress({
      relaunch,
      depositor,
    });
    return this.fetchDepositRecord(depositRecord);
  }

  public getRelaunchAddress({ newMint }: { newMint: PublicKey }): PublicKey {
    return getRelaunchAddr({ programId: this.programId, newMint })[0];
  }

  public getRelaunchSignerAddress({
    relaunch,
  }: {
    relaunch: PublicKey;
  }): PublicKey {
    return getRelaunchSignerAddr({ programId: this.programId, relaunch })[0];
  }

  public getDepositRecordAddress({
    relaunch,
    depositor,
  }: {
    relaunch: PublicKey;
    depositor: PublicKey;
  }): PublicKey {
    return getDepositRecordAddr({
      programId: this.programId,
      relaunch,
      depositor,
    })[0];
  }

  public getEventAuthorityAddress(): PublicKey {
    return getEventAuthorityAddr(this.programId)[0];
  }
}
