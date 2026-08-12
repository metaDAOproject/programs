// Creates the relaunch SDK's global frozen address lookup table.
//
// The address list mirrors vibes/relaunch-alt-contents.html: groups A-G are
// protocol statics, group H is the whirlpool tick-array band (32 arrays below
// the current price up through tick 0 = $1,000/SOL). Groups D/E/H are
// re-resolved from mainnet at run time, so run `plan` and eyeball the list
// right before creating.
//
// Usage (env: ANCHOR_PROVIDER_URL, ANCHOR_WALLET, PRIORITY_FEE_MICRO_LAMPORTS):
//   yarn relaunch-create-alt                          # plan: print the list, no txs
//   yarn relaunch-create-alt create                   # create table + extend + verify
//   yarn relaunch-create-alt create --table <addr>    # resume a partially extended table
//   yarn relaunch-create-alt verify --table <addr>    # compare on-chain contents to the plan
//   yarn relaunch-create-alt freeze --table <addr>    # verify, confirm, then freeze (PERMANENT)
//   yarn relaunch-create-alt dump --table <addr> --out <path>
//     # write the frozen table's account data as a bankrun fixture; zeroes
//     # last_extended_slot so all entries are active at bankrun's low slots
//
// The table authority is the script wallet until `freeze` removes it. Only
// freeze after `verify` passes and the address is pinned nowhere yet — once
// frozen the table can never be extended, closed, or edited.

import * as anchor from "@coral-xyz/anchor";
import {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  FUTARCHY_V0_6_PROGRAM_ID,
  MAINNET_USDC,
  MPL_TOKEN_METADATA_PROGRAM_ID,
  PUMP_AMM_PROGRAM_ID,
  PUMP_FEES_PROGRAM_ID,
  RELAUNCH_V0_1_PROGRAM_ID,
  SQUADS_PROGRAM_CONFIG,
  SQUADS_PROGRAM_CONFIG_TREASURY,
  SQUADS_PROGRAM_ID,
  WHIRLPOOL_PROGRAM_ID,
} from "@metadaoproject/programs";
import {
  MEMO_PROGRAM_ID,
  PUMP_AMM_EVENT_AUTHORITY,
  PUMP_AMM_FEE_CONFIG,
  PUMP_AMM_GLOBAL_CONFIG,
  PUMP_AMM_GLOBAL_VOLUME_ACCUMULATOR,
  USDC_SWAP_POOL,
  getWhirlpoolTickArrayAddr,
  getWhirlpoolOracleAddr,
  parsePumpGlobalConfig,
  parseWhirlpool,
} from "@metadaoproject/programs/relaunch";
import * as readline from "readline/promises";

const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
const LOOKUP_TABLE_MAX_ADDRESSES = 256;
const ADDRESSES_PER_EXTEND = 20;
const TICK_ARRAYS_BELOW_CURRENT = 32;
// The array starting at tick 0 covers prices through 1000 * 1.0001^span,
// i.e. just past $1,000/SOL given the pool's 10^(9-6) decimal shift.
const TICK_BAND_TOP_START = 0;

type Entry = { label: string; key: PublicKey };

