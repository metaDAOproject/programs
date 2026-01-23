import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AccountInfo, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MINT_GOVERNOR_PROGRAM_ID } from "./constants.js";
import { getMintGovernorAddr, getMintAuthorityAddr } from "./utils/pda.js";
import BN from "bn.js";
import {
  MintGovernor as MintGovernorProgram,
  IDL as MintGovernorIDL,
} from "./types/mint_governor.js";
import type {
  MintGovernorAccount,
  MintAuthorityAccount,
} from "./types/index.js";

export type CreateMintGovernorClientParams = {
  provider: AnchorProvider;
  programId?: PublicKey;
};

export class MintGovernorClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<MintGovernorProgram>;
  public readonly programId: PublicKey;

  constructor(provider: AnchorProvider, programId: PublicKey) {
    this.provider = provider;
    this.programId = programId;
    this.program = new Program<MintGovernorProgram>(
      MintGovernorIDL,
      programId,
      provider,
    );
  }

  public static createClient(
    params: CreateMintGovernorClientParams,
  ): MintGovernorClient {
    const { provider, programId } = params;
    return new MintGovernorClient(
      provider,
      programId || MINT_GOVERNOR_PROGRAM_ID,
    );
  }

  async fetchMintGovernor(
    mintGovernor: PublicKey,
  ): Promise<MintGovernorAccount | null> {
    return this.program.account.mintGovernor.fetchNullable(mintGovernor);
  }

  async deserializeMintGovernor(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<MintGovernorAccount> {
    return this.program.coder.accounts.decode("mintGovernor", accountInfo.data);
  }

  async fetchMintAuthority(
    mintAuthority: PublicKey,
  ): Promise<MintAuthorityAccount | null> {
    return this.program.account.mintAuthority.fetchNullable(mintAuthority);
  }

  async deserializeMintAuthority(
    accountInfo: AccountInfo<Buffer>,
  ): Promise<MintAuthorityAccount> {
    return this.program.coder.accounts.decode(
      "mintAuthority",
      accountInfo.data,
    );
  }

  initializeMintGovernorIx({
    mint,
    createKey,
    admin,
    payer = this.provider.publicKey,
  }: {
    mint: PublicKey;
    createKey: PublicKey;
    admin: PublicKey;
    payer?: PublicKey;
  }) {
    const [mintGovernor] = getMintGovernorAddr({
      programId: this.programId,
      mint,
      createKey,
    });

    return this.program.methods.initializeMintGovernor().accounts({
      mint,
      mintGovernor,
      createKey,
      admin,
      payer,
    });
  }

  transferAuthorityToGovernorIx({
    mintGovernor,
    mint,
    currentAuthority,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    mintGovernor: PublicKey;
    mint: PublicKey;
    currentAuthority: PublicKey;
    tokenProgram?: PublicKey;
  }) {
    return this.program.methods.transferAuthorityToGovernor().accounts({
      mintGovernor,
      mint,
      currentAuthority,
      tokenProgram,
    });
  }

  addMintAuthorityIx({
    mintGovernor,
    admin,
    authorizedMinter,
    payer = this.provider.publicKey,
    maxTotal,
  }: {
    mintGovernor: PublicKey;
    admin: PublicKey;
    authorizedMinter: PublicKey;
    payer?: PublicKey;
    maxTotal: BN | null;
  }) {
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.programId,
      mintGovernor,
      authorizedMinter,
    });

    return this.program.methods.addMintAuthority({ maxTotal }).accounts({
      mintGovernor,
      mintAuthority,
      admin,
      authorizedMinter,
      payer,
    });
  }

  updateMintAuthorityIx({
    mintGovernor,
    mintAuthority,
    admin,
    maxTotal,
  }: {
    mintGovernor: PublicKey;
    mintAuthority: PublicKey;
    admin: PublicKey;
    maxTotal: BN | null;
  }) {
    return this.program.methods.updateMintAuthority({ maxTotal }).accounts({
      mintGovernor,
      mintAuthority,
      admin,
    });
  }

  removeMintAuthorityIx({
    mintGovernor,
    mintAuthority,
    admin,
    rentDestination,
  }: {
    mintGovernor: PublicKey;
    mintAuthority: PublicKey;
    admin: PublicKey;
    rentDestination: PublicKey;
  }) {
    return this.program.methods.removeMintAuthority().accounts({
      mintGovernor,
      mintAuthority,
      admin,
      rentDestination,
    });
  }

  mintTokensIx({
    mintGovernor,
    mint,
    destinationAta,
    authorizedMinter,
    tokenProgram = TOKEN_PROGRAM_ID,
    amount,
  }: {
    mintGovernor: PublicKey;
    mint: PublicKey;
    destinationAta: PublicKey;
    authorizedMinter: PublicKey;
    tokenProgram?: PublicKey;
    amount: BN;
  }) {
    const [mintAuthority] = getMintAuthorityAddr({
      programId: this.programId,
      mintGovernor,
      authorizedMinter,
    });

    return this.program.methods.mintTokens({ amount }).accounts({
      mintGovernor,
      mintAuthority,
      mint,
      destinationAta,
      authorizedMinter,
      tokenProgram,
    });
  }

  updateMintGovernorAdminIx({
    mintGovernor,
    admin,
    newAdmin,
  }: {
    mintGovernor: PublicKey;
    admin: PublicKey;
    newAdmin: PublicKey;
  }) {
    return this.program.methods.updateMintGovernorAdmin().accounts({
      mintGovernor,
      admin,
      newAdmin,
    });
  }

  reclaimAuthorityIx({
    mintGovernor,
    mint,
    admin,
    newAuthority,
    tokenProgram = TOKEN_PROGRAM_ID,
  }: {
    mintGovernor: PublicKey;
    mint: PublicKey;
    admin: PublicKey;
    newAuthority: PublicKey;
    tokenProgram?: PublicKey;
  }) {
    return this.program.methods.reclaimAuthority().accounts({
      mintGovernor,
      mint,
      admin,
      newAuthority,
      tokenProgram,
    });
  }
}
