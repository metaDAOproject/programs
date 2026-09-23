import * as fs from "fs";
import * as path from "path";
import { address, lamports } from "@solana/kit";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Clock, FailedTransactionMetadata, LiteSVM } from "litesvm";
import { AccountInfoInput, ProgramTestContext } from "./context.js";

export type AddedProgram = { name: string; programId: PublicKey };
export type AddedAccount = { address: PublicKey; info: AccountInfoInput };

// Same payer balance bankrun's genesis grants.
const PAYER_LAMPORTS = 1_000_000n * BigInt(LAMPORTS_PER_SOL);

// Loads every [programs.localnet] program from target/deploy plus the named fixtures, like bankrun's startAnchor.
export async function startAnchor(
  workspacePath: string,
  extraPrograms: AddedProgram[] = [],
  accounts: AddedAccount[] = [],
): Promise<ProgramTestContext> {
  const root = path.resolve(workspacePath);
  // Blockhash age is not checked: the facade rotates the blockhash after every transaction (see client.ts).
  const svm = new LiteSVM()
    .withLamports(PAYER_LAMPORTS * 2n)
    .withBlockhashCheck(false);

  for (const [name, programId] of readLocalnetPrograms(
    path.join(root, "Anchor.toml"),
  )) {
    svm.addProgramFromFile(
      address(programId),
      path.join(root, "target", "deploy", `${name}.so`),
    );
  }
  for (const { name, programId } of extraPrograms) {
    svm.addProgramFromFile(
      address(programId.toBase58()),
      findProgramFile(root, name),
    );
  }

  const payer = Keypair.generate();
  const airdrop = svm.airdrop(
    address(payer.publicKey.toBase58()),
    lamports(PAYER_LAMPORTS),
  );
  if (airdrop instanceof FailedTransactionMetadata) {
    throw new Error(`payer airdrop failed: ${airdrop.toString()}`);
  }

  const context = new ProgramTestContext(svm, payer);
  for (const { address: key, info } of accounts) {
    context.setAccount(key, info);
  }

  // LiteSVM starts at Unix time 0; tests derive deadlines from the clock, so start at wall-clock time.
  const clock = svm.getClock();
  context.setClock(
    new Clock(
      clock.slot,
      clock.epochStartTimestamp,
      clock.epoch,
      clock.leaderScheduleEpoch,
      BigInt(Math.floor(Date.now() / 1000)),
    ),
  );
  return context;
}

function readLocalnetPrograms(anchorToml: string): [string, string][] {
  const lines = fs.readFileSync(anchorToml, "utf8").split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim() === "[programs.localnet]",
  );
  if (start < 0) {
    throw new Error(`no [programs.localnet] table in ${anchorToml}`);
  }
  const programs: [string, string][] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim().startsWith("[")) break;
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/);
    if (match) programs.push([match[1].replace(/-/g, "_"), match[2]]);
  }
  return programs;
}

function findProgramFile(root: string, name: string): string {
  const candidates = [
    path.join(root, "tests", "fixtures", `${name}.so`),
    path.join(root, "target", "deploy", `${name}.so`),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`${name}.so not found in tests/fixtures or target/deploy`);
  }
  return found;
}
