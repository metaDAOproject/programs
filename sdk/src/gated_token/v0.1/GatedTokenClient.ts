import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { GATED_TOKEN_V0_1_PROGRAM_ID } from "../../constants.js";
import {
  GatedToken as GatedTokenProgram,
  IDL as GatedTokenIDL,
} from "./types/gated_token.js";

export type CreateGatedTokenClientParams = {
  provider: AnchorProvider;
  programId?: PublicKey;
};

export class GatedTokenClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<GatedTokenProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, programId: PublicKey) {
    this.provider = provider;
    this.programId = programId;
    this.program = new Program<GatedTokenProgram>(
      GatedTokenIDL,
      programId,
      provider,
    );
  }

  public static createClient(
    params: CreateGatedTokenClientParams,
  ): GatedTokenClient {
    const { provider, programId } = params;
    return new GatedTokenClient(
      provider,
      programId || GATED_TOKEN_V0_1_PROGRAM_ID,
    );
  }
}
