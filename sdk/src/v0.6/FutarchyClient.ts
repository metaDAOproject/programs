import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AccountMeta,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { InitializeDaoParams, UpdateDaoParams } from "./types/index.js";

// import { Autocrat, IDL as AutocratIDL } from "./types/autocrat.js";
import { Futarchy, IDL as FutarchyIDL } from "./types/futarchy.js";
import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault.js";

import BN from "bn.js";
import {
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  MAINNET_USDC,
  PERMISSIONLESS_ACCOUNT,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_ID,
  USDC_DECIMALS,
} from "./constants.js";
import {
  DEFAULT_CU_PRICE,
  InstructionUtils,
  MaxCUs,
  getConditionalTokenMintAddr,
  getDaoAddr,
  getEventAuthorityAddr,
  getProposalAddr,
  getProposalAddrV2,
  getQuestionAddr,
  getVaultAddr,
} from "./utils/index.js";
import { ConditionalVaultClient } from "./ConditionalVaultClient.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import { Dao, Proposal } from "./types/index.js";

import * as multisig from "@sqds/multisig";
import { TransactionMessage } from "@solana/web3.js";

export type CreateClientParams = {
  provider: AnchorProvider;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
};

export type ProposalVaults = {
  baseVault: PublicKey;
  quoteVault: PublicKey;
};

