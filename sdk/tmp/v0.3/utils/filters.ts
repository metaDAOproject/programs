import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";

export const filterPositionsByUser = (
  userAddr: PublicKey
): GetProgramAccountsFilter => ({
  memcmp: {
    offset: 8, // discriminator
    bytes: userAddr.toBase58(),
  },
});

export const filterPositionsByAmm = (
  ammAddr: PublicKey
): GetProgramAccountsFilter => ({
  memcmp: {
    offset:
      8 + // discriminator
      32, // user address
    bytes: ammAddr.toBase58(),
  },
});
