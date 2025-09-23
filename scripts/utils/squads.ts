import { PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

// Returns the multisig, spending limit and 0th vault pda for a given dao address
export const getSquadsPdasFromDao = async (
  daoAddress: string | PublicKey,
): Promise<{
  multisigPda: PublicKey;
  spendingLimitPda: PublicKey;
  vaultPda: PublicKey;
}> => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPda,
    createKey: dao,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda: multisigPda,
    index: 0,
  });

  return {
    multisigPda,
    spendingLimitPda,
    vaultPda,
  };
};