export class FutarchyClient {
  public readonly provider: AnchorProvider;
  public readonly autocrat: Program<Futarchy>;
  public readonly vaultClient: ConditionalVaultClient;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    autocratProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[],
  ) {
    this.provider = provider;
    this.autocrat = new Program<Futarchy>(
      FutarchyIDL,
      autocratProgramId,
      provider,
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.luts = luts;
  }

  public static createClient(
    createAutocratClientParams: CreateClientParams,
  ): FutarchyClient {
    let { provider, autocratProgramId, conditionalVaultProgramId } =
      createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new FutarchyClient(
      provider,
      autocratProgramId || AUTOCRAT_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      luts,
    );
  }

  getProgramId(): PublicKey {
    return this.autocrat.programId;
  }

  async getProposal(proposal: PublicKey): Promise<Proposal> {
    return this.autocrat.account.proposal.fetch(proposal);
  }

  async getDao(dao: PublicKey): Promise<Dao> {
    return this.autocrat.account.dao.fetch(dao);
  }

  async fetchProposal(proposal: PublicKey): Promise<Proposal | null> {
    return this.autocrat.account.proposal.fetchNullable(proposal);
  }

  async fetchDao(dao: PublicKey): Promise<Dao | null> {
    return this.autocrat.account.dao.fetchNullable(dao);
  }

  async deserializeProposal(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<Proposal> {
    return this.autocrat.coder.accounts.decode("proposal", accountInfo.data);
  }

  async deserializeDao(accountInfo: AccountInfo<Buffer>): Promise<Dao> {
    return this.autocrat.coder.accounts.decode("dao", accountInfo.data);
  }

  getProposalPdas(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    dao: PublicKey,
  ): {
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    passBaseMint: PublicKey;
    passQuoteMint: PublicKey;
    failBaseMint: PublicKey;
    failQuoteMint: PublicKey;
  } {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const [question] = getQuestionAddr(
      vaultProgramId,
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2,
    );
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      question,
      baseMint,
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      question,
      quoteMint,
    );

    const [failBaseMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      baseVault,
      0,
    );
    const [failQuoteMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      quoteVault,
      0,
    );

    const [passBaseMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      baseVault,
      1,
    );
    const [passQuoteMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      quoteVault,
      1,
    );

    return {
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    };
  }

  initializeDaoIx({
    baseMint,
    params,
    provideLiquidity = false,
    quoteMint = MAINNET_USDC,
    squadsProgramConfigTreasury = SQUADS_PROGRAM_CONFIG_TREASURY,
  }: {
    baseMint: PublicKey;
    params: InitializeDaoParams;
    provideLiquidity?: boolean;
    quoteMint?: PublicKey;
    squadsProgramConfigTreasury?: PublicKey;
  }) {
    const [dao] = getDaoAddr({
      nonce: params.nonce,
      daoCreator: this.provider.publicKey,
    });
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    let daoCreatorBaseAccount = null;
    let daoCreatorQuoteAccount = null;
    if (provideLiquidity) {
      daoCreatorBaseAccount = getAssociatedTokenAddressSync(
        baseMint,
        this.provider.publicKey,
        true,
      );
      daoCreatorQuoteAccount = getAssociatedTokenAddressSync(
        quoteMint,
        this.provider.publicKey,
        true,
      );
    }

    const spendingLimit = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];

    return this.autocrat.methods.initializeDao(params).accounts({
      dao,
      baseMint,
      quoteMint,
      squadsMultisig: multisigPda,
      squadsMultisigVault,
      squadsProgramConfig: SQUADS_PROGRAM_CONFIG,
      squadsProgramConfigTreasury,
      squadsProgram: SQUADS_PROGRAM_ID,
      spendingLimit,
      futarchyAmmBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
      futarchyAmmQuoteVault: getAssociatedTokenAddressSync(
        quoteMint,
        dao,
        true,
      ),
    });
  }

  launchProposalIx({
    proposal,
    dao,
    baseMint,
    quoteMint,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  }) {
    const {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.getProposalPdas(proposal, baseMint, quoteMint, dao);

    return this.autocrat.methods
      .launchProposal()
      .accounts({
        proposal,
        dao,
        baseVault,
        quoteVault,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        ammPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          dao,
          true,
        ),
        ammPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          dao,
          true,
        ),
        ammFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          dao,
          true,
        ),
        ammFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          dao,
          true,
        ),
        payer: this.provider.publicKey,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ]);
  }

  spotSwapIx({
    dao,
    baseMint,
    quoteMint = MAINNET_USDC,
    swapType,
    inputAmount,
    minOutputAmount = new BN(0),
    trader = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    swapType: "buy" | "sell";
    inputAmount: BN;
    minOutputAmount?: BN;
    trader?: PublicKey;
  }) {
    return this.autocrat.methods
      .spotSwap({
        swapType: swapType === "buy" ? { buy: {} } : { sell: {} },
        inputAmount,
        minOutputAmount,
      })
      .accounts({
        dao,
        userBaseAccount: getAssociatedTokenAddressSync(baseMint, trader, true),
        userQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          trader,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
        user: trader,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(baseMint, trader, true),
          trader,
          baseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(quoteMint, trader, true),
          trader,
          quoteMint,
        ),
      ]);
  }

  provideLiquidityIx({
    dao,
    baseMint,
    quoteMint,
    quoteAmount,
    maxBaseAmount,
    minLiquidity = new BN(0),
    positionAuthority = this.provider.publicKey,
    liquidityProvider = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    quoteAmount: BN;
    maxBaseAmount: BN;
    minLiquidity?: BN;
    positionAuthority?: PublicKey;
    liquidityProvider?: PublicKey;
  }) {
    console.log(positionAuthority);
    const ammPosition = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        positionAuthority.toBuffer(),
      ],
      this.getProgramId(),
    )[0];

    return this.autocrat.methods
      .provideLiquidity({
        quoteAmount,
        maxBaseAmount,
        minLiquidity,
        positionAuthority,
      })
      .accounts({
        dao,
        liquidityProvider,
        liquidityProviderBaseAccount: getAssociatedTokenAddressSync(
          baseMint,
          liquidityProvider,
          true,
        ),
        liquidityProviderQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          liquidityProvider,
          true,
        ),
        payer: this.provider.publicKey,
        systemProgram: SystemProgram.programId,
        ammBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
        ammPosition,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(baseMint, liquidityProvider, true),
          liquidityProvider,
          baseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(quoteMint, liquidityProvider, true),
          liquidityProvider,
          quoteMint,
        ),
      ]);
  }

  conditionalSwapIx({
    dao,
    trader = this.provider.publicKey,
    payer = this.provider.publicKey,
    baseMint,
    quoteMint,
    proposal,
    market,
    swapType,
    inputAmount,
    minOutputAmount,
  }: {
    dao: PublicKey;
    trader?: PublicKey;
    payer?: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    proposal: PublicKey;
    market: "pass" | "fail";
    swapType: "buy" | "sell";
    inputAmount: BN;
    minOutputAmount: BN;
  }) {
    const {
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      baseVault,
      quoteVault,
      question,
    } = this.getProposalPdas(proposal, baseMint, quoteMint, dao);

    let inputMint: PublicKey, outputMint: PublicKey;

    if (market == "pass" && swapType == "buy") {
      inputMint = passQuoteMint;
      outputMint = passBaseMint;
    } else if (market == "pass" && swapType == "sell") {
      inputMint = passBaseMint;
      outputMint = passQuoteMint;
    } else if (market == "fail" && swapType == "buy") {
      inputMint = failQuoteMint;
      outputMint = failBaseMint;
    } else if (market == "fail" && swapType == "sell") {
      inputMint = failBaseMint;
      outputMint = failQuoteMint;
    } else {
      throw new Error(
        "Either `market` or `swapType` is incorrectly configured",
      );
    }

    return this.autocrat.methods
      .conditionalSwap({
        market: market == "pass" ? { pass: {} } : { fail: {} },
        swapType: swapType == "buy" ? { buy: {} } : { sell: {} },
        inputAmount,
        minOutputAmount,
      })
      .accounts({
        dao,
        proposal,
        ammBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
        ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
        ammPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          dao,
          true,
        ),
        ammPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          dao,
          true,
        ),
        ammFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          dao,
          true,
        ),
        ammFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          dao,
          true,
        ),
        baseVault,
        quoteVault,
        userInputAccount: getAssociatedTokenAddressSync(
          inputMint,
          trader,
          true,
        ),
        userOutputAccount: getAssociatedTokenAddressSync(
          outputMint,
          trader,
          true,
        ),
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          baseVault,
          true,
        ),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          quoteMint,
          quoteVault,
          true,
        ),
        passBaseMint,
        failBaseMint,
        passQuoteMint,
        failQuoteMint,
        conditionalVaultProgram: this.vaultClient.vaultProgram.programId,
        vaultEventAuthority: getEventAuthorityAddr(
          this.vaultClient.vaultProgram.programId,
        )[0],
        question,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(outputMint, trader, true),
          trader,
          outputMint,
        ),
      ]);
  }

  squadsProposalCreateTx({
    dao,
    instructions,
    transactionIndex,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    instructions: TransactionInstruction[];
    transactionIndex: bigint;
    payer?: PublicKey;
  }): { tx: Transaction; squadsProposal: PublicKey } {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const transactionMessage = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: "", // this doesn't get used
      instructions,
    });

    const vaultTxCreate = multisig.instructions.vaultTransactionCreate({
      multisigPda,
      transactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: payer,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage,
    });

    const proposalCreate = multisig.instructions.proposalCreate({
      multisigPda,
      transactionIndex,
      creator: PERMISSIONLESS_ACCOUNT.publicKey,
      rentPayer: payer,
    });

    const [squadsProposal] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: transactionIndex,
    });

    const tx = new Transaction().add(vaultTxCreate, proposalCreate);

    return { tx, squadsProposal };
  }

  async initializeProposal(
    dao: PublicKey,
    squadsProposal: PublicKey,
  ): Promise<PublicKey> {
    const storedDao = await this.getDao(dao);

    let [proposal] = getProposalAddr(this.autocrat.programId, squadsProposal);

    await this.vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2,
    );

    const { question } = this.getProposalPdas(
      proposal,
      storedDao.baseMint,
      storedDao.quoteMint,
      dao,
    );

    // it's important that these happen in a single atomic transaction
    await this.vaultClient
      .initializeVaultIx(question, storedDao.baseMint, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.initializeVaultIx(question, storedDao.quoteMint, 2),
        ),
      )
      .rpc();

    await this.initializeProposalIx(
      squadsProposal,
      dao,
      storedDao.baseMint,
      storedDao.quoteMint,
      question,
    )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ])
      .rpc();

    return proposal;
  }

  initializeProposalIx(
    squadsProposal: PublicKey,
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    question: PublicKey,
    proposer: PublicKey = this.provider.publicKey,
  ) {
    let [proposal] = getProposalAddr(this.autocrat.programId, squadsProposal);
    const {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.getProposalPdas(proposal, baseMint, quoteMint, dao);

    let [futarchyAmm] = PublicKey.findProgramAddressSync(
      [Buffer.from("futarchy_amm")],
      this.getProgramId(),
    );

    return this.autocrat.methods
      .initializeProposal()
      .accounts({
        question,
        proposal,
        squadsProposal,
        dao,
        baseVault,
        quoteVault,
        proposer,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
          futarchyAmm,
          passBaseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
          futarchyAmm,
          passQuoteMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
          futarchyAmm,
          failBaseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
          futarchyAmm,
          failQuoteMint,
        ),
      ]);
  }

  async finalizeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);
    let storedDao = await this.getDao(storedProposal.dao);

    return this.finalizeProposalIx(
      proposal,
      storedProposal.squadsProposal,
      storedProposal.dao,
      storedDao.baseMint,
      storedDao.quoteMint,
    ).rpc();
  }

  finalizeProposalIxV2({
    squadsProposal,
    dao,
    baseMint,
    quoteMint = MAINNET_USDC,
  }: {
    squadsProposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
  }) {
    const [proposal] = getProposalAddrV2({ squadsProposal });

    return this.finalizeProposalIx(
      proposal,
      squadsProposal,
      dao,
      baseMint,
      quoteMint,
    );
  }

  /**
   * @deprecated use `finalizeProposalIxV2` instead
   */
  finalizeProposalIx(
    proposal: PublicKey,
    squadsProposal: PublicKey,
    dao: PublicKey,
    daoToken: PublicKey,
    usdc: PublicKey,
  ) {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const {
      question,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      baseVault,
    } = this.getProposalPdas(proposal, daoToken, usdc, dao);

    const [vaultEventAuthority] = getEventAuthorityAddr(vaultProgramId);

    return this.autocrat.methods
      .finalizeProposal()
      .accounts({
        proposal,
        // futarchyAmm,
        dao,
        squadsProposal,
        squadsMultisig: multisigPda,
        squadsMultisigProgram: SQUADS_PROGRAM_ID,
        quoteVault,
        question,
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          usdc,
          quoteVault,
          true,
        ),
        passQuoteMint,
        failQuoteMint,
        passBaseMint,
        failBaseMint,
        ammPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          dao,
          true,
        ),
        ammFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          dao,
          true,
        ),
        ammQuoteVault: getAssociatedTokenAddressSync(usdc, dao, true),
        ammPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          dao,
          true,
        ),
        ammFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          dao,
          true,
        ),
        ammBaseVault: getAssociatedTokenAddressSync(daoToken, dao, true),
        baseVault,
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          daoToken,
          baseVault,
          true,
        ),
        // baseVault,
        // quoteVault,
        vaultProgram: this.vaultClient.vaultProgram.programId,
        vaultEventAuthority,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ]);
  }

  // async executeProposal(proposal: PublicKey) {
  //   let storedProposal = await this.getProposal(proposal);

  //   return this.executeProposalIx(
  //     proposal,
  //     storedProposal.dao,
  //     storedProposal.instruction
  //   ).rpc();
  // }

  // executeProposalIx(proposal: PublicKey, dao: PublicKey, instruction: any) {
  //   const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
  //   return this.autocrat.methods
  //     .executeProposal()
  //     .accounts({
  //       proposal,
  //       dao,
  //       // daoTreasury,
  //     })
  //     .remainingAccounts(
  //       instruction.accounts
  //         .concat({
  //           pubkey: instruction.programId,
  //           isWritable: false,
  //           isSigner: false,
  //         })
  //         .map((meta: AccountMeta) =>
  //           meta.pubkey.equals(daoTreasury)
  //             ? { ...meta, isSigner: false }
  //             : meta
  //         )
  //     );
  // }

  updateDaoIx({ dao, params }: { dao: PublicKey; params: UpdateDaoParams }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    return this.autocrat.methods.updateDao(params).accounts({
      dao,
      squadsMultisigVault,
    });
  }

  stakeToProposalIx({
    proposal,
    dao,
    baseMint,
    amount,
    staker = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    amount: BN;
    staker?: PublicKey;
    payer?: PublicKey;
  }) {
    const stakeAccount = PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), proposal.toBuffer(), staker.toBuffer()],
      this.getProgramId(),
    )[0];

    return this.autocrat.methods
      .stakeToProposal({ amount })
      .accounts({
        proposal,
        dao,
        stakerBaseAccount: getAssociatedTokenAddressSync(
          baseMint,
          staker,
          true,
        ),
        proposalBaseAccount: getAssociatedTokenAddressSync(
          baseMint,
          proposal,
          true,
        ),
        stakeAccount,
        staker,
        payer,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(baseMint, staker, true),
          staker,
          baseMint,
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          getAssociatedTokenAddressSync(baseMint, proposal, true),
          proposal,
          baseMint,
        ),
      ]);
  }

  collectFeesIx({
    dao,
    baseMint,
    quoteMint,
    baseTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      this.provider.publicKey,
    ),
    quoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      this.provider.publicKey,
    ),
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    baseTokenAccount?: PublicKey;
    quoteTokenAccount?: PublicKey;
  }) {
    return this.autocrat.methods.collectFees().accounts({
      dao,
      admin: this.provider.publicKey,
      ammBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
      ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
      baseTokenAccount,
      quoteTokenAccount,
    });
  }

  // cranks the TWAPs of multiple proposals' markets. there's a limit on the
  // number of proposals you can pass in, which I can't determine rn because
  // there aren't enough proposals on devnet
  // async crankProposalMarkets(
  //   proposals: PublicKey[],
  //   priorityFeeMicroLamports: number
  // ) {
  //   const amms: PublicKey[] = [];

  //   for (const proposal of proposals) {
  //     const storedProposal = await this.getProposal(proposal);
  //     amms.push(storedProposal.passAmm);
  //     amms.push(storedProposal.failAmm);
  //   }

  //   while (true) {
  //     let ixs: TransactionInstruction[] = [];

  //     for (const amm of amms) {
  //       ixs.push(await this.ammClient.crankThatTwapIx(amm).instruction());
  //     }

  //     let tx = new Transaction();
  //     tx.add(
  //       ComputeBudgetProgram.setComputeUnitLimit({ units: 4_000 * ixs.length })
  //     );
  //     tx.add(
  //       ComputeBudgetProgram.setComputeUnitPrice({
  //         microLamports: priorityFeeMicroLamports,
  //       })
  //     );
  //     tx.add(...ixs);
  //     try {
  //       await this.provider.sendAndConfirm(tx);
  //     } catch (err) {
  //       console.log("err", err);
  //     }

  //     await new Promise((resolve) => setTimeout(resolve, 65 * 1000)); // 65,000 milliseconds = 1 minute and 5 seconds
  //   }
  // }
}
