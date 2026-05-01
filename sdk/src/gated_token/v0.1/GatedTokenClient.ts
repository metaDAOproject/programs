import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GATED_TOKEN_V0_1_PROGRAM_ID } from "../../constants.js";
import { getGatedMintConfigAddr, getWhitelistedUserAddr } from "./pda.js";
import {
  GatedToken as GatedTokenProgram,
  IDL as GatedTokenIDL,
} from "./types/gated_token.js";
import type {
  GatedMintConfigAccount,
  WhitelistedUserAccount,
} from "./types/index.js";

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

  async fetchGatedMintConfig(
    addr: PublicKey,
  ): Promise<GatedMintConfigAccount | null> {
    return this.program.account.gatedMintConfig.fetchNullable(addr);
  }

  async deserializeGatedMintConfig(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<GatedMintConfigAccount> {
    return this.program.coder.accounts.decode(
      "gatedMintConfig",
      accountInfo.data,
    );
  }

  async fetchWhitelistedUser(
    addr: PublicKey,
  ): Promise<WhitelistedUserAccount | null> {
    return this.program.account.whitelistedUser.fetchNullable(addr);
  }

  async deserializeWhitelistedUser(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<WhitelistedUserAccount> {
    return this.program.coder.accounts.decode(
      "whitelistedUser",
      accountInfo.data,
    );
  }

  initializeGatedMintIx({
    mint,
    currentFreezeAuthority,
    admin,
    payer = this.provider.publicKey,
  }: {
    mint: PublicKey;
    currentFreezeAuthority: PublicKey;
    admin: PublicKey;
    payer?: PublicKey;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });

    return this.program.methods.initializeGatedMint().accounts({
      mint,
      gatedMintConfig,
      currentFreezeAuthority,
      admin,
      payer,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
  }

  addWhitelistedUserIx({
    mint,
    admin,
    user,
    payer = this.provider.publicKey,
  }: {
    mint: PublicKey;
    admin: PublicKey;
    user: PublicKey;
    payer?: PublicKey;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });
    const [whitelistedUser] = getWhitelistedUserAddr({
      programId: this.programId,
      mint,
      user,
    });

    return this.program.methods.addWhitelistedUser().accounts({
      gatedMintConfig,
      admin,
      mint,
      user,
      whitelistedUser,
      payer,
    });
  }

  disableGatingIx({ mint, admin }: { mint: PublicKey; admin: PublicKey }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });

    return this.program.methods.disableGating().accounts({
      gatedMintConfig,
      admin,
    });
  }

  thawAccountIx({
    mint,
    tokenAccount,
  }: {
    mint: PublicKey;
    tokenAccount: PublicKey;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });

    return this.program.methods.thawAccount().accounts({
      gatedMintConfig,
      mint,
      tokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    });
  }
}
