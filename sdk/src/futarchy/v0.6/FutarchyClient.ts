import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";

import {
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  MAINNET_USDC,
  PERMISSIONLESS_ACCOUNT,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_ID,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
  METADAO_MULTISIG_VAULT,
  DAMM_V2_PROGRAM_ID,
  LAUNCHPAD_V0_7_PROGRAM_ID,
  DAMM_V2_POOL_AUTHORITY,
} from "../../constants.js";
import { getEventAuthorityAddr } from "../../pda.js";
import { InstructionUtils } from "../../utils.js";

import {
  Dao,
  Proposal,
  InitializeDaoParams,
  UpdateDaoParams,
} from "./types/index.js";
import { Futarchy, IDL as FutarchyIDL } from "./types/futarchy.js";
import {
  Futarchy as v0_6_0_futarchy,
  IDL as v0_6_0_futarchyIDL,
} from "./types/v0.6.0-futarchy.js";
import {
  getDaoAddr,
  getProposalAddr,
  getProposalAddrV2,
  getStakeAddr,
} from "./pda.js";

import {
  getQuestionAddr,
  getVaultAddr,
  getConditionalTokenMintAddr,
} from "../../conditional_vault/v0.4/index.js";
import { ConditionalVaultClient } from "../../conditional_vault/v0.4/index.js";

export type CreateClientParams = {
  provider: AnchorProvider;
  futarchyProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
};

export type ProposalVaults = {
  baseVault: PublicKey;
  quoteVault: PublicKey;
};

