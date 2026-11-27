import { address, lamports } from "@solana/kit";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Clock, LiteSVM, SlotHash } from "litesvm";
import { AccountInfoBytes, BanksClient } from "./client.js";

export type AccountInfoInput = Omit<
  AccountInfoBytes,
  "rentEpoch" | "lamports"
> & {
  lamports: number | bigint;
  rentEpoch?: number;
};

const SLOT_HASHES_WINDOW = 512n;

// The bankrun ProgramTestContext surface the tests use.
export class ProgramTestContext {
  readonly banksClient: BanksClient;

  constructor(
    readonly svm: LiteSVM,
    readonly payer: Keypair,
  ) {
    this.banksClient = new BanksClient(svm);
  }

  get lastBlockhash(): string {
    return this.svm.latestBlockhash();
  }

  setAccount(key: PublicKey, account: AccountInfoInput): void {
    const data = new Uint8Array(account.data);
    this.svm.setAccount({
      address: address(key.toBase58()),
      data,
      executable: account.executable,
      lamports: lamports(BigInt(account.lamports)),
      programAddress: address(account.owner.toBase58()),
      space: BigInt(data.length),
    });
  }

  // Also rewrite SlotHashes so recent-slot checks (lookup-table creation) see the new slot.
  setClock(clock: Clock): void {
    this.svm.setClock(clock);
    const hash = this.svm.latestBlockhash();
    const hashes: { slot: bigint; hash: string }[] = [];
    for (let i = 0n; i < SLOT_HASHES_WINDOW && clock.slot >= i; i++) {
      hashes.push({ slot: clock.slot - i, hash });
    }
    this.svm.setSlotHashes(hashes as unknown as SlotHash[]);
  }

  warpToSlot(slot: bigint): void {
    const clock = this.svm.getClock();
    clock.slot = slot;
    this.setClock(clock);
  }
}
