import {
  CompiledInstruction,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";

const blockEngineAddress = "https://mainnet.block-engine.jito.wtf";

type TransactionError = {
  Ok: null;
};
type Context = {
  slot: number;
};

type JitoBundleStatus = {
  bundle_id: string;
  transactions: string[];
  slot: number;
  confirmation_status: "finalized" | "processed" | "confirmed";
  err: TransactionError;
};

type JitoBundleStatusResult = {
  context: Context;
  value: JitoBundleStatus[];
};

type JitoBundleStatusResponse = {
  jsonrpc: string;
  result: JitoBundleStatusResult;
  id: number;
};

export const getBundleStatuses = async (
  bundleId: string,
): Promise<JitoBundleStatusResponse> => {
  const response = await fetch(`${blockEngineAddress}/api/v1/bundles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jito-auth": process.env.JITO_AUTH_TOKEN || "",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBundleStatuses",
      params: [[bundleId]],
    }),
  });

  // TODO: What do we do if we get an error here, shouldn't we retry or something?
  return await response.json();
};

export const sendBundle = async (transactions: Transaction[]) => {
  const serializedTransactions = transactions.map((tx) =>
    bs58.encode(Uint8Array.from(tx.serialize())),
  );

  const response = await fetch(`${blockEngineAddress}/api/v1/bundles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jito-auth": process.env.JITO_AUTH_TOKEN || "",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [serializedTransactions],
    }),
  });

  return await response.json();
};

export const getTipFloor = async () => {
  const response = await fetch(
    `https://bundles.jito.wtf/api/v1/bundles/tip_floor`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "MetaDAO",
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Jito fees: ${response.status} ${response.statusText}`,
    );
  }
  // Convert the ReadableStream to text, then parse as JSON
  const text = await response.text();
  const data = JSON.parse(text);

  // Return empty data structure if no data is available
  if (!data || !data[0]) {
    return {
      time: new Date().toISOString(),
      landed_tips_25th_percentile: 0,
      landed_tips_50th_percentile: 0,
      landed_tips_75th_percentile: 0,
      landed_tips_95th_percentile: 0,
      landed_tips_99th_percentile: 0,
      ema_landed_tips_50th_percentile: 0,
    };
  }

  return data[0].ema_landed_tips_50th_percentile;
};

export const getTipAccounts = async () => {
  const response = await fetch(`${blockEngineAddress}/api/v1/bundles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-jito-auth": process.env.JITO_AUTH_TOKEN || "",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTipAccounts",
      params: [],
    }),
  });

  const result = await response.json();
  return result.result;
};

export function convertTransactionInstruction(
  instruction: TransactionInstruction,
  accountKeys: PublicKey[],
): CompiledInstruction {
  const accountIndices = instruction.keys.map((keyObj) =>
    accountKeys.findIndex((pubkey) => pubkey.equals(keyObj.pubkey)),
  );

  if (accountIndices.includes(-1)) {
    throw new Error("Account key not found in accountKeys list");
  }

  const programIdIndex = accountKeys.findIndex((pubkey) =>
    pubkey.equals(instruction.programId),
  );

  if (programIdIndex === -1) {
    throw new Error("Program ID not found in accountKeys list");
  }

  return {
    programIdIndex,
    accounts: accountIndices,
    data: bs58.encode(Uint8Array.from(instruction.data)),
  };
}

// Function to convert CompiledInstruction to Instruction
export function convertCompiledInstruction(
  compiledInstruction: CompiledInstruction,
  programId: PublicKey,
  accountKeys: PublicKey[],
): TransactionInstruction {
  const keys = compiledInstruction.accounts.map((index) => ({
    pubkey: accountKeys[index],
    isSigner: index === compiledInstruction.programIdIndex, // You might need to adjust this based on your logic
    isWritable: true, // This can be modified based on your requirements
  }));

  return new TransactionInstruction({
    keys,
    programId,
    data: Buffer.from(compiledInstruction.data),
  });
}
