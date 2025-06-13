import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import {
  SharedLiquidityManager as SharedLiquidityManagerIDLType,
  IDL as SharedLiquidityManagerIDL,
} from "./types/shared_liquidity_manager.js";

import BN from "bn.js";
import { SHARED_LIQUIDITY_MANAGER_PROGRAM_ID } from "./constants.js";
import { getSharedLiquidityPoolAddr } from "./utils/pda.js";

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
}