async function buildAddressList(connection: Connection): Promise<Entry[]> {
  const [globalConfigInfo, poolInfo] = await connection.getMultipleAccountsInfo(
    [PUMP_AMM_GLOBAL_CONFIG, USDC_SWAP_POOL],
  );
  if (!globalConfigInfo) throw new Error("pump global config not found");
  if (!poolInfo) throw new Error("whirlpool USDC_SWAP_POOL not found");

  const { protocolFeeRecipients, buybackFeeRecipients } = parsePumpGlobalConfig(
    globalConfigInfo.data,
  );
  const pool = parseWhirlpool(poolInfo.data);

  if (
    !pool.tokenMintA.equals(NATIVE_MINT) ||
    !pool.tokenMintB.equals(MAINNET_USDC)
  ) {
    throw new Error("USDC_SWAP_POOL mints are not WSOL/USDC");
  }

  const entries: Entry[] = [];
  const push = (label: string, key: PublicKey) => entries.push({ label, key });

  // A. Relaunch protocol
  push("relaunch program", RELAUNCH_V0_1_PROGRAM_ID);
  push(
    "relaunch event authority",
    PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      RELAUNCH_V0_1_PROGRAM_ID,
    )[0],
  );

  // B. Core programs, sysvars, mints
  push("system program", SystemProgram.programId);
  push("token program", TOKEN_PROGRAM_ID);
  push("token-2022 program", TOKEN_2022_PROGRAM_ID);
  push("associated token program", ASSOCIATED_TOKEN_PROGRAM_ID);
  push("memo program", MEMO_PROGRAM_ID);
  push("rent sysvar", SYSVAR_RENT_PUBKEY);
  push("mpl token metadata program", MPL_TOKEN_METADATA_PROGRAM_ID);
  push("WSOL mint", NATIVE_MINT);
  push("USDC mint", MAINNET_USDC);

  // C. pump statics
  push("pump_amm program", PUMP_AMM_PROGRAM_ID);
  push("pump fees program", PUMP_FEES_PROGRAM_ID);
  push("pump global config", PUMP_AMM_GLOBAL_CONFIG);
  push("pump event authority", PUMP_AMM_EVENT_AUTHORITY);
  push("pump fee config", PUMP_AMM_FEE_CONFIG);
  push("pump global volume accumulator", PUMP_AMM_GLOBAL_VOLUME_ACCUMULATOR);

  // D/E. fee recipients + their quote-mint ATAs (config-order snapshot)
  const pushRecipients = (kind: string, recipients: PublicKey[]) => {
    recipients.forEach((recipient, i) => {
      push(`${kind} fee recipient #${i + 1}`, recipient);
      push(
        `${kind} fee recipient #${i + 1} WSOL ATA`,
        getAssociatedTokenAddressSync(NATIVE_MINT, recipient, true),
      );
      push(
        `${kind} fee recipient #${i + 1} USDC ATA`,
        getAssociatedTokenAddressSync(MAINNET_USDC, recipient, true),
      );
    });
  };
  pushRecipients("protocol", protocolFeeRecipients);
  pushRecipients("buyback", buybackFeeRecipients);

  // F. whirlpool statics
  push("whirlpool program", WHIRLPOOL_PROGRAM_ID);
  push("USDC_SWAP_POOL", USDC_SWAP_POOL);
  push("USDC_SWAP_POOL WSOL vault", pool.tokenVaultA);
  push("USDC_SWAP_POOL USDC vault", pool.tokenVaultB);
  push("USDC_SWAP_POOL oracle", getWhirlpoolOracleAddr(USDC_SWAP_POOL));

  // G. futarchy + squads statics
  push("futarchy program", FUTARCHY_V0_6_PROGRAM_ID);
  push(
    "futarchy event authority",
    PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      FUTARCHY_V0_6_PROGRAM_ID,
    )[0],
  );
  push("squads program", SQUADS_PROGRAM_ID);
  push("squads program config", SQUADS_PROGRAM_CONFIG);
  push("squads program config treasury", SQUADS_PROGRAM_CONFIG_TREASURY);

  // H. whirlpool tick-array band
  const span = 88 * pool.tickSpacing;
  const currentStart = Math.floor(pool.tickCurrentIndex / span) * span;
  if (currentStart > TICK_BAND_TOP_START) {
    throw new Error(
      `pool tick ${pool.tickCurrentIndex} is above the band top ($1,000/SOL); revisit the band bounds`,
    );
  }
  for (
    let start = currentStart - TICK_ARRAYS_BELOW_CURRENT * span;
    start <= TICK_BAND_TOP_START;
    start += span
  ) {
    push(
      `tick array [${start}, ${start + span})`,
      getWhirlpoolTickArrayAddr(USDC_SWAP_POOL, start),
    );
  }

  const seen = new Set<string>();
  for (const { label, key } of entries) {
    const b58 = key.toBase58();
    if (seen.has(b58))
      throw new Error(`duplicate address in list: ${label} (${b58})`);
    seen.add(b58);
  }
  if (entries.length > LOOKUP_TABLE_MAX_ADDRESSES) {
    throw new Error(
      `list has ${entries.length} entries, max is ${LOOKUP_TABLE_MAX_ADDRESSES}`,
    );
  }

  return entries;
}

function priorityFeeIx() {
  return ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: parseInt(process.env.PRIORITY_FEE_MICRO_LAMPORTS ?? "10000"),
  });
}

async function fetchTableAddresses(connection: Connection, table: PublicKey) {
  const res = await connection.getAddressLookupTable(table);
  if (!res.value) throw new Error(`lookup table ${table.toBase58()} not found`);
  return res.value;
}

