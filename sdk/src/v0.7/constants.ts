import { Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";

export const FUTARCHY_PROGRAM_ID = new PublicKey(
  "FUTARELBfJfQ8RDGhg1wdhddq1odMAJUePHFuBYfUxKq",
);
export const AMM_PROGRAM_ID = new PublicKey(
  "AMMJdEiCCa8mdugg6JPF7gFirmmxisTfDJoSNSUi5zDJ",
);
export const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "VLTX1ishMBbcX3rdBWGssxawAo1Q2X2qxYFYqiGodVg",
);
export const LAUNCHPAD_PROGRAM_ID = new PublicKey(
  "moontUzsdepotRGe5xsfip7vLPTJnVuafqdUWexVnPM",
);
export const SHARED_LIQUIDITY_MANAGER_PROGRAM_ID = new PublicKey(
  "EoJc1PYxZbnCjszampLcwJGYcB5Md47jM4oSQacRtD4d",
);
export const PRICE_BASED_PERFORMANCE_PACKAGE_PROGRAM_ID = new PublicKey(
  "pbPPQH7jyKoSLu8QYs3rSY3YkDRXEBojKbTgnUg7NDS",
);
export const BID_WALL_PROGRAM_ID = new PublicKey(
  "WALL8ucBuUyL46QYxwYJjidaFYhdvxUFrgvBxPshERx",
);
export const MINT_GOVERNOR_PROGRAM_ID = new PublicKey(
  "gvnr27cVeyW3AVf3acL7VCJ5WjGAphytnsgcK1feHyH",
);
export const PERFORMANCE_PACKAGE_V2_PROGRAM_ID = new PublicKey(
  "pPV2pfrxnmstSb9j7kEeCLny5BGj6SNwCWGd6xbGGzz",
);
export const LIQUIDATION_PROGRAM_ID = new PublicKey(
  "LiQnowFbFQdYyZhF4pUbpsrZCjxRTQ1upKJxZ2VXjde",
);

export const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s",
);

export const RAYDIUM_CP_SWAP_PROGRAM_ID = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
);

export const DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID = new PublicKey(
  "CPMDWBwJDtYax9qW7AyRuVC19Cc4L4Vcy4n2BHAbHkCW",
);

export const META_MINT = new PublicKey(
  "3gN1WVEJwSHNWjo7hr87DgZp6zkf8kWgAJD29DmfE2Gr",
);
export const MAINNET_USDC = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
);

export const DEVNET_USDC = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const DEVNET_SQUADS_PROGRAM_CONFIG_TREASURY = new PublicKey(
  "HM5y4mz3Bt9JY9mr1hkyhnvqxSH4H2u2451j7Hc2dtvK",
);

export const USDC_DECIMALS = 6;

export const AUTOCRAT_LUTS: PublicKey[] = [];

export const RAYDIUM_AUTHORITY = PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("vault_and_lp_mint_auth_seed")],
  RAYDIUM_CP_SWAP_PROGRAM_ID,
)[0];

export const DEVNET_RAYDIUM_AUTHORITY = PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("vault_and_lp_mint_auth_seed")],
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
)[0];

export const DAMM_V2_PROGRAM_ID = new PublicKey(
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
);

export const DAMM_V2_POOL_AUTHORITY = new PublicKey(
  "HLnpSz9h2S4hiLQ43rnSD9XkcUThA7B8hQMKmDaiTLcC",
);

export const LOW_FEE_RAYDIUM_CONFIG = new PublicKey(
  "D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2",
);

export const DEVNET_LOW_FEE_RAYDIUM_CONFIG = PublicKey.findProgramAddressSync(
  [
    anchor.utils.bytes.utf8.encode("amm_config"),
    new BN(0).toArrayLike(Buffer, "be", 2),
  ],
  DEVNET_RAYDIUM_CP_SWAP_PROGRAM_ID,
)[0];

export const RAYDIUM_CREATE_POOL_FEE_RECEIVE = new PublicKey(
  "DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8",
);

export const DEVNET_RAYDIUM_CREATE_POOL_FEE_RECEIVE = new PublicKey(
  "G11FKBRaAkHAKuLCgLM6K6NUc9rTjPAznRCjZifrTQe2",
);

export const SQUADS_PROGRAM_CONFIG = new PublicKey(
  "BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr",
);

export const SQUADS_PROGRAM_ID = new PublicKey(
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
);

export const SQUADS_PROGRAM_CONFIG_TREASURY = new PublicKey(
  "5DH2e3cJmFpyi6mk65EGFediunm4ui6BiKNUNrhWtD1b",
);

export const SQUADS_PROGRAM_CONFIG_TREASURY_DEVNET = new PublicKey(
  "HM5y4mz3Bt9JY9mr1hkyhnvqxSH4H2u2451j7Hc2dtvK",
);

export const MAINNET_METEORA_CONFIG = new PublicKey(
  "FaA6RM9enPh1tU9Y8LiGCq715JubLc49WGcYTdNvDfsc",
);

export const METADAO_MULTISIG_VAULT = new PublicKey(
  "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf",
);

export const PERMISSIONLESS_ACCOUNT = Keypair.fromSecretKey(
  Uint8Array.from([
    249, 158, 188, 171, 243, 143, 1, 48, 87, 243, 209, 153, 144, 106, 23, 88,
    161, 209, 65, 217, 199, 121, 0, 250, 3, 203, 133, 138, 141, 112, 243, 38,
    198, 205, 120, 222, 160, 224, 151, 190, 84, 254, 127, 178, 224, 195, 130,
    243, 145, 73, 20, 91, 9, 69, 222, 184, 23, 1, 2, 196, 202, 206, 153, 192,
  ]),
);
