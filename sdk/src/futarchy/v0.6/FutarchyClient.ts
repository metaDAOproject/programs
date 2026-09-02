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
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import BN from "bn.js";
import * as multisig from "@sqds/multisig";

import {
  FUTARCHY_V0_6_PROGRAM_ID,
  CONDITIONAL_VAULT_V0_4_PROGRAM_ID,
  MAINNET_USDC,
  MINT_GOVERNOR_V0_7_PROGRAM_ID,
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
import { getMintAuthorityAddr } from "../../mint_governor/v0.7/pda.js";
import { getEventAuthorityAddr } from "../../pda.js";
import { InstructionUtils } from "../../utils.js";

import {
  Dao,
  Proposal,
  InitializeDaoParams,
  UpdateDaoParams,
  SetSpendingLimitArgs,
  SpendingLimitAction,
} from "./types/index.js";
import { Futarchy, IDL as FutarchyIDL } from "./types/futarchy.js";
import {
  Futarchy as v0_6_0_futarchy,
  IDL as v0_6_0_futarchyIDL,
} from "./types/v0.6.0-futarchy.js";
import {
  Futarchy as v0_6_1_futarchy,
  IDL as v0_6_1_futarchyIDL,
} from "./types/v0.6.1-futarchy.js";
import {
  getDaoAddr,
  getEnqueuedMultisigProposalCancellationAddr,
  getProposalAddr,
  getProposalAddrV2,
  getProposalAddrsForTransactionIndex,
  getSpendingLimitAddr,
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

// The slice of Anchor's MethodsBuilder the typed-initialize orchestrator drives.
type TypedInitializeMethodsBuilder = {
  preInstructions(ixs: TransactionInstruction[]): {
    rpc(): Promise<string>;
  };
};

export class FutarchyClient {
  public readonly provider: AnchorProvider;
  public readonly futarchy: Program<Futarchy>;
  public readonly v0_6_0_futarchy: Program<v0_6_0_futarchy>;
  public readonly v0_6_1_futarchy: Program<v0_6_1_futarchy>;
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
    this.v0_6_1_futarchy = new Program<v0_6_1_futarchy>(
      v0_6_1_futarchyIDL,
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

  // The treasury account list a buyback launch must supply as remaining
  // accounts: the vault's quote ATA and the treasury's AMM position, existing
  // accounts only, sorted ascending as the program requires.
  async assembleBuybackTreasuryAccounts({
    dao,
  }: {
    dao: PublicKey;
  }): Promise<PublicKey[]> {
    const storedDao = await this.getDao(dao);

    const vaultQuoteAccount = getAssociatedTokenAddressSync(
      storedDao.quoteMint,
      storedDao.squadsMultisigVault,
      true,
    );
    const [ammPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("amm_position"),
        dao.toBuffer(),
        storedDao.squadsMultisigVault.toBuffer(),
      ],
      this.getProgramId(),
    );

    const existing: PublicKey[] = [];
    for (const candidate of [vaultQuoteAccount, ammPosition]) {
      // Bankrun's connection proxy throws on missing accounts where a real
      // RPC returns null; treat both as "doesn't exist"
      const info = await this.provider.connection
        .getAccountInfo(candidate)
        .catch(() => null);
      if (info) {
        existing.push(candidate);
      }
    }

    return existing.sort((a, b) => a.toBuffer().compare(b.toBuffer()));
  }

  launchProposalIx({
    proposal,
    dao,
    baseMint,
    quoteMint,
    squadsProposal,
    treasuryAccounts = [],
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    squadsProposal: PublicKey;
    treasuryAccounts?: PublicKey[];
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
      .remainingAccounts(
        treasuryAccounts.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
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

  // The PDA set for the proposal a typed initialize would make next: reads the
  // multisig's current transaction index and derives the Squads transaction,
  // Squads proposal, and futarchy proposal addresses for index + 1.
  async getNextProposalAddrs(dao: PublicKey): Promise<{
    transactionIndex: bigint;
    squadsMultisig: PublicKey;
    squadsTransaction: PublicKey;
    squadsProposal: PublicKey;
    proposal: PublicKey;
  }> {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
      this.provider.connection,
      multisigPda,
    );
    const transactionIndex =
      BigInt(multisigAccount.transactionIndex.toString()) + 1n;

    return {
      transactionIndex,
      ...getProposalAddrsForTransactionIndex({
        dao,
        transactionIndex,
        programId: this.futarchy.programId,
      }),
    };
  }

  // The shared orchestration of every typed initialize: create the question and
  // both conditional vaults (same flow as `initializeProposal`), then send the
  // per-type initialize instruction built by `buildInitializeIx` — the instruction
  // itself creates the Squads transaction and proposal at the next
  // transaction index.
  private async initializeTypedProposal({
    dao,
    buildInitializeIx,
  }: {
    dao: PublicKey;
    buildInitializeIx: (params: {
      storedDao: Dao;
      transactionIndex: bigint;
    }) =>
      | TypedInitializeMethodsBuilder
      | Promise<TypedInitializeMethodsBuilder>;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    const storedDao = await this.getDao(dao);
    const { transactionIndex, squadsTransaction, squadsProposal, proposal } =
      await this.getNextProposalAddrs(dao);

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

    await (await buildInitializeIx({ storedDao, transactionIndex }))
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ])
      .rpc();

    return { proposal, squadsProposal, squadsTransaction };
  }

  // The `typed_initialize_accounts` composite accounts shared by every typed
  // initialize instruction, for the proposal at the given transaction index.
  private typedInitializeAccounts({
    dao,
    baseMint,
    quoteMint,
    transactionIndex,
    proposer,
    payer,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    transactionIndex: bigint;
    proposer: PublicKey;
    payer: PublicKey;
  }) {
    const { squadsMultisig, squadsTransaction, squadsProposal, proposal } =
      getProposalAddrsForTransactionIndex({
        dao,
        transactionIndex,
        programId: this.futarchy.programId,
      });
    const { question, baseVault, quoteVault } = this.getProposalPdas(
      proposal,
      baseMint,
      quoteMint,
      dao,
    );

    return {
      proposal,
      dao,
      squadsMultisig,
      squadsTransaction,
      squadsProposal,
      question,
      baseVault,
      quoteVault,
      proposer,
      payer,
      permissionlessAccount: PERMISSIONLESS_ACCOUNT.publicKey,
      squadsProgram: SQUADS_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
  }

  async initializeLargeSpendProposal({
    dao,
    amount,
  }: {
    dao: PublicKey;
    amount: BN;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: ({ storedDao, transactionIndex }) =>
        this.initializeLargeSpendProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          amount,
          transactionIndex,
        }),
    });
  }

  initializeLargeSpendProposalIx({
    dao,
    baseMint,
    quoteMint,
    amount,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    amount: BN;
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    return this.futarchy.methods
      .initializeLargeSpendProposal({ amount })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
  }

  // Reads the base mint's authority to pick the template branch: the Squads
  // vault → SPL MintTo, a MintGovernor → mint_governor::mint_tokens; anything
  // else is refused by the program.
  async initializeMintTokensProposal({
    dao,
    amount,
    recipient,
  }: {
    dao: PublicKey;
    amount: BN;
    recipient: PublicKey;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: async ({ storedDao, transactionIndex }) => {
        const baseMintInfo = await getMint(
          this.provider.connection,
          storedDao.baseMint,
        );
        let mintGovernor: PublicKey | null = null;
        if (
          baseMintInfo.mintAuthority &&
          !baseMintInfo.mintAuthority.equals(storedDao.squadsMultisigVault)
        ) {
          const authorityInfo = await this.provider.connection.getAccountInfo(
            baseMintInfo.mintAuthority,
          );
          if (authorityInfo?.owner.equals(MINT_GOVERNOR_V0_7_PROGRAM_ID)) {
            mintGovernor = baseMintInfo.mintAuthority;
          }
        }

        return this.initializeMintTokensProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          amount,
          recipient,
          transactionIndex,
          mintGovernor,
        });
      },
    });
  }

  initializeMintTokensProposalIx({
    dao,
    baseMint,
    quoteMint,
    amount,
    recipient,
    transactionIndex,
    mintGovernor = null,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    amount: BN;
    recipient: PublicKey;
    transactionIndex: bigint;
    mintGovernor?: PublicKey | null;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    const mintAuthority = mintGovernor
      ? getMintAuthorityAddr({
          mintGovernor,
          authorizedMinter: squadsMultisigVault,
        })[0]
      : null;

    return this.futarchy.methods
      .initializeMintTokensProposal({ amount, recipient })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
        baseMint,
        mintGovernor,
        mintAuthority,
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
  }

  // The payload is one vault-signed set_spending_limit: `config` replaces the
  // record verbatim, null removes it.
  async initializeSpendingLimitChangeProposal({
    dao,
    config,
  }: {
    dao: PublicKey;
    config: SetSpendingLimitArgs["config"];
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: ({ storedDao, transactionIndex }) =>
        this.initializeSpendingLimitChangeProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          config,
          transactionIndex,
        }),
    });
  }

  initializeSpendingLimitChangeProposalIx({
    dao,
    baseMint,
    quoteMint,
    config,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    config: SetSpendingLimitArgs["config"];
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    return this.futarchy.methods
      .initializeSpendingLimitChangeProposal({ config })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
  }

  // The payload declares the complete post-takeover regime: update_dao
  // re-points the team, and unless the action is `keep`, set_spending_limit
  // carries the declared limit end state.
  async initializeHostileTakeoverProposal({
    dao,
    newTeamAddress,
    spendingLimitAction,
  }: {
    dao: PublicKey;
    newTeamAddress: PublicKey;
    spendingLimitAction: SpendingLimitAction;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: ({ storedDao, transactionIndex }) =>
        this.initializeHostileTakeoverProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          newTeamAddress,
          spendingLimitAction,
          transactionIndex,
        }),
    });
  }

  initializeHostileTakeoverProposalIx({
    dao,
    baseMint,
    quoteMint,
    newTeamAddress,
    spendingLimitAction,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    newTeamAddress: PublicKey;
    spendingLimitAction: SpendingLimitAction;
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    return this.futarchy.methods
      .initializeHostileTakeoverProposal({
        newTeamAddress,
        spendingLimitAction,
      })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
  }

  // The payload is the IP-transfer memo alone — finalize_proposal performs the
  // state flip, and the liquidator (stored in `action`) unwinds the treasury
  // position afterward through the estate cycle.
  async initializeHostileLiquidateProposal({
    dao,
    liquidator = METADAO_MULTISIG_VAULT,
  }: {
    dao: PublicKey;
    liquidator?: PublicKey;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: ({ storedDao, transactionIndex }) =>
        this.initializeHostileLiquidateProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          liquidator,
          transactionIndex,
        }),
    });
  }

  initializeHostileLiquidateProposalIx({
    dao,
    baseMint,
    quoteMint,
    liquidator = METADAO_MULTISIG_VAULT,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    liquidator?: PublicKey;
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    return this.futarchy.methods
      .initializeHostileLiquidateProposal({ liquidator })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
  }

  // The payload is a single program-built memo carrying the DCA-shaped
  // parameters — a passed buyback authorizes nothing on-chain; ops executes
  // the programme off-chain with authority it already holds.
  async initializeBuybackTokenProposal({
    dao,
    quoteAmount,
    cycleCount,
    cycleFrequencySeconds,
    startDelaySeconds,
    minPrice = null,
    maxPrice = null,
  }: {
    dao: PublicKey;
    quoteAmount: BN;
    cycleCount: number;
    cycleFrequencySeconds: number;
    startDelaySeconds: number;
    minPrice?: BN | null;
    maxPrice?: BN | null;
  }): Promise<{
    proposal: PublicKey;
    squadsProposal: PublicKey;
    squadsTransaction: PublicKey;
  }> {
    return this.initializeTypedProposal({
      dao,
      buildInitializeIx: ({ storedDao, transactionIndex }) =>
        this.initializeBuybackTokenProposalIx({
          dao,
          baseMint: storedDao.baseMint,
          quoteMint: storedDao.quoteMint,
          quoteAmount,
          cycleCount,
          cycleFrequencySeconds,
          startDelaySeconds,
          minPrice,
          maxPrice,
          transactionIndex,
        }),
    });
  }

  initializeBuybackTokenProposalIx({
    dao,
    baseMint,
    quoteMint,
    quoteAmount,
    cycleCount,
    cycleFrequencySeconds,
    startDelaySeconds,
    minPrice = null,
    maxPrice = null,
    transactionIndex,
    proposer = this.provider.publicKey,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    quoteAmount: BN;
    cycleCount: number;
    cycleFrequencySeconds: number;
    startDelaySeconds: number;
    minPrice?: BN | null;
    maxPrice?: BN | null;
    transactionIndex: bigint;
    proposer?: PublicKey;
    payer?: PublicKey;
  }) {
    return this.futarchy.methods
      .initializeBuybackTokenProposal({
        quoteAmount,
        cycleCount,
        cycleFrequencySeconds,
        startDelaySeconds,
        minPrice,
        maxPrice,
      })
      .accounts({
        typedInitializeAccounts: this.typedInitializeAccounts({
          dao,
          baseMint,
          quoteMint,
          transactionIndex,
          proposer,
          payer,
        }),
      })
      .signers([PERMISSIONLESS_ACCOUNT]);
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

  setSpendingLimitIx({
    dao,
    config,
  }: {
    dao: PublicKey;
    config: SetSpendingLimitArgs["config"];
  }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const squadsMultisigVault = multisig.getVaultPda({
      multisigPda,
      index: 0,
    })[0];

    return this.futarchy.methods.setSpendingLimit({ config }).accounts({
      dao,
      squadsMultisigVault,
    });
  }

  syncSpendingLimitIx({
    dao,
    rentPayer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    rentPayer?: PublicKey;
  }) {
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];
    const [spendingLimit] = getSpendingLimitAddr({ dao });

    return this.futarchy.methods.syncSpendingLimit().accounts({
      dao,
      squadsMultisig: multisigPda,
      spendingLimit,
      rentPayer,
      squadsProgram: SQUADS_PROGRAM_ID,
    });
  }

  resizeDaoIx({
    dao,
    payer = this.provider.publicKey,
  }: {
    dao: PublicKey;
    payer?: PublicKey;
  }) {
    const [spendingLimit] = getSpendingLimitAddr({ dao });

    return this.futarchy.methods.resizeDao().accounts({
      dao,
      spendingLimit,
      payer,
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

  adminUpdateProposalParamsIx({
    proposal,
    dao,
    durationInSeconds = null,
    passThresholdBps = null,
    admin = this.provider.publicKey,
  }: {
    proposal: PublicKey;
    dao: PublicKey;
    durationInSeconds?: number | null;
    passThresholdBps?: number | null;
    admin?: PublicKey;
  }) {
    return this.futarchy.methods
      .adminUpdateProposalParams({ durationInSeconds, passThresholdBps })
      .accounts({
        dao,
        proposal,
        admin,
      });
  }

  // Leg 1 of the cancellation set: the admin (or the liquidator on a
  // liquidated DAO) records the intent to cancel the Squads proposal at
  // `transactionIndex`. No Squads CPI happens here, so a Squads vault can be
  // the signer.
  adminEnqueueMultisigProposalCancellationIx({
    dao,
    transactionIndex,
    admin = this.provider.publicKey,
  }: {
    dao: PublicKey;
    transactionIndex: bigint;
    admin?: PublicKey;
  }) {
    const { squadsMultisig, squadsProposal } =
      getProposalAddrsForTransactionIndex({ dao, transactionIndex });
    const [enqueuedCancellation] = getEnqueuedMultisigProposalCancellationAddr({
      dao,
      transactionIndex,
    });

    return this.futarchy.methods
      .adminEnqueueMultisigProposalCancellation({
        transactionIndex: new BN(transactionIndex.toString()),
      })
      .accounts({
        dao,
        admin,
        squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedCancellation,
      });
  }

  // Leg 2 of the cancellation set, permissionless: casts the DAO PDA's cancel
  // vote on the enqueued Squads proposal and closes the enqueued record to
  // `rentReceiver`.
  executeMultisigProposalCancellationIx({
    dao,
    transactionIndex,
    rentReceiver = this.provider.publicKey,
  }: {
    dao: PublicKey;
    transactionIndex: bigint;
    rentReceiver?: PublicKey;
  }) {
    const { squadsMultisig, squadsProposal } =
      getProposalAddrsForTransactionIndex({ dao, transactionIndex });
    const [enqueuedCancellation] = getEnqueuedMultisigProposalCancellationAddr({
      dao,
      transactionIndex,
    });

    return this.futarchy.methods
      .executeMultisigProposalCancellation()
      .accounts({
        dao,
        rentReceiver,
        squadsMultisig,
        squadsMultisigProposal: squadsProposal,
        enqueuedCancellation,
        squadsMultisigProgram: SQUADS_PROGRAM_ID,
      });
  }

  collectMeteoraDammFeesIx({
    dao,
    baseMint,
    quoteMint = MAINNET_USDC,
    transactionIndex,
    meteoraConfig = LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
    launchpadProgramId = LAUNCHPAD_V0_7_PROGRAM_ID,
    positionNftMint = undefined,
    pool = undefined,
    admin = this.provider.publicKey,
  }: {
    dao: PublicKey;
    baseMint: PublicKey;
    quoteMint?: PublicKey;
    transactionIndex: bigint;
    meteoraConfig?: PublicKey;
    launchpadProgramId?: PublicKey;
    positionNftMint?: PublicKey;
    pool?: PublicKey;
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
    const resolvedPool =
      pool ??
      PublicKey.findProgramAddressSync(
        [
          Buffer.from("pool"),
          meteoraConfig.toBuffer(),
          sortedMint1,
          sortedMint2,
        ],
        DAMM_V2_PROGRAM_ID,
      )[0];

    const resolvedPositionNftMint =
      positionNftMint ??
      PublicKey.findProgramAddressSync(
        [Buffer.from("position_nft_mint"), baseMint.toBuffer()],
        launchpadProgramId,
      )[0];

    const [positionNftAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("position_nft_account"), resolvedPositionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), resolvedPositionNftMint.toBuffer()],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenAVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_vault"),
        baseMint.toBuffer(),
        resolvedPool.toBuffer(),
      ],
      DAMM_V2_PROGRAM_ID,
    );

    const [tokenBVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("token_vault"),
        quoteMint.toBuffer(),
        resolvedPool.toBuffer(),
      ],
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
        pool: resolvedPool,
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
}
