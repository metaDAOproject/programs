import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { GATED_MINT_V0_1_PROGRAM_ID } from "../../constants.js";
import { getGatedMintConfigAddr, getWhitelistedUserAddr } from "./pda.js";
import {
  GatedMint as GatedMintProgram,
  IDL as GatedMintIDL,
} from "./types/gated_mint.js";
import type {
  GatedMintConfigAccount,
  WhitelistedUserAccount,
} from "./types/index.js";

export type CreateGatedMintClientParams = {
  provider: AnchorProvider;
  programId?: PublicKey;
};

export class GatedMintClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<GatedMintProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, programId: PublicKey) {
    this.provider = provider;
    this.programId = programId;
    this.program = new Program<GatedMintProgram>(
      GatedMintIDL,
      programId,
      provider,
    );
  }

  public static createClient(
    params: CreateGatedMintClientParams,
  ): GatedMintClient {
    const { provider, programId } = params;
    return new GatedMintClient(
      provider,
      programId || GATED_MINT_V0_1_PROGRAM_ID,
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
    whitelistAdmin = null,
    payer = this.provider.publicKey,
  }: {
    mint: PublicKey;
    currentFreezeAuthority: PublicKey;
    admin: PublicKey;
    whitelistAdmin?: PublicKey | null;
    payer?: PublicKey;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });

    return this.program.methods
      .initializeGatedMint({ whitelistAdmin })
      .accounts({
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
    authority,
    user,
    payer = this.provider.publicKey,
  }: {
    mint: PublicKey;
    authority: PublicKey;
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
      authority,
      mint,
      user,
      whitelistedUser,
      payer,
    });
  }

  removeWhitelistedUserIx({
    mint,
    authority,
    user,
    rentDestination = this.provider.publicKey,
  }: {
    mint: PublicKey;
    authority: PublicKey;
    user: PublicKey;
    rentDestination?: PublicKey;
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

    return this.program.methods.removeWhitelistedUser().accounts({
      gatedMintConfig,
      authority,
      mint,
      user,
      whitelistedUser,
      rentDestination,
    });
  }

  setWhitelistAdminIx({
    mint,
    admin,
    whitelistAdmin,
  }: {
    mint: PublicKey;
    admin: PublicKey;
    whitelistAdmin: PublicKey | null;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });

    return this.program.methods.setWhitelistAdmin({ whitelistAdmin }).accounts({
      gatedMintConfig,
      admin,
    });
  }

  gatedInvokeIx({
    caller,
    mint,
    instruction,
  }: {
    caller: PublicKey;
    mint: PublicKey;
    instruction: TransactionInstruction;
  }) {
    const [gatedMintConfig] = getGatedMintConfigAddr({
      programId: this.programId,
      mint,
    });
    const [whitelistedUser] = getWhitelistedUserAddr({
      programId: this.programId,
      mint,
      user: caller,
    });

    return this.program.methods
      .gatedInvoke({ instructionData: instruction.data })
      .accounts({
        caller,
        gatedMintConfig,
        whitelistedUser,
        mint,
        targetProgram: instruction.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(instruction.keys);
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
