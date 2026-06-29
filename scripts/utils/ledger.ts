import * as TransportNodeHidModule from "@ledgerhq/hw-transport-node-hid";
import * as SolanaAppModule from "@ledgerhq/hw-app-solana";
import { PublicKey } from "@solana/web3.js";

const TransportNodeHid =
  (TransportNodeHidModule as any).default?.default ||
  (TransportNodeHidModule as any).default;
const SolanaApp =
  (SolanaAppModule as any).default?.default || (SolanaAppModule as any).default;

export const LEDGER_DERIVATION_PATH = "44'/501'/0'";

export async function connectLedger(): Promise<{
  solana: any;
  publicKey: PublicKey;
}> {
  console.log("  Connecting to Ledger device...");
  console.log("  Please unlock your Ledger and open the Solana app.");

  const transport = await TransportNodeHid.open("");
  const solana = new SolanaApp(transport);

  const { address } = await solana.getAddress(LEDGER_DERIVATION_PATH);
  const publicKey = new PublicKey(Buffer.from(address));

  console.log("  Connected! Ledger address:", publicKey.toBase58());
  return { solana, publicKey };
}