/// Compares the on-chain table against the computed list. `asPrefix` allows
/// the on-chain table to be an incomplete prefix (for resuming extends).
function compareAddresses(
  onChain: PublicKey[],
  expected: Entry[],
  asPrefix: boolean,
): { matches: boolean; problems: string[] } {
  const problems: string[] = [];
  if (
    asPrefix
      ? onChain.length > expected.length
      : onChain.length !== expected.length
  ) {
    problems.push(
      `length mismatch: on-chain ${onChain.length}, expected ${expected.length}`,
    );
  }
  const upTo = Math.min(onChain.length, expected.length);
  for (let i = 0; i < upTo; i++) {
    if (!onChain[i].equals(expected[i].key)) {
      problems.push(
        `index ${i}: on-chain ${onChain[i].toBase58()}, expected ${expected[i].key.toBase58()} (${expected[i].label})`,
      );
    }
  }
  return { matches: problems.length === 0, problems };
}

async function extendTable(
  provider: anchor.AnchorProvider,
  table: PublicKey,
  entries: Entry[],
  alreadyExtended: number,
) {
  for (let i = alreadyExtended; i < entries.length; i += ADDRESSES_PER_EXTEND) {
    const chunk = entries.slice(i, i + ADDRESSES_PER_EXTEND);
    const ix = AddressLookupTableProgram.extendLookupTable({
      lookupTable: table,
      authority: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
      addresses: chunk.map((e) => e.key),
    });
    const signature = await provider.sendAndConfirm(
      new Transaction().add(priorityFeeIx(), ix),
    );
    console.log(
      `extended ${i}..${i + chunk.length - 1} (${chunk[0].label} .. ${chunk[chunk.length - 1].label}): ${signature}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.find((a) => !a.startsWith("--")) ?? "plan";
  const tableArg = args.includes("--table")
    ? new PublicKey(args[args.indexOf("--table") + 1])
    : undefined;

  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;

  const genesisHash = await connection.getGenesisHash();
  if (
    genesisHash !== MAINNET_GENESIS_HASH &&
    !args.includes("--allow-non-mainnet")
  ) {
    throw new Error(
      `RPC is not mainnet (genesis ${genesisHash}); pass --allow-non-mainnet to override`,
    );
  }

  const entries = await buildAddressList(connection);
  const rent = await connection.getMinimumBalanceForRentExemption(
    56 + 32 * entries.length,
  );
  console.log(
    `computed ${entries.length} addresses (${LOOKUP_TABLE_MAX_ADDRESSES - entries.length} slots spare); rent ${rent / 1e9} SOL\n`,
  );

  if (command === "plan") {
    entries.forEach((e, i) =>
      console.log(String(i).padStart(3), e.key.toBase58(), e.label),
    );
    console.log(
      `\ndry run only. Next: yarn relaunch-create-alt create (then verify, then freeze).`,
    );
    return;
  }

  if (command === "create") {
    let table = tableArg;
    let alreadyExtended = 0;
    if (table) {
      const existing = await fetchTableAddresses(connection, table);
      if (!existing.state.authority?.equals(provider.wallet.publicKey)) {
        throw new Error(
          "wallet is not the table authority (or table is frozen)",
        );
      }
      const { matches, problems } = compareAddresses(
        existing.state.addresses,
        entries,
        true,
      );
      if (!matches) {
        throw new Error(
          `existing table is not a prefix of the computed list:\n${problems.join("\n")}\n` +
            `(if groups D/E/H changed on-chain since the table was created, start a fresh table)`,
        );
      }
      alreadyExtended = existing.state.addresses.length;
      console.log(`resuming ${table.toBase58()} at index ${alreadyExtended}`);
    } else {
      const recentSlot = await connection.getSlot("finalized");
      const [createIx, tableAddr] = AddressLookupTableProgram.createLookupTable(
        {
          authority: provider.wallet.publicKey,
          payer: provider.wallet.publicKey,
          recentSlot,
        },
      );
      table = tableAddr;
      const signature = await provider.sendAndConfirm(
        new Transaction().add(priorityFeeIx(), createIx),
      );
      console.log(`created lookup table ${table.toBase58()}: ${signature}`);
    }

    await extendTable(provider, table, entries, alreadyExtended);

    const final = await fetchTableAddresses(connection, table);
    const { matches, problems } = compareAddresses(
      final.state.addresses,
      entries,
      false,
    );
    if (!matches)
      throw new Error(
        `post-extend verification FAILED:\n${problems.join("\n")}`,
      );
    console.log(
      `\nverified: ${table.toBase58()} holds all ${entries.length} addresses in order.\n` +
        `Table is usable one slot after the last extend. When satisfied:\n` +
        `  yarn relaunch-create-alt freeze --table ${table.toBase58()}`,
    );
    return;
  }

  if (command === "verify" || command === "freeze") {
    if (!tableArg) throw new Error(`${command} requires --table <address>`);
    const account = await fetchTableAddresses(connection, tableArg);
    const { matches, problems } = compareAddresses(
      account.state.addresses,
      entries,
      false,
    );
    const frozen = !account.state.authority;
    console.log(
      `table ${tableArg.toBase58()}: ${account.state.addresses.length} addresses, ` +
        (frozen ? "FROZEN" : `authority ${account.state.authority.toBase58()}`),
    );
    if (!matches) {
      console.log(`MISMATCH vs computed list:\n${problems.join("\n")}`);
      if (command === "verify") process.exitCode = 1;
      if (command === "freeze")
        throw new Error("refusing to freeze a mismatched table");
      return;
    }
    console.log("contents match the computed list exactly.");
    if (command === "verify") return;

    if (frozen) {
      console.log("table is already frozen; nothing to do.");
      return;
    }
    if (!args.includes("--yes")) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await rl.question(
        "Freezing is PERMANENT: the table can never be extended, closed, or edited, " +
          "and its rent is locked forever.\nType FREEZE to continue: ",
      );
      rl.close();
      if (answer.trim() !== "FREEZE") {
        console.log("aborted.");
        return;
      }
    }
    const freezeIx = AddressLookupTableProgram.freezeLookupTable({
      lookupTable: tableArg,
      authority: provider.wallet.publicKey,
    });
    const signature = await provider.sendAndConfirm(
      new Transaction().add(priorityFeeIx(), freezeIx),
    );
    const after = await fetchTableAddresses(connection, tableArg);
    if (after.state.authority)
      throw new Error(
        "freeze transaction landed but table still has an authority?",
      );
    console.log(
      `frozen: ${signature}\n` +
        `Pin ${tableArg.toBase58()} in sdk/src/constants.ts (RELAUNCH_V0_1_GLOBAL_ALT).`,
    );
    return;
  }

  if (command === "dump") {
    if (!tableArg) throw new Error("dump requires --table <address>");
    const outIdx = args.indexOf("--out");
    if (outIdx === -1) throw new Error("dump requires --out <path>");
    const outPath = args[outIdx + 1];

    const info = await connection.getAccountInfo(tableArg);
    if (!info) throw new Error(`lookup table ${tableArg.toBase58()} not found`);
    if (!info.owner.equals(AddressLookupTableProgram.programId)) {
      throw new Error(
        `account is owned by ${info.owner.toBase58()}, not the lookup table program`,
      );
    }

    const account = await fetchTableAddresses(connection, tableArg);
    const { matches, problems } = compareAddresses(
      account.state.addresses,
      entries,
      false,
    );
    if (!matches)
      throw new Error(
        `table does not match the computed list:\n${problems.join("\n")}`,
      );
    if (account.state.authority) {
      throw new Error(
        "table is not frozen; freeze it first so the fixture mirrors the final shape",
      );
    }

    // Meta layout: u32 discriminant, u64 deactivation_slot, u64
    // last_extended_slot, u8 last_extended_slot_start_index, Option<Pubkey>
    // authority, u16 padding. Zero the last-extended fields: entries only
    // activate on slots past last_extended_slot, and bankrun clocks start
    // near slot 0 — far below the slot this table was extended at.
    const data = Buffer.from(info.data);
    data.writeBigUInt64LE(0n, 12);
    data.writeUInt8(0, 20);

    const fs = await import("fs");
    fs.writeFileSync(outPath, data);
    console.log(
      `wrote ${data.length} bytes (${account.state.addresses.length} addresses, frozen) to ${outPath}\n` +
        `load in bankrun with owner ${AddressLookupTableProgram.programId.toBase58()} ` +
        `and lamports ${info.lamports} at address ${tableArg.toBase58()}`,
    );
    return;
  }

  throw new Error(
    `unknown command "${command}" (expected plan | create | verify | freeze | dump)`,
  );
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