export class FutarchyClient {
  public readonly provider: AnchorProvider;
  public readonly futarchy: Program<Futarchy>;
  public readonly v0_6_0_futarchy: Program<v0_6_0_futarchy>;
  public readonly vaultClient: ConditionalVaultClient;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    futarchyProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[],
  ) {
    this.provider = provider;
    this.futarchy = new Program<Futarchy>(
      FutarchyIDL,
      futarchyProgramId,
      provider,
    );
    this.v0_6_0_futarchy = new Program<v0_6_0_futarchy>(
      v0_6_0_futarchyIDL,
      futarchyProgramId,
      provider,
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.luts = luts;
  }

  public static createClient(
    createFutarchyClientParams: CreateClientParams,
  ): FutarchyClient {
    let { provider, futarchyProgramId, conditionalVaultProgramId } =
      createFutarchyClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new FutarchyClient(
      provider,
      futarchyProgramId || FUTARCHY_V0_6_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
      luts,
    );
  }

  getProgramId(): PublicKey {
    return this.futarchy.programId;
  }

  async getProposal(proposal: PublicKey): Promise<Proposal> {
    return this.futarchy.account.proposal.fetch(proposal);
  }

  async getDao(dao: PublicKey): Promise<Dao> {
    return this.futarchy.account.dao.fetch(dao);
  }

  async fetchProposal(proposal: PublicKey): Promise<Proposal | null> {
    return this.futarchy.account.proposal.fetchNullable(proposal);
  }

  async fetchDao(dao: PublicKey): Promise<Dao | null> {
    return this.futarchy.account.dao.fetchNullable(dao);
  }

  async deserializeProposal(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<Proposal> {
    return this.futarchy.coder.accounts.decode("proposal", accountInfo.data);
  }

  async deserializeDao(accountInfo: AccountInfo<Buffer>): Promise<Dao> {
    return this.futarchy.coder.accounts.decode("dao", accountInfo.data);
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

    return this.futarchy.methods.initializeDao(params).accounts({
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
    squadsProposal,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    squadsProposal: PublicKey;
  }) {
    const {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.getProposalPdas(proposal, baseMint, quoteMint, dao);

    const squadsMultisig = multisig.getMultisigPda({ createKey: dao })[0];

    return this.futarchy.methods
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
        squadsMultisig,
        squadsProposal,
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
    return this.futarchy.methods
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
    const ammPosition = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        positionAuthority.toBuffer(),
      ],
      this.getProgramId(),
    )[0];

    return this.futarchy.methods
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
    quoteMint = MAINNET_USDC,
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
    quoteMint?: PublicKey;
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

    return this.futarchy.methods
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
      });
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

    let [proposal] = getProposalAddr(this.futarchy.programId, squadsProposal);

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
    let [proposal] = getProposalAddr(this.futarchy.programId, squadsProposal);
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

    const squadsMultisig = multisig.getMultisigPda({ createKey: dao })[0];

    return this.futarchy.methods
      .initializeProposal()
      .accounts({
        question,
        proposal,
        squadsProposal,
        dao,
        baseVault,
        quoteVault,
        proposer,
        squadsMultisig,
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

    return this.futarchy.methods
      .finalizeProposal()
      .accounts({
        proposal,
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
        vaultProgram: this.vaultClient.vaultProgram.programId,
        vaultEventAuthority,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ]);
  }

  updateDaoIx({ dao, params }: { dao: PublicKey; params: UpdateDaoParams }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    return this.futarchy.methods.updateDao(params).accounts({
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
    const stakeAccount = getStakeAddr(
      FUTARCHY_V0_6_PROGRAM_ID,
      proposal,
      staker,
    )[0];

    return this.futarchy.methods
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

  unstakeFromProposalIx({
    proposal,
    dao,
    baseMint,
    amount,
    staker = this.provider.publicKey,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    amount: BN;
    staker?: PublicKey;
  }) {
    const stakeAccount = getStakeAddr(
      FUTARCHY_V0_6_PROGRAM_ID,
      proposal,
      staker,
    )[0];

    return this.futarchy.methods.unstakeFromProposal({ amount }).accounts({
      proposal,
      dao,
      stakerBaseAccount: getAssociatedTokenAddressSync(baseMint, staker, true),
      proposalBaseAccount: getAssociatedTokenAddressSync(
        baseMint,
        proposal,
        true,
      ),
      stakeAccount,
      staker,
      baseMint,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
  }

  collectFeesIx({
    dao,
    baseMint,
    quoteMint,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
  }) {
    // Hardcode destination to MetaDAO multisig vault
    const baseTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      METADAO_MULTISIG_VAULT,
      true,
    );
    const quoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      METADAO_MULTISIG_VAULT,
      true,
    );

    return this.futarchy.methods.collectFees().accounts({
      dao,
      admin: this.provider.publicKey,
      ammBaseVault: getAssociatedTokenAddressSync(baseMint, dao, true),
      ammQuoteVault: getAssociatedTokenAddressSync(quoteMint, dao, true),
      baseTokenAccount,
      quoteTokenAccount,
    });
  }

  sponsorProposalIx({
    proposal,
    dao,
    teamAddress = this.provider.publicKey,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    teamAddress?: PublicKey;
  }) {
    return this.futarchy.methods.sponsorProposal().accounts({
      proposal,
      dao,
      teamAddress,
    });
  }

  collectMeteoraDammFeesIx({
    dao,
    baseMint,
    quoteMint = MAINNET_USDC,
    transactionIndex,
    meteoraConfig = LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
    admin = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    transactionIndex: bigint;
    meteoraConfig?: PublicKey;
    admin?: PublicKey;
  }) {
    // Squads accounts
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];
    const squadsMultisigVaultTransaction = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
    })[0];
    const squadsMultisigProposal = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
    })[0];

    // Token accounts for receiving fees
    const baseTokenAccount = getAssociatedTokenAddressSync(
      baseMint,
      METADAO_MULTISIG_VAULT,
      true,
    );
    const quoteTokenAccount = getAssociatedTokenAddressSync(
      quoteMint,
      METADAO_MULTISIG_VAULT,
      true,
    );

    // Helper function to sort mints for Meteora pool PDA
    const sortMints = (
      mint1: PublicKey,
      mint2: PublicKey,
    ): [Buffer, Buffer] => {
      const buf1 = mint1.toBuffer();
      const buf2 = mint2.toBuffer();
      if (Buffer.compare(buf1, buf2) > 0) {
        return [buf1, buf2];
      }
      return [buf2, buf1];
    };

    const [sortedMint1, sortedMint2] = sortMints(baseMint, quoteMint);

    // Meteora DAMM accounts
    const [pool] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), meteoraConfig.toBuffer(), sortedMint1, sortedMint2],
      DAMM_V2_PROGRAM_ID,
    );

    const [positionNftMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
      LAUNCHPAD_V0_7_PROGRAM_ID,
    );

    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), positionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenAVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), baseMint.toBuffer(), pool.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenBVault] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), quoteMint.toBuffer(), pool.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [dammV2EventAuthority] = getEventAuthorityAddr(DAMM_V2_PROGRAM_ID);

    return this.futarchy.methods.collectMeteoraDammFees().accounts({
      dao,
      admin,
      squadsMultisig: multisigPda,
      squadsMultisigVault,
      squadsMultisigVaultTransaction,
      squadsMultisigProposal,
      squadsMultisigPermissionlessAccount: PERMISSIONLESS_ACCOUNT.publicKey,
      meteoraClaimPositionFeesAccounts: {
        dammV2Program: DAMM_V2_PROGRAM_ID,
        dammV2EventAuthority,
        poolAuthority: DAMM_V2_POOL_AUTHORITY,
        pool,
        position,
        tokenAAccount: baseTokenAccount,
        tokenBAccount: quoteTokenAccount,
        tokenAVault,
        tokenBVault,
        tokenAMint: baseMint,
        tokenBMint: quoteMint,
        positionNftAccount,
        owner: squadsMultisigVault,
        tokenAProgram: TOKEN_PROGRAM_ID,
        tokenBProgram: TOKEN_PROGRAM_ID,
      },
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      squadsProgram: SQUADS_PROGRAM_ID,
    });
  }

  initiateVaultSpendOptimisticProposalIx({
    dao,
    quoteMint = MAINNET_USDC,
    amount,
    recipient,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    quoteMint?: PublicKey;
    amount: BN;
    recipient: PublicKey;
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];
    const squadsSpendingLimit = multisig.getSpendingLimitPda({
      multisigPda,
      createKey: dao,
    })[0];
    const squadsProposal = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
    })[0];
    const squadsVaultTransaction = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
    })[0];

    const daoQuoteVaultAccount = getAssociatedTokenAddressSync(
      quoteMint,
      squadsMultisigVault,
      true,
    );
    const recipientQuoteAccount = getAssociatedTokenAddressSync(
      quoteMint,
      recipient,
      true,
    );

    // Build the SPL token transfer instruction for the vault transaction
    const transferIx = createTransferInstruction(
      daoQuoteVaultAccount,
      recipientQuoteAccount,
      squadsMultisigVault,
      BigInt(amount.toString()),
    );

    // Use the vault as the payerKey so it deduplicates with the transfer authority,
    // producing a clean message with exactly 1 signer (the vault).
    const transactionMessage = new TransactionMessage({
      payerKey: squadsMultisigVault,
      recentBlockhash: "",
      instructions: [transferIx],
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

    return this.futarchy.methods
      .initiateVaultSpendOptimisticProposal({ amount })
      .accounts({
        squadsMultisig: multisigPda,
        squadsMultisigVault,
        squadsSpendingLimit,
        squadsProposal,
        squadsVaultTransaction,
        dao,
        daoQuoteVaultAccount,
        proposer,
        recipient,
        recipientQuoteAccount,
        squadsProgram: SQUADS_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          recipientQuoteAccount,
          recipient,
          quoteMint,
        ),
        vaultTxCreate,
        proposalCreate,
      ]);
  }

  finalizeOptimisticProposalIx({
    dao,
    squadsProposal,
  }: {
    dao: PublicKey;
    squadsProposal: PublicKey;
  }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    return this.futarchy.methods.finalizeOptimisticProposal().accounts({
      squadsMultisig: multisigPda,
      squadsProposal,
      dao,
      squadsProgram: SQUADS_PROGRAM_ID,
    });
  }
}
