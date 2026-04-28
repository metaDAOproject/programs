import { PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import { CONDITIONAL_VAULT_V0_3_PROGRAM_ID } from "../../constants.js";

export const getVaultAddr = (
  programId: PublicKey = CONDITIONAL_VAULT_V0_3_PROGRAM_ID,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    programId,
  );
};

export const getVaultFinalizeMintAddr = (
  programId: PublicKey = CONDITIONAL_VAULT_V0_3_PROGRAM_ID,
  vault: PublicKey,
): [PublicKey, number] => {
  return getVaultMintAddr(programId, vault, "conditional_on_finalize_mint");
};

export const getVaultRevertMintAddr = (
  programId: PublicKey = CONDITIONAL_VAULT_V0_3_PROGRAM_ID,
  vault: PublicKey,
): [PublicKey, number] => {
  return getVaultMintAddr(programId, vault, "conditional_on_revert_mint");
};

const getVaultMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  seed: string,
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(seed), vault.toBuffer()],
    programId,
  );
};
