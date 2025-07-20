import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault.js";

import BN from "bn.js";
import {
  CONDITIONAL_VAULT_PROGRAM_ID,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from "./constants.js";
import {
  getMetadataAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "./utils/index.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

export type CreateVaultClientParams = {
  provider: AnchorProvider;
  conditionalVaultProgramId?: PublicKey;
};

export class ConditionalVaultClient {
  public readonly provider: AnchorProvider;
  public readonly vaultProgram: Program<ConditionalVault>;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.vaultProgram = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      conditionalVaultProgramId,
      provider
    );
    this.luts = luts;
  }

  public static createClient(
    createVaultClientParams: CreateVaultClientParams
  ): ConditionalVaultClient {
    let { provider, conditionalVaultProgramId } = createVaultClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new ConditionalVaultClient(
      provider,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      luts
    );
  }

  async getVault(vault: PublicKey) {
    return this.vaultProgram.account.conditionalVault.fetch(vault);
  }

  async mintConditionalTokens(
    vault: PublicKey,
    uiAmount: number,
    user: PublicKey = this.provider.publicKey
  ) {
    const storedVault = await this.getVault(vault);

    return (
      this.mintConditionalTokensIx(
        vault,
        storedVault.underlyingTokenMint,
        new BN(uiAmount).mul(new BN(10).pow(new BN(storedVault.decimals))),
        user
      )
        // .preInstructions([
        //   createAssociatedTokenAccountIdempotentInstruction(this.provider.publicKey, )
        // ])
        .rpc()
    );
  }

  mintConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    amount: BN,
    user: PublicKey = this.provider.publicKey,
    payer: PublicKey = this.provider.publicKey
  ) {
    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    let userConditionalOnFinalizeTokenAccount = getAssociatedTokenAddressSync(
      conditionalOnFinalizeTokenMint,
      user
    );

    let userConditionalOnRevertTokenAccount = getAssociatedTokenAddressSync(
      conditionalOnRevertTokenMint,
      user
    );

    let ix = this.vaultProgram.methods
      .mintConditionalTokens(amount)
      .accounts({
        authority: user,
        vault,
        vaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true
        ),
        userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          user,
          true
        ),
        conditionalOnFinalizeTokenMint,
        userConditionalOnFinalizeTokenAccount,
        conditionalOnRevertTokenMint,
        userConditionalOnRevertTokenAccount,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          userConditionalOnFinalizeTokenAccount,
          user,
          conditionalOnFinalizeTokenMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          userConditionalOnRevertTokenAccount,
          user,
          conditionalOnRevertTokenMint
        ),
      ]);

    return ix;
  }

  initializeVaultIx(
    settlementAuthority: PublicKey,
    underlyingTokenMint: PublicKey,
    payer: PublicKey = this.provider.publicKey
  ) {
    const [vault] = getVaultAddr(
      this.vaultProgram.programId,
      settlementAuthority,
      underlyingTokenMint
    );

    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    const vaultUnderlyingTokenAccount = getAssociatedTokenAddressSync(
      underlyingTokenMint,
      vault,
      true
    );

    return this.vaultProgram.methods
      .initializeConditionalVault({ settlementAuthority })
      .accounts({
        vault,
        underlyingTokenMint,
        vaultUnderlyingTokenAccount,
        conditionalOnFinalizeTokenMint,
        conditionalOnRevertTokenMint,
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          payer,
          vaultUnderlyingTokenAccount,
          vault,
          underlyingTokenMint
        ),
      ]);
  }

  addMetadataToConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    proposalNumber: number,
    onFinalizeUri: string,
    onRevertUri: string,
    payer: PublicKey = this.provider.publicKey
  ) {
    const [underlyingTokenMetadata] = getMetadataAddr(underlyingTokenMint);

    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    const [conditionalOnFinalizeTokenMetadata] = getMetadataAddr(
      conditionalOnFinalizeTokenMint
    );

    const [conditionalOnRevertTokenMetadata] = getMetadataAddr(
      conditionalOnRevertTokenMint
    );

    return this.vaultProgram.methods
      .addMetadataToConditionalTokens({
        proposalNumber: new BN(proposalNumber),
        onFinalizeUri,
        onRevertUri,
      })
      .accounts({
        payer,
        vault,
        underlyingTokenMint,
        underlyingTokenMetadata,
        conditionalOnFinalizeTokenMint,
        conditionalOnRevertTokenMint,
        conditionalOnFinalizeTokenMetadata,
        conditionalOnRevertTokenMetadata,
        tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      });
  }

  redeemConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    user: PublicKey = this.provider.publicKey
  ) {
    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    return this.vaultProgram.methods
      .redeemConditionalTokensForUnderlyingTokens()
      .accounts({
        authority: user,
        vault,
        vaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true
        ),
        userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          user,
          true
        ),
        conditionalOnFinalizeTokenMint,
        userConditionalOnFinalizeTokenAccount: getAssociatedTokenAddressSync(
          conditionalOnFinalizeTokenMint,
          user
        ),
        conditionalOnRevertTokenMint,
        userConditionalOnRevertTokenAccount: getAssociatedTokenAddressSync(
          conditionalOnRevertTokenMint,
          user
        ),
      });
  }

  mergeConditionalTokensIx(
    vault: PublicKey,
    underlyingTokenMint: PublicKey,
    amount: BN,
    user: PublicKey = this.provider.publicKey
  ) {
    const [conditionalOnFinalizeTokenMint] = getVaultFinalizeMintAddr(
      this.vaultProgram.programId,
      vault
    );
    const [conditionalOnRevertTokenMint] = getVaultRevertMintAddr(
      this.vaultProgram.programId,
      vault
    );

    return this.vaultProgram.methods
      .mergeConditionalTokensForUnderlyingTokens(amount)
      .accounts({
        authority: user,
        vault,
        vaultUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true
        ),
        userUnderlyingTokenAccount: getAssociatedTokenAddressSync(
          underlyingTokenMint,
          user,
          true
        ),
        conditionalOnFinalizeTokenMint,
        userConditionalOnFinalizeTokenAccount: getAssociatedTokenAddressSync(
          conditionalOnFinalizeTokenMint,
          user
        ),
        conditionalOnRevertTokenMint,
        userConditionalOnRevertTokenAccount: getAssociatedTokenAddressSync(
          conditionalOnRevertTokenMint,
          user
        ),
      });
  }

  async initializeVault(
    settlementAuthority: PublicKey,
    underlyingTokenMint: PublicKey,
    payer: PublicKey = this.provider.publicKey
  ): Promise<PublicKey> {
    const [vault] = getVaultAddr(
      this.vaultProgram.programId,
      settlementAuthority,
      underlyingTokenMint
    );

    await this.initializeVaultIx(
      settlementAuthority,
      underlyingTokenMint,
      payer
    ).rpc();

    return vault;
  }
}
