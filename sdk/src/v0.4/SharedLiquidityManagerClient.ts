import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";

import {
  SharedLiquidityManager as SharedLiquidityManagerIDLType,
  IDL as SharedLiquidityManagerIDL,
} from "./types/shared_liquidity_manager.js";
import {
  SharedLiquidityPool,
  SharedLiquidityPoolPosition,
} from "./types/index.js";

import BN from "bn.js";
import {
  SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  LOW_FEE_RAYDIUM_CONFIG,
  RAYDIUM_CREATE_POOL_FEE_RECEIVE,
} from "./constants.js";
import {
  getSharedLiquidityPoolAddr,
  getRaydiumCpmmPoolVaultAddr,
  getRaydiumCpmmLpMintAddr,
  getEventAuthorityAddr,
  getDaoTreasuryAddr,
  getProposalAddr,
  getRaydiumCpmmObservationStateAddr,
  getSharedLiquidityPoolSignerAddr,
  getSpotPoolAddr,
  getDraftProposalAddr,
  getStakeRecordAddr,
  getSlPoolPositionAddr,
} from "./utils/pda.js";
import { AutocratClient } from "./AutocratClient.js";
import { ProposalInstruction } from "./types/index.js";

export type CreateSharedLiquidityManagerClientParams = {
  provider: AnchorProvider;
  sharedLiquidityManagerProgramId?: PublicKey;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  ammProgramId?: PublicKey;
};

export const RAYDIUM_INIT_POOL_STATIC_ACCOUNTS = {
  raydiumAuthority: RAYDIUM_AUTHORITY,
  ammConfig: LOW_FEE_RAYDIUM_CONFIG,
  cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
  createPoolFee: RAYDIUM_CREATE_POOL_FEE_RECEIVE,
};

