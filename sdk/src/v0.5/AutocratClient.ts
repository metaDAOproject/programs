import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AccountMeta,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { InitializeDaoParams, UpdateDaoParams } from "./types/index.js";

import { Autocrat, IDL as AutocratIDL } from "./types/autocrat.js";
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
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_ID,
  USDC_DECIMALS,
} from "./constants.js";
import {
  DEFAULT_CU_PRICE,
  InstructionUtils,
  MaxCUs,
  getAmmAddr,
  getAmmLpMintAddr,
  getConditionalTokenMintAddr,
  getDaoAddr,
  getDaoTreasuryAddr,
  getEventAuthorityAddr,
  getProposalAddr,
  getQuestionAddr,
  getVaultAddr,
} from "./utils/index.js";
import { ConditionalVaultClient } from "./ConditionalVaultClient.js";
import { AmmClient } from "./AmmClient.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  unpackMint,
} from "@solana/spl-token";
import { sha256 } from "@noble/hashes/sha256";
import { Dao, Proposal } from "./types/index.js";

import * as multisig from "@sqds/multisig";

export type CreateClientParams = {
  provider: AnchorProvider;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  ammProgramId?: PublicKey;
};

export type ProposalVaults = {
  baseVault: PublicKey;
  quoteVault: PublicKey;
};

export class AutocratClient {
  public readonly provider: AnchorProvider;
  public readonly autocrat: Program<Autocrat>;
  public readonly vaultClient: ConditionalVaultClient;
  public readonly ammClient: AmmClient;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    autocratProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.autocrat = new Program<Autocrat>(
      AutocratIDL,
      autocratProgramId,
      provider
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.ammClient = AmmClient.createClient({ provider, ammProgramId });
    this.luts = luts;
  }

