import { Provider, Wallet, utils } from "@coral-xyz/anchor";
import {
  AccountInfo,
  Commitment,
  ConfirmOptions,
  Connection,
  PublicKey,
  SendOptions,
  SendTransactionError,
  Signer,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { BanksClient } from "./client.js";
import { ProgramTestContext } from "./context.js";

// The Connection methods Anchor, the SDK and @solana/spl-token call on provider.connection.
class LiteSVMConnection {
  constructor(private readonly banksClient: BanksClient) {}

  private async accountInfo(
    key: PublicKey,
  ): Promise<AccountInfo<Buffer> | null> {
    const account = await this.banksClient.getAccount(key);
    return account ? { ...account, data: Buffer.from(account.data) } : null;
  }

  private async slot(): Promise<number> {
    return Number(await this.banksClient.getSlot());
  }

  async getAccountInfo(key: PublicKey, _commitment?: unknown) {
    return this.accountInfo(key);
  }

  async getAccountInfoAndContext(key: PublicKey, _commitment?: unknown) {
    return {
      context: { slot: await this.slot() },
      value: await this.accountInfo(key),
    };
  }

  async getMultipleAccountsInfo(keys: PublicKey[], _commitment?: unknown) {
    return Promise.all(keys.map((key) => this.accountInfo(key)));
  }

  async getMultipleAccountsInfoAndContext(
    keys: PublicKey[],
    _commitment?: unknown,
  ) {
    return {
      context: { slot: await this.slot() },
      value: await this.getMultipleAccountsInfo(keys),
    };
  }

  async getMinimumBalanceForRentExemption(
    dataLength: number,
    _commitment?: unknown,
  ) {
    const rent = await this.banksClient.getRent();
    return Number(rent.minimumBalance(BigInt(dataLength)));
  }

  async getLatestBlockhash(_commitment?: unknown) {
    const [blockhash] = await this.banksClient.getLatestBlockhash();
    return { blockhash, lastValidBlockHeight: 0 };
  }

  async getSlot(_commitment?: unknown) {
    return this.slot();
  }

  async getBalance(key: PublicKey, _commitment?: unknown) {
    return Number(await this.banksClient.getBalance(key));
  }
}

// web3.js 1.92+ takes an options object, older versions take (message, logs); both expose err.logs, which Anchor reads.
function sendTransactionError(
  signature: string,
  message: string,
  logs: string[],
): SendTransactionError {
  const Ctor = SendTransactionError as unknown as new (
    ...args: unknown[]
  ) => SendTransactionError & { logs?: string[] };
  const error = new Ctor({
    action: "send",
    signature,
    transactionMessage: message,
    logs,
  });
  return error.logs ? error : new Ctor(message, logs);
}

// The anchor-bankrun BankrunProvider, re-based on the LiteSVM facade.
export class LiteSVMProvider implements Provider {
  readonly wallet: Wallet;
  readonly connection: Connection;
  readonly publicKey: PublicKey;

  constructor(
    readonly context: ProgramTestContext,
    wallet?: Wallet,
  ) {
    this.wallet = wallet ?? new Wallet(context.payer);
    this.connection = new LiteSVMConnection(
      context.banksClient,
    ) as unknown as Connection;
    this.publicKey = this.wallet.publicKey;
  }

  private async sign(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
  ): Promise<string> {
    if ("version" in tx) {
      signers?.forEach((signer) => tx.sign([signer]));
    } else {
      tx.feePayer = tx.feePayer ?? this.wallet.publicKey;
      tx.recentBlockhash = this.context.lastBlockhash;
      signers?.forEach((signer) => tx.partialSign(signer));
    }
    await this.wallet.signTransaction(tx);
    const signature = "version" in tx ? tx.signatures[0] : tx.signature;
    if (!signature) throw new Error("Missing fee payer signature");
    return utils.bytes.bs58.encode(signature);
  }

  private async sendSigned(
    tx: Transaction | VersionedTransaction,
    signature: string,
  ): Promise<void> {
    const { result, meta } =
      await this.context.banksClient.tryProcessTransaction(tx);
    if (result !== null) {
      throw sendTransactionError(signature, result, meta.logMessages);
    }
  }

  async send(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    _opts?: SendOptions,
  ): Promise<TransactionSignature> {
    const signature = await this.sign(tx, signers);
    await this.context.banksClient.tryProcessTransaction(tx);
    return signature;
  }

  async sendAndConfirm(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    _opts?: ConfirmOptions,
  ): Promise<TransactionSignature> {
    const signature = await this.sign(tx, signers);
    await this.sendSigned(tx, signature);
    return signature;
  }

  async sendAll<T extends Transaction | VersionedTransaction>(
    txWithSigners: { tx: T; signers?: Signer[] }[],
    _opts?: ConfirmOptions,
  ): Promise<TransactionSignature[]> {
    const signatures: TransactionSignature[] = [];
    for (const { tx, signers } of txWithSigners) {
      const signature = await this.sign(tx, signers);
      await this.sendSigned(tx, signature);
      signatures.push(signature);
    }
    return signatures;
  }

  async simulate(
    tx: Transaction | VersionedTransaction,
    signers?: Signer[],
    _commitment?: Commitment,
    includeAccounts?: boolean | PublicKey[],
  ): ReturnType<NonNullable<Provider["simulate"]>> {
    if (includeAccounts !== undefined) {
      throw new Error("includeAccounts cannot be used with LiteSVMProvider");
    }
    const signature = await this.sign(tx, signers);
    const { result, meta } =
      await this.context.banksClient.simulateTransaction(tx);
    if (result !== null) {
      throw sendTransactionError(signature, result, meta.logMessages);
    }
    return {
      logs: meta.logMessages,
      unitsConsumed: Number(meta.computeUnitsConsumed),
      returnData: {
        programId: meta.returnData.programId.toString(),
        data: [Buffer.from(meta.returnData.data).toString("base64"), "base64"],
      },
    };
  }
}
