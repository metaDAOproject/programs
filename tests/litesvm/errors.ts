import type { FailedTransactionMetadata } from "litesvm";

// Agave's display text for each fieldless TransactionError variant, indexed by LiteSVM's enum value.
const TRANSACTION_ERRORS: Record<number, string> = {
  0: "Account in use",
  1: "Account loaded twice",
  2: "Attempt to debit an account but found no record of a prior credit.",
  3: "Attempt to load a program that does not exist",
  4: "Insufficient funds for fee",
  5: "This account may not be used to pay transaction fees",
  6: "This transaction has already been processed",
  7: "Blockhash not found",
  8: "Loader call chain is too deep",
  9: "Transaction requires a fee but has no signature present",
  10: "Transaction contains an invalid account reference",
  11: "Transaction did not pass signature verification",
  12: "This program may not be used for executing instructions",
  13: "Transaction failed to sanitize accounts offsets correctly",
  14: "Transactions are currently disabled due to cluster maintenance",
  15: "Transaction processing left an account with an outstanding borrowed reference",
  16: "Transaction would exceed max Block Cost Limit",
  17: "Transaction version is unsupported",
  18: "Transaction loads a writable account that cannot be written",
  19: "Transaction would exceed max account limit within the block",
  20: "Transaction would exceed account data limit within the block",
  21: "Transaction locked too many accounts",
  22: "Transaction loads an address table account that doesn't exist",
  23: "Transaction loads an address table account with an invalid owner",
  24: "Transaction loads an address table account with invalid data",
  25: "Transaction address table lookup uses an invalid index",
  26: "Transaction leaves an account with a lower balance than rent-exempt minimum",
  27: "Transaction would exceed max Vote Cost Limit",
  28: "Transaction would exceed total account data limit",
  29: "Transaction exceeds max loaded accounts data size cap",
  30: "ResanitizationNeeded",
  31: "LoadedAccountsDataSizeLimit set for transaction must be greater than 0.",
  32: "Sum of account balances before and after transaction do not match",
  33: "Program cache hit max limit",
  34: "CommitCancelled",
};

// Agave's display text for each fieldless InstructionError variant, indexed by LiteSVM's enum value.
const INSTRUCTION_ERRORS: Record<number, string> = {
  0: "generic instruction error",
  1: "invalid program argument",
  2: "invalid instruction data",
  3: "invalid account data for instruction",
  4: "account data too small for instruction",
  5: "insufficient funds for instruction",
  6: "incorrect program id for instruction",
  7: "missing required signature for instruction",
  8: "instruction requires an uninitialized account",
  9: "instruction requires an initialized account",
  10: "sum of account balances before and after instruction do not match",
  11: "instruction illegally modified the program id of an account",
  12: "instruction spent from the balance of an account it does not own",
  13: "instruction modified data of an account it does not own",
  14: "instruction changed the balance of a read-only account",
  15: "instruction modified data of a read-only account",
  16: "instruction contains duplicate accounts",
  17: "instruction changed executable bit of an account",
  18: "instruction modified rent epoch of an account",
  19: "insufficient account keys for instruction",
  20: "program other than the account's owner changed the size of the account data",
  21: "instruction expected an executable account",
  22: "instruction tries to borrow reference for an account which is already borrowed",
  23: "instruction left account with an outstanding borrowed reference",
  24: "instruction modifications of multiply-passed account differ",
  25: "program returned invalid error code",
  26: "instruction changed executable accounts data",
  27: "instruction changed the balance of an executable account",
  28: "executable accounts must be rent exempt",
  29: "Unsupported program id",
  30: "Cross-program invocation call depth too deep",
  31: "An account required by the instruction is missing",
  32: "Cross-program invocation reentrancy not allowed for this instruction",
  33: "Length of the seed is too long for address generation",
  34: "Provided seeds do not result in a valid address",
  35: "Failed to reallocate account data",
  36: "Computational budget exceeded",
  37: "Cross-program invocation with unauthorized signer or writable account",
  38: "Failed to create program execution environment",
  39: "Program failed to complete",
  40: "Program failed to compile",
  41: "Account is immutable",
  42: "Incorrect authority provided",
  43: "An account does not have enough lamports to be rent-exempt",
  44: "Invalid account owner",
  45: "Program arithmetic overflowed",
  46: "Unsupported sysvar",
  47: "Provided owner is not allowed",
  48: "Accounts data allocations exceeded the maximum allowed per transaction",
  49: "Max accounts exceeded",
  50: "Max instruction trace length exceeded",
  51: "Builtin programs must consume compute units",
  52: "Failed to serialize or deserialize account data",
};

export type TransactionError = ReturnType<FailedTransactionMetadata["err"]>;

// Render a LiteSVM transaction error the way Agave (and therefore bankrun) prints it.
// The tests were written against bankrun and assert on this exact text (e.g. `custom program error: 0x0`),
// while LiteSVM's own toString() only yields the debug shape `TransactionErrorInstructionError { index: 0, ... }`.
export function renderTransactionError(error: TransactionError): string {
  if (typeof error === "number") {
    return TRANSACTION_ERRORS[error] ?? `TransactionError(${error})`;
  }
  const value = error as unknown as Record<string, unknown>;
  if (typeof value.err === "function" && typeof value.index === "number") {
    const inner = (value.err as () => unknown)();
    return `Error processing Instruction ${value.index}: ${renderInstructionError(inner)}`;
  }
  switch (error.constructor?.name) {
    case "TransactionErrorDuplicateInstruction":
      return `Transaction contains a duplicate instruction (${value.index}) that is not allowed`;
    case "TransactionErrorInsufficientFundsForRent":
      return `Transaction results in an account (${value.accountIndex}) with insufficient funds for rent`;
    case "TransactionErrorProgramExecutionTemporarilyRestricted":
      return `Execution of the program referenced by account at index ${value.accountIndex} is temporarily restricted.`;
    default:
      return String(error);
  }
}

function renderInstructionError(error: unknown): string {
  if (typeof error === "number") {
    return INSTRUCTION_ERRORS[error] ?? `InstructionError(${error})`;
  }
  const value = error as Record<string, unknown>;
  if (typeof value.code === "number") {
    return `custom program error: 0x${value.code.toString(16)}`;
  }
  if (typeof value.msg === "string") {
    return `Failed to serialize or deserialize account data: ${value.msg}`;
  }
  return String(error);
}
