import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
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
} from "./constants.js";
import {
  getSharedLiquidityPoolAddr,
  getRaydiumCpmmPoolVaultAddr,
  getRaydiumCpmmLpMintAddr,
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

  initializePoolIx(dao: PublicKey, spotPoolState: PublicKey) {
    return this.program.methods.initializePool().accounts({
      pool: getSharedLiquidityPoolAddr(
        this.program.programId,
        dao,
        spotPoolState
      )[0],
      dao,
      spotPoolState,
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
        dao,
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
        userLpToken: getAssociatedTokenAddressSync(
          getRaydiumCpmmLpMintAddr(spotPoolState, false)[0],
          this.provider.wallet.publicKey
        ),
        position,
        raydiumAuthority: RAYDIUM_AUTHORITY,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        cpSwapProgram: RAYDIUM_CP_SWAP_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      });
  }
}
