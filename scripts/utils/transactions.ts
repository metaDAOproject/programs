import { AnchorProvider } from "@coral-xyz/anchor";
import bs58 from "bs58";
import { Keypair, SendTransactionError, Transaction } from "@solana/web3.js";

/**
 * What a probe found at the accounts a transaction creates: they exist
 * holding what the transaction puts there (`landed`), don't exist (`absent`),
 * or exist holding something else, like another proposal at the same squads
 * transaction index (`taken`).
 */
export type ProbeResult = "landed" | "absent" | "taken";

// Sends a signed transaction, throwing if it isn't confirmed or lands with an
// error
export const sendAndConfirm = async (
  provider: AnchorProvider,
  transaction: Transaction,
) => {
  const signature = await provider.connection.sendRawTransaction(
    transaction.serialize(),
  );
  const status = await provider.connection.confirmTransaction(
    signature,
    "confirmed",
  );
  if (status.value.err) {
    throw new Error(
      `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
    );
  }
  return signature;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A preflight rejection: the node simulated the transaction and refused to
// forward it. Any other send error may have come back after the transaction
// was forwarded.
const isPreflightRejection = (error: unknown) =>
  error instanceof SendTransactionError &&
  error.message.includes("Transaction simulation failed");

/**
 * Sends a transaction, retrying until it's confirmed at the confirmed
 * commitment or `attempts` run out, without a retry ever duplicating what an
 * earlier attempt created:
 *
 * - A preflight rejection was never broadcast. Any other send error is
 *   followed by confirming the signature until it lands or its blockhash
 *   expires, after which it can't land anymore.
 * - Before each attempt, `probe` looks at the created accounts: an attempt
 *   that landed without being confirmed is adopted, and when another
 *   transaction took the address the transaction is rebuilt via `build`.
 *   Otherwise `build` is called once, so an address it derives from mutable
 *   state (a squads transaction index) stays pinned across attempts.
 *
 * Returns what `build` returned plus the confirmed signature - null when the
 * probe found the accounts before anything was sent.
 */
export const sendWithRetries = async <T extends { transaction: Transaction }>({
  provider,
  payer,
  signers = [],
  name,
  build,
  probe,
  attempts = 5,
}: {
  provider: AnchorProvider;
  payer: Keypair;
  signers?: Keypair[];
  name: string;
  build: () => Promise<T>;
  probe: (built: T) => Promise<ProbeResult>;
  attempts?: number;
}): Promise<T & { signature: string | null }> => {
  let built = await build();
  let lastSignature: string | null = null;
  let lastError: unknown;

  const landed = () => {
    if (lastSignature) {
      console.log(`${name} landed!`);
      console.log("Transaction signature:", lastSignature);
    } else {
      console.log(`${name} already exists - skipping`);
    }
    return { ...built, signature: lastSignature };
  };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const state = await probe(built);
    if (state === "landed") {
      return landed();
    }
    if (state === "taken") {
      console.warn(`${name}: address taken by another transaction, rebuilding`);
      built = await build();
    }

    try {
      const { transaction } = built;
      const { blockhash, lastValidBlockHeight } =
        await provider.connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = payer.publicKey;
      transaction.sign(payer, ...signers);
      const signature = bs58.encode(transaction.signature!);

      try {
        await provider.connection.sendRawTransaction(transaction.serialize(), {
          preflightCommitment: "confirmed",
        });
      } catch (error) {
        if (isPreflightRejection(error)) {
          throw error;
        }
        // May have been forwarded before the error came back - confirm it
        // like a sent one
      }
      lastSignature = signature;

      const status = await provider.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      if (status.value.err) {
        throw new Error(
          `Transaction ${signature} failed: ${JSON.stringify(status.value.err)}`,
        );
      }

      console.log(`${name} created!`);
      console.log("Transaction signature:", signature);
      return { ...built, signature };
    } catch (error) {
      lastError = error;
      console.warn(
        `${name}: attempt ${attempt} of ${attempts} failed -`,
        error instanceof Error ? error.message : error,
      );
      if (attempt < attempts) {
        await sleep(2_000);
      }
    }
  }

  // Out of attempts - a last look so the failure is reported truthfully
  const state = await probe(built);
  if (state === "landed") {
    return landed();
  }
  console.error(
    state === "taken"
      ? `${name}: giving up - another transaction took the address, nothing of this run's landed`
      : `${name}: giving up - nothing landed`,
  );
  throw lastError;
};
