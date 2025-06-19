import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import {
  SharedLiquidityManager as SharedLiquidityManagerIDLType,
  IDL as SharedLiquidityManagerIDL,
} from "./types/shared_liquidity_manager.js";

import BN from "bn.js";
import {
  SHARED_LIQUIDITY_MANAGER_PROGRAM_ID,
  RAYDIUM_CP_SWAP_PROGRAM_ID,
  RAYDIUM_AUTHORITY,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
} from "./constants.js";
import {
  getSharedLiquidityPoolAddr,
  getRaydiumCpmmPoolVaultAddr,
  getRaydiumCpmmLpMintAddr,
  getEventAuthorityAddr,
  getDaoTreasuryAddr,
  getProposalAddr,
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

  initializeSharedLiquidityPoolIx(
    dao: PublicKey,
    spotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey
  ) {
    let slPool = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPool
    )[0];

    return this.program.methods.initializeSharedLiquidityPool().accounts({
      slPool,
      baseMint,
      quoteMint,
      dao,
      spotPool,
      spotPoolLpMint: getRaydiumCpmmLpMintAddr(spotPool, false)[0],
      slPoolSpotLpVault: getAssociatedTokenAddressSync(
        getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        slPool,
        true
      ),
      slPoolBaseVault: getAssociatedTokenAddressSync(baseMint, slPool, true),
      slPoolQuoteVault: getAssociatedTokenAddressSync(quoteMint, slPool, true),
    });
  }

  depositSharedLiquidityIx(
    dao: PublicKey,
    spotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lpTokenAmount: BN,
    maxBaseTokenAmount: BN,
    maxQuoteTokenAmount: BN
  ) {
    const [slPool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPool
    );

    const [userSlPoolPosition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("sl_pool_position"),
        slPool.toBuffer(),
        this.provider.wallet.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    return this.program.methods
      .depositSharedLiquidity({
        lpTokenAmount,
        maxBaseTokenAmount,
        maxQuoteTokenAmount,
      })
      .accounts({
        slPool,
        spotPool,
        user: this.provider.wallet.publicKey,
        userBaseTokenAccount: getAssociatedTokenAddressSync(
          baseMint,
          this.provider.wallet.publicKey
        ),
        userQuoteTokenAccount: getAssociatedTokenAddressSync(
          quoteMint,
          this.provider.wallet.publicKey
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
        baseMint,
        quoteMint,
        spotPoolLpMint: getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          slPool,
          true
        ),
        userLpTokenAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          this.provider.wallet.publicKey,
          true
        ),
        userSlPoolPosition,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  initializeProposalWithLiquidityIx(
    dao: PublicKey,
    spotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    nonce: BN,
    instruction: ProposalInstruction
  ) {
    const [slPool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPool
    );

    const [proposal] = getProposalAddr(
      this.autocratClient.getProgramId(),
      slPool,
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
        instruction,
        nonce,
      })
      .accounts({
        slPool,
        proposalCreator: this.provider.wallet.publicKey,
        proposal,
        baseMint,
        quoteMint,
        slPoolBaseVault: getAssociatedTokenAddressSync(baseMint, slPool, true),
        slPoolQuoteVault: getAssociatedTokenAddressSync(
          quoteMint,
          slPool,
          true
        ),
        slPoolSpotLpVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPool, false)[0],
          slPool,
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
          slPool,
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
            slPool,
            true
          ),
          slPoolFailBaseVault: getAssociatedTokenAddressSync(
            failBaseMint,
            slPool,
            true
          ),
          slPoolPassQuoteVault: getAssociatedTokenAddressSync(
            passQuoteMint,
            slPool,
            true
          ),
          slPoolFailQuoteVault: getAssociatedTokenAddressSync(
            failQuoteMint,
            slPool,
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
            slPool,
            true
          ),
          slPoolFailLpAccount: getAssociatedTokenAddressSync(
            failLpMint,
            slPool,
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

  removeProposalLiquidityIx(
    dao: PublicKey,
    spotPool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    nonce: BN
  ) {
    const [slPool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPool
    );

    const [proposal] = getProposalAddr(
      this.autocratClient.getProgramId(),
      slPool,
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

    return this.program.methods.removeProposalLiquidity().accounts({
      slPool,
      proposal,
      baseMint,
      quoteMint,
      slPoolBaseVault: getAssociatedTokenAddressSync(baseMint, slPool, true),
      slPoolQuoteVault: getAssociatedTokenAddressSync(quoteMint, slPool, true),
      slPoolSpotLpVault: getAssociatedTokenAddressSync(
        getRaydiumCpmmLpMintAddr(spotPool, false)[0],
        slPool,
        true
      ),
      ray: {
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
          slPool,
          true
        ),
        slPoolFailBaseVault: getAssociatedTokenAddressSync(
          failBaseMint,
          slPool,
          true
        ),
        slPoolPassQuoteVault: getAssociatedTokenAddressSync(
          passQuoteMint,
          slPool,
          true
        ),
        slPoolFailQuoteVault: getAssociatedTokenAddressSync(
          failQuoteMint,
          slPool,
          true
        ),
        vaultEventAuthority: getEventAuthorityAddr(
          CONDITIONAL_VAULT_PROGRAM_ID
        )[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        slPool,
      },
      ammm2: {
        passAmm,
        failAmm,
        passLpMint,
        failLpMint,
        slPoolPassLpAccount: getAssociatedTokenAddressSync(
          passLpMint,
          slPool,
          true
        ),
        slPoolFailLpAccount: getAssociatedTokenAddressSync(
          failLpMint,
          slPool,
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