  public static createClient(
    createAutocratClientParams: CreateClientParams
  ): AutocratClient {
    let {
      provider,
      autocratProgramId,
      conditionalVaultProgramId,
      ammProgramId,
    } = createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AutocratClient(
      provider,
      autocratProgramId || AUTOCRAT_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      ammProgramId || AMM_PROGRAM_ID,
      luts
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
    accountInfo: AccountInfo<Buffer>
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
    dao: PublicKey
  ): {
    question: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    passBaseMint: PublicKey;
    passQuoteMint: PublicKey;
    failBaseMint: PublicKey;
    failQuoteMint: PublicKey;
    passAmm: PublicKey;
    failAmm: PublicKey;
    passLp: PublicKey;
    failLp: PublicKey;
  } {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const [question] = getQuestionAddr(
      vaultProgramId,
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      question,
      baseMint
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      question,
      quoteMint
    );

    const [failBaseMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      baseVault,
      0
    );
    const [failQuoteMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      quoteVault,
      0
    );

    const [passBaseMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      baseVault,
      1
    );
    const [passQuoteMint] = getConditionalTokenMintAddr(
      vaultProgramId,
      quoteVault,
      1
    );

    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBaseMint,
      passQuoteMint
    );
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBaseMint,
      failQuoteMint
    );

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    return {
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      passAmm,
      failAmm,
      passLp,
      failLp,
    };
  }

  // async initializeDao(
  //   tokenMint: PublicKey,
  //   tokenPriceUiAmount: number,
  //   minBaseFutarchicLiquidity: number,
  //   minQuoteFutarchicLiquidity: number,
  //   usdcMint: PublicKey = MAINNET_USDC,
  //   daoKeypair: Keypair = Keypair.generate(),
  //   twapStartDelaySlots: BN
  // ): Promise<PublicKey> {
  //   let tokenDecimals = unpackMint(
  //     tokenMint,
  //     await this.provider.connection.getAccountInfo(tokenMint)
  //   ).decimals;

  //   let scaledPrice = PriceMath.getAmmPrice(
  //     tokenPriceUiAmount,
  //     tokenDecimals,
  //     USDC_DECIMALS
  //   );

  //   // console.log(
  //   //   PriceMath.getHumanPrice(scaledPrice, tokenDecimals, USDC_DECIMALS)
  //   // );

  //   await this.initializeDaoIx({
  //     daoKeypair,
  //     baseMint: tokenMint,
  //     params: {
  //       twapStartDelaySlots,
  //       twapInitialObservation: scaledPrice,
  //       twapMaxObservationChangePerUpdate: scaledPrice.divn(50),
  //       minQuoteFutarchicLiquidity: new BN(minQuoteFutarchicLiquidity).mul(
  //         new BN(10).pow(new BN(USDC_DECIMALS))
  //       ),
  //       minBaseFutarchicLiquidity: new BN(minBaseFutarchicLiquidity).mul(
  //         new BN(10).pow(new BN(tokenDecimals))
  //       ),
  //       passThresholdBps: null,
  //       slotsPerProposal: null,
  //     },
  //     quoteMint: usdcMint,
  //   })
  //     .postInstructions([
  //       ComputeBudgetProgram.setComputeUnitLimit({
  //         units: MaxCUs.initializeDao,
  //       }),
  //       ComputeBudgetProgram.setComputeUnitPrice({
  //         microLamports: DEFAULT_CU_PRICE,
  //       }),
  //     ])
  //     .rpc({ maxRetries: 5 });

  //   return daoKeypair.publicKey;
  // }

  initializeDaoIx({
    baseMint,
    params,
    quoteMint = MAINNET_USDC,
    squadsProgramConfigTreasury = SQUADS_PROGRAM_CONFIG_TREASURY,
  }: {
    baseMint: PublicKey;
    params: InitializeDaoParams;
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
    });
  }

  async initializeProposal(
    dao: PublicKey,
    descriptionUrl: string,
    squadsProposal: PublicKey,
    baseTokensToLP: BN,
    quoteTokensToLP: BN
  ): Promise<PublicKey> {
    const storedDao = await this.getDao(dao);

    let [proposal] = getProposalAddr(this.autocrat.programId, squadsProposal);

    await this.vaultClient.initializeQuestion(
      sha256(`Will ${proposal} pass?/FAIL/PASS`),
      proposal,
      2
    );

    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      question,
    } = this.getProposalPdas(
      proposal,
      storedDao.baseMint,
      storedDao.quoteMint,
      dao
    );

    // it's important that these happen in a single atomic transaction
    await this.vaultClient
      .initializeVaultIx(question, storedDao.baseMint, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.initializeVaultIx(question, storedDao.quoteMint, 2),
          this.ammClient.initializeAmmIx(
            passBaseMint,
            passQuoteMint,
            storedDao.twapStartDelaySlots,
            storedDao.twapInitialObservation,
            storedDao.twapMaxObservationChangePerUpdate
          ),
          this.ammClient.initializeAmmIx(
            failBaseMint,
            failQuoteMint,
            storedDao.twapStartDelaySlots,
            storedDao.twapInitialObservation,
            storedDao.twapMaxObservationChangePerUpdate
          )
        )
      )
      .rpc();

    console.log(baseTokensToLP.toString());
    await this.vaultClient
      .splitTokensIx(question, baseVault, storedDao.baseMint, baseTokensToLP, 2)
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.vaultClient.splitTokensIx(
            question,
            quoteVault,
            storedDao.quoteMint,
            quoteTokensToLP,
            2
          )
        )
      )
      .rpc();

    await this.ammClient
      .addLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        quoteTokensToLP,
        baseTokensToLP,
        new BN(0)
      )
      .postInstructions(
        await InstructionUtils.getInstructions(
          this.ammClient.addLiquidityIx(
            failAmm,
            failBaseMint,
            failQuoteMint,
            quoteTokensToLP,
            baseTokensToLP,
            new BN(0)
          )
        )
      )
      .rpc();

    // this is how many original tokens are created
    const lpTokens = quoteTokensToLP;

    await this.initializeProposalIx(
      descriptionUrl,
      squadsProposal,
      dao,
      storedDao.baseMint,
      storedDao.quoteMint,
      lpTokens,
      lpTokens,
      question
    ).rpc();

    return proposal;
  }

  initializeProposalIx(
    descriptionUrl: string,
    squadsProposal: PublicKey,
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    passLpTokensToLock: BN,
    failLpTokensToLock: BN,
    question: PublicKey,
    proposer: PublicKey = this.provider.publicKey
  ) {
    let [proposal] = getProposalAddr(this.autocrat.programId, squadsProposal);
    const {
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
    } = this.getProposalPdas(proposal, baseMint, quoteMint, dao);

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    const passLpVaultAccount = getAssociatedTokenAddressSync(
      passLp,
      proposal,
      true
    );
    const failLpVaultAccount = getAssociatedTokenAddressSync(
      failLp,
      proposal,
      true
    );

    let [futarchyAmm] = PublicKey.findProgramAddressSync(
      [Buffer.from("futarchy_amm")],
      this.getProgramId()
    );

    return this.autocrat.methods
      .initializeProposal({
        descriptionUrl,
        passLpTokensToLock,
        failLpTokensToLock,
      })
      .accounts({
        question,
        proposal,
        futarchyAmm,
        squadsProposal,
        dao,
        baseVault,
        quoteVault,
        passAmm,
        failAmm,
        passLpMint: passLp,
        failLpMint: failLp,
        ammPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          futarchyAmm,
          true
        ),
        ammPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          futarchyAmm,
          true
        ),
        ammFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          futarchyAmm,
          true
        ),
        ammFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          futarchyAmm,
          true
        ),
        passLpUserAccount: getAssociatedTokenAddressSync(
          passLp,
          proposer,
          true
        ),
        failLpUserAccount: getAssociatedTokenAddressSync(
          failLp,
          proposer,
          true
        ),
        passLpVaultAccount,
        failLpVaultAccount,
        proposer,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(passBaseMint, futarchyAmm, true),
          futarchyAmm,
          passBaseMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(passQuoteMint, futarchyAmm, true),
          futarchyAmm,
          passQuoteMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(failBaseMint, futarchyAmm, true),
          futarchyAmm,
          failBaseMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(failQuoteMint, futarchyAmm, true),
          futarchyAmm,
          failQuoteMint
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
      storedProposal.proposer
    ).rpc();
  }

  finalizeProposalIx(
    proposal: PublicKey,
    squadsProposal: PublicKey,
    dao: PublicKey,
    daoToken: PublicKey,
    usdc: PublicKey,
    proposer: PublicKey
  ) {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const multisigPda = multisig.getMultisigPda({ createKey: dao })[0];

    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const { question, passAmm, failAmm } = this.getProposalPdas(
      proposal,
      daoToken,
      usdc,
      dao
    );

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    const [vaultEventAuthority] = getEventAuthorityAddr(vaultProgramId);

    return this.autocrat.methods.finalizeProposal().accounts({
      proposal,
      passAmm,
      failAmm,
      dao,
      squadsProposal,
      squadsMultisig: multisigPda,
      squadsMultisigProgram: SQUADS_PROGRAM_ID,
      question,
      // baseVault,
      // quoteVault,
      passLpUserAccount: getAssociatedTokenAddressSync(passLp, proposer, true),
      failLpUserAccount: getAssociatedTokenAddressSync(failLp, proposer, true),
      passLpVaultAccount: getAssociatedTokenAddressSync(passLp, proposal, true),
      failLpVaultAccount: getAssociatedTokenAddressSync(failLp, proposal, true),
      vaultProgram: this.vaultClient.vaultProgram.programId,
      vaultEventAuthority,
    });
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

  // cranks the TWAPs of multiple proposals' markets. there's a limit on the
  // number of proposals you can pass in, which I can't determine rn because
  // there aren't enough proposals on devnet
  async crankProposalMarkets(
    proposals: PublicKey[],
    priorityFeeMicroLamports: number
  ) {
    const amms: PublicKey[] = [];

    for (const proposal of proposals) {
      const storedProposal = await this.getProposal(proposal);
      amms.push(storedProposal.passAmm);
      amms.push(storedProposal.failAmm);
    }

    while (true) {
      let ixs: TransactionInstruction[] = [];

      for (const amm of amms) {
        ixs.push(await this.ammClient.crankThatTwapIx(amm).instruction());
      }

      let tx = new Transaction();
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 4_000 * ixs.length })
      );
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: priorityFeeMicroLamports,
        })
      );
      tx.add(...ixs);
      try {
        await this.provider.sendAndConfirm(tx);
      } catch (err) {
        console.log("err", err);
      }

      await new Promise((resolve) => setTimeout(resolve, 65 * 1000)); // 65,000 milliseconds = 1 minute and 5 seconds
    }
  }
}
