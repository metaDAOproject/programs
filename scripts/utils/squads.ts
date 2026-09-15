import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import type { ProbeResult } from "./transactions.js";

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

export const createSquadsVaultTxAndProposal = async (
  squadsMultisig: PublicKey,
  transactionIndex: bigint,
  transactionMessage: TransactionMessage,
  payer: PublicKey,
  creator: PublicKey = PERMISSIONLESS_ACCOUNT.publicKey,
) => {
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    isDraft: false,
  });

  return {
    vaultTxCreateIx,
    proposalCreateIx,
  };
};

/**
 * How a vault transaction's message compares to `instructions`: `exact` when
 * it holds the same programs, accounts (in order) and data; `data` when only
 * the data of some instructions (`differing`, by index) differs - the same
 * actions built against other state; `different` otherwise: other programs
 * or accounts, another number of instructions, or lookup tables in use.
 */
export type InstructionsComparison =
  | { kind: "exact" }
  | { kind: "data"; differing: number[] }
  | { kind: "different" };

export const compareVaultTransactionInstructions = (
  message: multisig.generated.VaultTransactionMessage,
  instructions: TransactionInstruction[],
): InstructionsComparison => {
  if (
    message.addressTableLookups.length > 0 ||
    message.instructions.length !== instructions.length
  ) {
    return { kind: "different" };
  }

  const differing: number[] = [];
  for (const [i, compiled] of message.instructions.entries()) {
    const instruction = instructions[i];
    const accounts = Array.from(compiled.accountIndexes).map(
      (index) => message.accountKeys[index],
    );
    const sameTarget =
      message.accountKeys[compiled.programIdIndex]?.equals(
        instruction.programId,
      ) &&
      accounts.length === instruction.keys.length &&
      accounts.every((account, j) =>
        account?.equals(instruction.keys[j].pubkey),
      );
    if (!sameTarget) {
      return { kind: "different" };
    }
    if (!Buffer.from(compiled.data).equals(instruction.data)) {
      differing.push(i);
    }
  }

  return differing.length > 0 ? { kind: "data", differing } : { kind: "exact" };
};

/**
 * Probes the vault transaction at `vaultTransactionPda`: absent, holding
 * exactly `instructions` (landed - either ours or an identical one, which
 * amounts to the same), or holding something else (taken - another proposal
 * got the transaction index).
 */
export const probeSquadsVaultTransaction = async (
  connection: Connection,
  vaultTransactionPda: PublicKey,
  instructions: TransactionInstruction[],
): Promise<ProbeResult> => {
  const accountInfo = await connection.getAccountInfo(
    vaultTransactionPda,
    "confirmed",
  );
  if (!accountInfo) {
    return "absent";
  }
  const [vaultTransaction] =
    multisig.accounts.VaultTransaction.fromAccountInfo(accountInfo);
  return compareVaultTransactionInstructions(
    vaultTransaction.message,
    instructions,
  ).kind === "exact"
    ? "landed"
    : "taken";
};
