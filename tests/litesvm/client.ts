import { address, getTransactionDecoder } from "@solana/kit";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  Clock,
  FailedTransactionMetadata,
  LiteSVM,
  Rent,
  TransactionMetadata,
} from "litesvm";
import { renderTransactionError } from "./errors.js";

export type AccountInfoBytes = {
  executable: boolean;
  owner: PublicKey;
  lamports: number;
  data: Uint8Array;
  rentEpoch: number;
};

export type BanksTransactionMeta = {
  logMessages: string[];
  computeUnitsConsumed: bigint;
  returnData: { programId: PublicKey; data: Uint8Array };
};

export type BanksTransactionResultWithMeta = {
  result: string | null;
  meta: BanksTransactionMeta;
};

export const toAddress = (key: PublicKey) => address(key.toBase58());

// web3.js signs and serializes; kit decodes the bytes into the shape LiteSVM accepts.
export const toKitTransaction = (tx: Transaction | VersionedTransaction) =>
  getTransactionDecoder().decode(tx.serialize());

// The bankrun BanksClient surface the tests use, served by an in-process LiteSVM.
export class BanksClient {
  constructor(readonly svm: LiteSVM) {}

  async getLatestBlockhash(_commitment?: unknown): Promise<[string, bigint]> {
    return [this.svm.latestBlockhash(), 0n];
  }

  async getAccount(
    key: PublicKey,
    _commitment?: unknown,
  ): Promise<AccountInfoBytes | null> {
    const account = this.svm.getAccount(toAddress(key));
    if (!account.exists) return null;
    return {
      executable: account.executable,
      owner: new PublicKey(account.programAddress),
      lamports: Number(account.lamports),
      data: new Uint8Array(account.data),
      rentEpoch: 0,
    };
  }

  async getBalance(key: PublicKey, _commitment?: unknown): Promise<bigint> {
    return this.svm.getBalance(toAddress(key)) ?? 0n;
  }

  async getClock(): Promise<Clock> {
    return this.svm.getClock();
  }

  async getSlot(_commitment?: unknown): Promise<bigint> {
    return this.svm.getClock().slot;
  }

  async getRent(): Promise<Rent> {
    return this.svm.getRent();
  }

  async tryProcessTransaction(
    tx: Transaction | VersionedTransaction,
  ): Promise<BanksTransactionResultWithMeta> {
    const result = this.svm.sendTransaction(toKitTransaction(tx));
    // Rotate the blockhash like a live chain, so repeated identical instructions never collide in the transaction history.
    this.svm.expireBlockhash();
    if (result instanceof FailedTransactionMetadata) {
      return {
        result: renderTransactionError(result.err()),
        meta: toMeta(result.meta()),
      };
    }
    return { result: null, meta: toMeta(result) };
  }

  // Throws with Agave's error text followed by the program logs.
  async processTransaction(
    tx: Transaction | VersionedTransaction,
  ): Promise<BanksTransactionMeta> {
    const { result, meta } = await this.tryProcessTransaction(tx);
    if (result !== null) {
      throw new Error([result, ...meta.logMessages].join("\n"));
    }
    return meta;
  }

  async simulateTransaction(
    tx: Transaction | VersionedTransaction,
    _commitment?: unknown,
  ): Promise<BanksTransactionResultWithMeta> {
    const result = this.svm.simulateTransaction(toKitTransaction(tx));
    if (result instanceof FailedTransactionMetadata) {
      return {
        result: renderTransactionError(result.err()),
        meta: toMeta(result.meta()),
      };
    }
    return { result: null, meta: toMeta(result.meta()) };
  }
}

function toMeta(meta: TransactionMetadata): BanksTransactionMeta {
  const returnData = meta.returnData();
  return {
    logMessages: meta.logs(),
    computeUnitsConsumed: meta.computeUnitsConsumed(),
    returnData: {
      programId: new PublicKey(returnData.programId()),
      data: returnData.data(),
    },
  };
}
