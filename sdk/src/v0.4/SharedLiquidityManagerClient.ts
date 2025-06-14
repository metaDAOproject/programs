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
} from "./utils/pda.js";

export type CreateSharedLiquidityManagerClientParams = {
  provider: AnchorProvider;
  sharedLiquidityManagerProgramId?: PublicKey;
};

export class SharedLiquidityManagerClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<SharedLiquidityManagerIDLType>;

  constructor(
    provider: AnchorProvider,
    sharedLiquidityManagerProgramId: PublicKey
  ) {
    this.provider = provider;
    this.program = new Program<SharedLiquidityManagerIDLType>(
      SharedLiquidityManagerIDL,
      sharedLiquidityManagerProgramId,
      provider
    );
  }

  public static createClient(
    createSharedLiquidityManagerClientParams: CreateSharedLiquidityManagerClientParams
  ): SharedLiquidityManagerClient {
    let { provider, sharedLiquidityManagerProgramId: programId } =
      createSharedLiquidityManagerClientParams;

    return new SharedLiquidityManagerClient(
      provider,
      programId || SHARED_LIQUIDITY_MANAGER_PROGRAM_ID
    );
  }

  getProgramId(): PublicKey {
    return this.program.programId;
  }

  initializePoolIx(
    dao: PublicKey,
    spotPoolState: PublicKey,
    token0Mint: PublicKey,
    token1Mint: PublicKey
  ) {
    let pool = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPoolState
    )[0];

    return this.program.methods.initializePool().accounts({
      pool,
      token0Mint,
      token1Mint,
      dao,
      spotPoolState,
      lpTokenVault: getAssociatedTokenAddressSync(
        getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
        pool,
        true
      ),
      lpMint: getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
      token0Vault: getAssociatedTokenAddressSync(token0Mint, pool, true),
      token1Vault: getAssociatedTokenAddressSync(token1Mint, pool, true),
    });
  }

  depositIx(
    dao: PublicKey,
    spotPoolState: PublicKey,
    token0Mint: PublicKey,
    token1Mint: PublicKey,
    lpTokenAmount: BN,
    maxToken0Amount: BN,
    maxToken1Amount: BN
  ) {
    const [pool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPoolState
    );

    const [position] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("position"),
        pool.toBuffer(),
        this.provider.wallet.publicKey.toBuffer(),
      ],
      this.program.programId
    );

    return this.program.methods
      .deposit({
        lpTokenAmount,
        maximumToken0Amount: maxToken0Amount,
        maximumToken1Amount: maxToken1Amount,
      })
      .accounts({
        pool,
        spotPoolState,
        user: this.provider.wallet.publicKey,
        userTokenA: getAssociatedTokenAddressSync(
          token0Mint,
          this.provider.wallet.publicKey
        ),
        userTokenB: getAssociatedTokenAddressSync(
          token1Mint,
          this.provider.wallet.publicKey
        ),
        token0Vault: getRaydiumCpmmPoolVaultAddr(
          spotPoolState,
          token0Mint,
          false
        )[0],
        token1Vault: getRaydiumCpmmPoolVaultAddr(
          spotPoolState,
          token1Mint,
          false
        )[0],
        vault0Mint: token0Mint,
        vault1Mint: token1Mint,
        lpMint: getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
        lpTokenVault: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
          pool,
          true
        ),
        userLpTokenAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
          this.provider.wallet.publicKey,
          true
        ),
        position,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }

  initializeProposalWithLiquidityIx(
    dao: PublicKey,
    spotPoolState: PublicKey,
    proposal: PublicKey,
    question: PublicKey,
    vault0: PublicKey,
    vault1: PublicKey,
    token0Mint: PublicKey,
    token1Mint: PublicKey,
    passAmm: PublicKey,
    failAmm: PublicKey,
    passLpMint: PublicKey,
    failLpMint: PublicKey,
    token0PassMint: PublicKey,
    token0FailMint: PublicKey,
    token0PassVault: PublicKey,
    token0FailVault: PublicKey,
    token1PassMint: PublicKey,
    token1FailMint: PublicKey,
    token1PassVault: PublicKey,
    token1FailVault: PublicKey
  ) {
    const [pool] = getSharedLiquidityPoolAddr(
      this.program.programId,
      dao,
      spotPoolState
    );

    console.log(spotPoolState.toBase58());
    console.log(token0Mint.toBase58());

    return this.program.methods.initializeProposalWithLiquidity().accounts({
      pool,
      proposalCreator: this.provider.wallet.publicKey,
      proposal,
      token0Vault: getAssociatedTokenAddressSync(token0Mint, pool, true),
      token1Vault: getAssociatedTokenAddressSync(token1Mint, pool, true),
      token0Mint,
      token1Mint,
      raydium: {
        spotPoolState,
        token0Vault: getRaydiumCpmmPoolVaultAddr(
          spotPoolState,
          token0Mint,
          false
        )[0],
        token1Vault: getRaydiumCpmmPoolVaultAddr(
          spotPoolState,
          token1Mint,
          false
        )[0],
        lpMint: getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
        poolLpTokenAccount: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
          pool,
          true
        ),
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        memoProgram: MEMO_PROGRAM_ID,
      },
      conditionalVault: {
        question,
        vault0,
        vault1,
        vault0UnderlyingTokenAccount: getAssociatedTokenAddressSync(
          token0Mint,
          vault0,
          true
        ),
        vault1UnderlyingTokenAccount: getAssociatedTokenAddressSync(
          token1Mint,
          vault1,
          true
        ),
        poolToken0Account: getAssociatedTokenAddressSync(
          token0Mint,
          pool,
          true
        ),
        poolToken1Account: getAssociatedTokenAddressSync(
          token1Mint,
          pool,
          true
        ),
        conditionalVaultProgram: CONDITIONAL_VAULT_PROGRAM_ID,
        token0PassMint,
        token0FailMint,
        token0PassVault,
        token0FailVault,
        token1PassMint,
        token1FailMint,
        token1PassVault,
        token1FailVault,
        vaultEventAuthority: getEventAuthorityAddr(
          CONDITIONAL_VAULT_PROGRAM_ID
        )[0],
      },
      // conditionalTokens: {
      //   poolPToken0Account: getAssociatedTokenAddressSync(
      //     token0Mint,
      //     pool,
      //     true
      //   ),
      //   poolFToken0Account: getAssociatedTokenAddressSync(
      //     token0Mint,
      //     pool,
      //     true
      //   ),
      //   poolPToken1Account: getAssociatedTokenAddressSync(
      //     token1Mint,
      //     pool,
      //     true
      //   ),
      //   poolFToken1Account: getAssociatedTokenAddressSync(
      //     token1Mint,
      //     pool,
      //     true
      //   ),
      // },
      // amm: {
      //   passAmm,
      //   failAmm,
      //   passLpMint,
      //   failLpMint,
      //   poolPassLpAccount: getAssociatedTokenAddressSync(
      //     passLpMint,
      //     pool,
      //     true
      //   ),
      //   poolFailLpAccount: getAssociatedTokenAddressSync(
      //     failLpMint,
      //     pool,
      //     true
      //   ),
      //   passAmmVaultAtaBase: getAssociatedTokenAddressSync(
      //     token0Mint,
      //     passAmm,
      //     true
      //   ),
      //   passAmmVaultAtaQuote: getAssociatedTokenAddressSync(
      //     token1Mint,
      //     passAmm,
      //     true
      //   ),
      //   failAmmVaultAtaBase: getAssociatedTokenAddressSync(
      //     token0Mint,
      //     failAmm,
      //     true
      //   ),
      //   failAmmVaultAtaQuote: getAssociatedTokenAddressSync(
      //     token1Mint,
      //     failAmm,
      //     true
      //   ),
      //   ammProgram: AMM_PROGRAM_ID,
      // },
      dao,
      autocratProgram: AUTOCRAT_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });
  }
}
