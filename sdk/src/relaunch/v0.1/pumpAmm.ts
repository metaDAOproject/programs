import { PublicKey } from "@solana/web3.js";
import { PUMP_AMM_PROGRAM_ID, PUMP_FEES_PROGRAM_ID } from "../../constants.js";

export const PUMP_AMM_GLOBAL_CONFIG = PublicKey.findProgramAddressSync(
  [Buffer.from("global_config")],
  PUMP_AMM_PROGRAM_ID,
)[0];

export const PUMP_AMM_EVENT_AUTHORITY = PublicKey.findProgramAddressSync(
  [Buffer.from("__event_authority")],
  PUMP_AMM_PROGRAM_ID,
)[0];

// Per-consumer fee config the pump fee program keeps for pump_amm.
export const PUMP_AMM_FEE_CONFIG = PublicKey.findProgramAddressSync(
  [Buffer.from("fee_config"), PUMP_AMM_PROGRAM_ID.toBuffer()],
  PUMP_FEES_PROGRAM_ID,
)[0];

export const PUMP_AMM_GLOBAL_VOLUME_ACCUMULATOR =
  PublicKey.findProgramAddressSync(
    [Buffer.from("global_volume_accumulator")],
    PUMP_AMM_PROGRAM_ID,
  )[0];

export function getPumpUserVolumeAccumulatorAddr(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_volume_accumulator"), user.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

// The current pump_amm requires this PDA as the first remaining account on
// buys and sells (checked by address only — the account need not exist).
export function getPumpPoolV2Addr(baseMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool-v2"), baseMint.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

export function getPumpCreatorVaultAuthorityAddr(
  coinCreator: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator_vault"), coinCreator.toBuffer()],
    PUMP_AMM_PROGRAM_ID,
  )[0];
}

export type PumpPoolAccount = {
  poolBump: number;
  index: number;
  creator: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  lpMint: PublicKey;
  poolBaseTokenAccount: PublicKey;
  poolQuoteTokenAccount: PublicKey;
  coinCreator: PublicKey;
};

// Pool account layout: 8-byte discriminator, pool_bump u8, index u16 LE,
// then creator / base_mint / quote_mint / lp_mint / pool_base_token_account /
// pool_quote_token_account pubkeys, lp_supply u64 LE, coin_creator pubkey.
export function parsePumpPool(data: Buffer): PumpPoolAccount {
  return {
    poolBump: data.readUInt8(8),
    index: data.readUInt16LE(9),
    creator: new PublicKey(data.subarray(11, 43)),
    baseMint: new PublicKey(data.subarray(43, 75)),
    quoteMint: new PublicKey(data.subarray(75, 107)),
    lpMint: new PublicKey(data.subarray(107, 139)),
    poolBaseTokenAccount: new PublicKey(data.subarray(139, 171)),
    poolQuoteTokenAccount: new PublicKey(data.subarray(171, 203)),
    coinCreator: new PublicKey(data.subarray(211, 243)),
  };
}

export type PumpGlobalConfigAccount = {
  protocolFeeRecipients: PublicKey[];
  buybackFeeRecipients: PublicKey[];
};

function readRecipients(data: Buffer, offset: number): PublicKey[] {
  const recipients: PublicKey[] = [];
  for (let i = 0; i < 8; i++) {
    const recipient = new PublicKey(
      data.subarray(offset + i * 32, offset + (i + 1) * 32),
    );
    if (!recipient.equals(PublicKey.default)) {
      recipients.push(recipient);
    }
  }
  return recipients;
}

// GlobalConfig layout (unset recipient slots are the default pubkey and are
// filtered out):
//
//   offset size field
//        0    8 discriminator
//        8   32 admin
//       40    8 lp_fee_basis_points
//       48    8 protocol_fee_basis_points
//       56    1 disable_flags
//       57  256 protocol_fee_recipients [Pubkey; 8]
//      313    8 coin_creator_fee_basis_points
//      321   32 admin_set_coin_creator_authority
//      353   32 whitelist_pda
//      385   32 reserved_fee_recipient
//      417    1 mayhem_mode_enabled
//      418  224 reserved_fee_recipients [Pubkey; 7]
//      642    1 is_cashback_enabled
//      643  256 buyback_fee_recipients [Pubkey; 8]
//      899    8 buyback_basis_points
//      907   32 boost_authority
//      939    1 boost_enabled
//      940      total
export function parsePumpGlobalConfig(data: Buffer): PumpGlobalConfigAccount {
  return {
    protocolFeeRecipients: readRecipients(data, 57),
    buybackFeeRecipients: readRecipients(data, 643),
  };
}