export class SharedLiquidityManagerClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<SharedLiquidityManagerIDLType>;
  public autocratClient: AutocratClient;

  constructor(params: CreateSharedLiquidityManagerClientParams) {
    this.provider = params.provider;
    this.program = new Program<SharedLiquidityManagerIDLType>(
      SharedLiquidityManagerIDL,
      params.sharedLiquidityManagerProgramId ||
        SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
      this.provider
    );
    this.autocratClient = AutocratClient.createClient({
      provider: this.provider,
      autocratProgramId: params.autocratProgramId,
      conditionalVaultProgramId: params.conditionalVaultProgramId,
      ammProgramId: params.ammProgramId,
    });
  }

  public static createClient(
    params: CreateSharedLiquidityManagerClientParams
  ): SharedLiquidityManagerClient {
    return new SharedLiquidityManagerClient(params);
  }

  getProgramId(): PublicKey {
    return this.program.programId;
  }

  async getSlPool(slPool: PublicKey): Promise<SharedLiquidityPool> {
    return await this.program.account.sharedLiquidityPool.fetch(slPool);
  }

  async getSlPoolPosition(
    position: PublicKey
  ): Promise<SharedLiquidityPoolPosition> {
    return await this.program.account.liquidityPosition.fetch(position);
  }

  initializeSharedLiquidityPoolIx(
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseAmount: BN,
    quoteAmount: BN,
    proposalStakeRateThresholdBps: number = 100,
    creator: PublicKey = this.provider.wallet.publicKey
  ) {
    let slPool = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      creator,
      proposalStakeRateThresholdBps
    )[0];

    const [creatorSlPoolPosition] = getSlPoolPositionAddr(
      this.program.programId,
      slPool,
      creator
    );

    let spotPool = getSpotPoolAddr(this.program.programId, slPool, 0)[0];

    let [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      this.program.programId,
      slPool
    );

    return this.program.methods
      .initializeSharedLiquidityPool({
        baseAmount,
        quoteAmount,
        proposalStakeRateThresholdBps,
      })
      .accounts({
        slPool,
        baseMint,
        quoteMint,
        dao,
        spotPool,
        spotPoolLpMint: getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        creator,
        creatorSlPoolPosition,
        creatorLpAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          this.provider.wallet.publicKey,
          true
        ),
        creatorBaseTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          creator,
          true
        ),
        creatorQuoteTokenAccount: getAssociatedTokenAddressSync(
          quoteMint,
          this.provider.wallet.publicKey,
          true
        ),
        spotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
          spotPool,
          baseMint,
          false
        )[0],
        spotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
          spotPool,
          quoteMint,
          false
        )[0],
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          slPoolSigner,
          true
        ),
        slPoolBaseVault: getAssociatedTokenAddressSync(
          baseMint,
          slPoolSigner,
          true
        ),
        slPoolQuoteVault: getAssociatedTokenAddressSync(
          quoteMint,
          slPoolSigner,
          true
        ),
        raydiumInitPoolStatic: RAYDIUM_INIT_POOL_STATIC_ACCOUNTS,
        spotPoolObservationState: getRaydiumCpmmObservationStateAddr(
          spotPool,
          false
        )[0],
        slPoolSigner,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(baseMint, slPoolSigner, true),
          slPoolSigner,
          baseMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.wallet.publicKey,
          getAssociatedTokenAddressSync(quoteMint, slPoolSigner, true),
          slPoolSigner,
          quoteMint
        ),
      ]);
  }

  depositSharedLiquidityIx(
    slPool: PublicKey,
    activeSpotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lpTokenAmount: BN,
    maxBaseTokenAmount: BN,
    maxQuoteTokenAmount: BN,
    user: PublicKey = this.provider.wallet.publicKey
  ) {
    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      this.program.programId,
      slPool
    );

    const [userSlPoolPosition] = getSlPoolPositionAddr(
      this.program.programId,
      slPool,
      user
    );

    return this.program.methods
      .depositSharedLiquidity({
        lpTokenAmount,
        maxBaseTokenAmount,
        maxQuoteTokenAmount,
      })
      .accounts({
        slPool,
        activeSpotPool,
        user,
        userBaseTokenAccount: getAssociatedTokenAddressSync(baseMint, user),
        userQuoteTokenAccount: getAssociatedTokenAddressSync(quoteMint, user),
        spotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
          activeSpotPool,
          baseMint,
          false
        )[0],
        spotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
          activeSpotPool,
          quoteMint,
          false
        )[0],
        baseMint,
        quoteMint,
        spotPoolLpMint: getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
          slPoolSigner,
          true
        ),
        userLpTokenAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
          user,
          true
        ),
        userSlPoolPosition,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
      })
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 300_000,
        }),
      ]);
  }

  withdrawSharedLiquidityIx(
    slPool: PublicKey,
    activeSpotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lpTokenAmount: BN,
    minimumToken0Amount: BN,
    minimumToken1Amount: BN,
    user: PublicKey = this.provider.wallet.publicKey
  ) {
    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      this.program.programId,
      slPool
    );

    const [userSlPoolPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("sl_pool_position"), slPool.toBuffer(), user.toBuffer()],
      this.program.programId
    );

    return this.program.methods
      .withdrawSharedLiquidity({
        lpTokenAmount,
        minimumToken0Amount,
        minimumToken1Amount,
      })
      .accounts({
        slPool,
        slPoolSigner,
        activeSpotPool,
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
          slPoolSigner,
          true
        ),
        userQuoteTokenAccount: getAssociatedTokenAddressSync(quoteMint, user),
        userBaseTokenAccount: getAssociatedTokenAddressSync(baseMint, user),
        spotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
          activeSpotPool,
          baseMint,
          false
        )[0],
        spotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
          activeSpotPool,
          quoteMint,
          false
        )[0],
        baseMint,
        quoteMint,
        spotPoolLpMint: getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
        userLpTokenAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(activeSpotPool, false)[0],
          user,
          true
        ),
        userSlPoolPosition,
        user,
        feeReceiver: this.provider.wallet.publicKey,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
        eventAuthority: getEventAuthorityAddr(this.program.programId)[0],
        program: this.program.programId,
      });
  }

  initializeProposalWithLiquidityIx(
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    nonce: BN,
    draftProposal: PublicKey,
    proposalStakeRateThresholdBps: number = 100
  ) {
    const [slPool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      this.provider.wallet.publicKey,
      proposalStakeRateThresholdBps
    );

    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      this.program.programId,
      slPool
    );

    const [spotPool] = getSpotPoolAddr(this.program.programId, slPool, 0);

    const [proposal] = getProposalAddr(
      this.autocratClient.getProgramId(),
      slPoolSigner,
      nonce
    );

    const {
      passAmm,
      failAmm,
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      failBaseMint,
      passQuoteMint,
      failQuoteMint,
      passLp: passLpMint,
      failLp: failLpMint,
    } = this.autocratClient.getProposalPdas(proposal, baseMint, quoteMint, dao);

    const [daoTreasury] = getDaoTreasuryAddr(
      this.autocratClient.getProgramId(),
      dao
    );

    return this.program.methods
      .initializeProposalWithLiquidity({
        nonce,
      })
      .accounts({
        sharedLiquidityPool: slPool,
        draftProposal,
        proposalCreator: this.provider.wallet.publicKey,
        proposal,
        baseMint,
        quoteMint,
        slPoolBaseVault: getAssociatedTokenAddressSync(
          baseMint,
          slPoolSigner,
          true
        ),
        slPoolQuoteVault: getAssociatedTokenAddressSync(
          quoteMint,
          slPoolSigner,
          true
        ),
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          slPoolSigner,
          true
        ),
        raydium: {
          spotPool: spotPool,
          spotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
            spotPool,
            baseMint,
            false
          )[0],
          spotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
            spotPool,
            quoteMint,
            false
          )[0],
          lpMint: getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          raydiumAuthority: RAYDIUM_AUTHORITY,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
        },
        conditionalVault: {
          slPoolSigner,
          question,
          baseVault,
          quoteVault,
          baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
            baseMint,
            baseVault,
            true
          ),
          quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
            quoteMint,
            quoteVault,
            true
          ),
          conditionalVaultProgram: CONDITIONAL_VAULT_PROGRAM_ID,
          passBaseMint,
          failBaseMint,
          passQuoteMint,
          failQuoteMint,
          slPoolPassBaseVault: getAssociatedTokenAddressSync(
            passBaseMint,
            slPoolSigner,
            true
          ),
          slPoolFailBaseVault: getAssociatedTokenAddressSync(
            failBaseMint,
            slPoolSigner,
            true
          ),
          slPoolPassQuoteVault: getAssociatedTokenAddressSync(
            passQuoteMint,
            slPoolSigner,
            true
          ),
          slPoolFailQuoteVault: getAssociatedTokenAddressSync(
            failQuoteMint,
            slPoolSigner,
            true
          ),
          vaultEventAuthority: getEventAuthorityAddr(
            CONDITIONAL_VAULT_PROGRAM_ID
          )[0],
        },
        amm: {
          passAmm,
          failAmm,
          passLpMint,
          failLpMint,
          slPoolPassLpAccount: getAssociatedTokenAddressSync(
            passLpMint,
            slPoolSigner,
            true
          ),
          slPoolFailLpAccount: getAssociatedTokenAddressSync(
            failLpMint,
            slPoolSigner,
            true
          ),
          passAmmVaultAtaBase: getAssociatedTokenAddressSync(
            passBaseMint,
            passAmm,
            true
          ),
          passAmmVaultAtaQuote: getAssociatedTokenAddressSync(
            passQuoteMint,
            passAmm,
            true
          ),
          failAmmVaultAtaBase: getAssociatedTokenAddressSync(
            failBaseMint,
            failAmm,
            true
          ),
          failAmmVaultAtaQuote: getAssociatedTokenAddressSync(
            failQuoteMint,
            failAmm,
            true
          ),
          proposalPassLpVault: getAssociatedTokenAddressSync(
            passLpMint,
            daoTreasury,
            true
          ),
          proposalFailLpVault: getAssociatedTokenAddressSync(
            failLpMint,
            daoTreasury,
            true
          ),
          ammProgram: AMM_PROGRAM_ID,
          eventAuthority: getEventAuthorityAddr(AMM_PROGRAM_ID)[0],
          slPoolSigner,
        },
        autocratEventAuthority: getEventAuthorityAddr(AUTOCRAT_PROGRAM_ID)[0],
        dao,
        autocratProgram: AUTOCRAT_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  initializeDraftProposalIx(
    sharedLiquidityPool: PublicKey,
    baseMint: PublicKey,
    instruction: ProposalInstruction,
    draftProposalNonce: BN = new BN(Math.floor(Math.random() * 1000000))
  ) {
    let [draftProposal] = getDraftProposalAddr(
      this.program.programId,
      draftProposalNonce
    );

    return this.program.methods
      .initializeDraftProposal({
        instruction,
        draftProposalNonce,
      })
      .accounts({
        draftProposal,
        sharedLiquidityPool,
        baseMint,
        stakedTokenVault: getAssociatedTokenAddressSync(
          baseMint,
          draftProposal,
          true
        ),
      });
  }

  stakeToDraftProposalIx(
    draftProposal: PublicKey,
    baseMint: PublicKey,
    amount: BN,
    staker: PublicKey = this.provider.wallet.publicKey
  ) {
    const [stakeRecord] = getStakeRecordAddr(
      this.program.programId,
      draftProposal,
      staker
    );

    return this.program.methods
      .stakeToDraftProposal({
        amount,
      })
      .accounts({
        draftProposal,
        staker,
        stakerTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          staker,
          true
        ),
        stakedTokenVault: getAssociatedTokenAddressSync(
          baseMint,
          draftProposal,
          true
        ),
        stakeRecord,
      });
  }

  unstakeFromDraftProposalIx(
    draftProposal: PublicKey,
    baseMint: PublicKey,
    amount: BN,
    staker: PublicKey = this.provider.wallet.publicKey
  ) {
    const [stakeRecord] = getStakeRecordAddr(
      this.program.programId,
      draftProposal,
      staker
    );

    return this.program.methods
      .unstakeFromDraftProposal({
        amount,
      })
      .accounts({
        draftProposal,
        staker,
        stakerTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          staker,
          true
        ),
        stakedTokenVault: getAssociatedTokenAddressSync(
          baseMint,
          draftProposal,
          true
        ),
        stakeRecord,
      });
  }

  removeProposalLiquidityIx(
    dao: PublicKey,
    spotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    draftProposalNonce: BN,
    proposalStakeRateThresholdBps: number = 100
  ) {
    const [slPool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      this.provider.wallet.publicKey,
      proposalStakeRateThresholdBps
    );

    const [slPoolSigner] = getSharedLiquidityPoolSignerAddr(
      this.program.programId,
      slPool
    );

    const [proposal] = getProposalAddr(
      this.autocratClient.getProgramId(),
      slPoolSigner,
      draftProposalNonce
    );

    const {
      passAmm,
      failAmm,
      question,
      baseVault,
      quoteVault,
      passBaseMint,
      failBaseMint,
      passQuoteMint,
      failQuoteMint,
      passLp: passLpMint,
      failLp: failLpMint,
    } = this.autocratClient.getProposalPdas(proposal, baseMint, quoteMint, dao);

    const [daoTreasury] = getDaoTreasuryAddr(
      this.autocratClient.getProgramId(),
      dao
    );

    const poolStateKp = Keypair.generate();
    const poolState = poolStateKp.publicKey;

    const [observationState] = getRaydiumCpmmObservationStateAddr(
      poolState,
      false
    );

    const [nextSpotPool] = getSpotPoolAddr(this.program.programId, slPool, 1);

    return this.program.methods.removeProposalLiquidity().accounts({
      slPool,
      proposal,
      baseMint,
      quoteMint,
      slPoolBaseVault: getAssociatedTokenAddressSync(
        baseMint,
        slPoolSigner,
        true
      ),
      slPoolQuoteVault: getAssociatedTokenAddressSync(
        quoteMint,
        slPoolSigner,
        true
      ),
      slPoolSpotLpVault: getAssociatedTokenAddressSync(
        getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        slPoolSigner,
        true
      ),
      ray: {
        activeSpotPool: spotPool,
        activeSpotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
          spotPool,
          baseMint,
          false
        )[0],
        activeSpotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
          spotPool,
          quoteMint,
          false
        )[0],
        nextSpotPoolQuoteVault: getRaydiumCpmmPoolVaultAddr(
          nextSpotPool,
          quoteMint,
          false
        )[0],
        slPoolSigner,
        nextSpotPoolLpMint: getRaydiumCpmmLpMintAddr(nextSpotPool, false)[0],
        nextSpotPoolBaseVault: getRaydiumCpmmPoolVaultAddr(
          nextSpotPool,
          baseMint,
          false
        )[0],
        nextSpotPool,
        nextSpotPoolObservationState: getRaydiumCpmmObservationStateAddr(
          nextSpotPool,
          false
        )[0],
        slPoolNextSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(nextSpotPool, false)[0],
          slPoolSigner,
          true
        ),
        activeSpotPoolLpMint: getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
        observationState,
        baseMint,
        quoteMint,
        slPool,
      },
      raydiumInitPoolStatic: RAYDIUM_INIT_POOL_STATIC_ACCOUNTS,
      cond: {
        question,
        baseVault,
        quoteVault,
        baseVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          baseVault,
          true
        ),
        quoteVaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          quoteMint,
          quoteVault,
          true
        ),
        conditionalVaultProgram: CONDITIONAL_VAULT_PROGRAM_ID,
        passBaseMint,
        failBaseMint,
        passQuoteMint,
        failQuoteMint,
        slPoolPassBaseVault: getAssociatedTokenAddressSync(
          passBaseMint,
          slPoolSigner,
          true
        ),
        slPoolFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          slPoolSigner,
          true
        ),
        slPoolPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          slPoolSigner,
          true
        ),
        slPoolFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          slPoolSigner,
          true
        ),
        vaultEventAuthority: getEventAuthorityAddr(
          CONDITIONAL_VAULT_PROGRAM_ID
        )[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        slPoolSigner,
      },
      ammm2: {
        passAmm,
        failAmm,
        passLpMint,
        failLpMint,
        slPoolPassLpAccount: getAssociatedTokenAddressSync(
          passLpMint,
          slPoolSigner,
          true
        ),
        slPoolFailLpAccount: getAssociatedTokenAddressSync(
          failLpMint,
          slPoolSigner,
          true
        ),
        passAmmVaultAtaBase: getAssociatedTokenAddressSync(
          passBaseMint,
          passAmm,
          true
        ),
        passAmmVaultAtaQuote: getAssociatedTokenAddressSync(
          passQuoteMint,
          passAmm,
          true
        ),
        failAmmVaultAtaBase: getAssociatedTokenAddressSync(
          failBaseMint,
          failAmm,
          true
        ),
        failAmmVaultAtaQuote: getAssociatedTokenAddressSync(
          failQuoteMint,
          failAmm,
          true
        ),
        proposalPassLpVault: getAssociatedTokenAddressSync(
          passLpMint,
          daoTreasury,
          true
        ),
        proposalFailLpVault: getAssociatedTokenAddressSync(
          failLpMint,
          daoTreasury,
          true
        ),
        ammProgram: AMM_PROGRAM_ID,
        eventAuthority: getEventAuthorityAddr(AMM_PROGRAM_ID)[0],
      },
      autocratEventAuthority: getEventAuthorityAddr(AUTOCRAT_PROGRAM_ID)[0],
      dao,
      autocratProgram: AUTOCRAT_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }
}
