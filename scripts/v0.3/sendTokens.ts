import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

const mints: PublicKey[] = [
  new PublicKey("Et9wvs9gEBQtFY2RkvLw2XVLaBqjotHPvQBDvqkKxDR8"), // ORE
  new PublicKey("FfCGxfj1NQdPZpukoEgdX427NEjNdCuh3gpFi6oEf6Ka"), // DARK
  new PublicKey("Hy9aVik24Uy92FuJd8d1hTH6LRCLmquipeTLBGnXqWr1"), // DRIFT
];

const devs = [
  new PublicKey("7gvWPvzqQhNJnmqFq7C8bg6GGtAWj6RaegC2NQscGqrg"),
  new PublicKey("7HWGTDdB7T6QnGn11mE7mKFohQfLkeyLpzTALHD7FWdW"),
  new PublicKey("Fd4A7Kb1JyS1QJ8wZa9Bw6n5ydjLDNHf7xjXeVxC3L6m"),
  new PublicKey("CRANkLNAUCPFapK5zpc1BvXA1WjfZpo6wEmssyECxuxf"),
  new PublicKey("HwBL75xHHKcXSMNcctq3UqWaEJPDWVQz6NazZJNjWaQc"),
  new PublicKey("49G96gYpqEsU1icjoVf45yi7o4CqA33y8jFgiZUzoVx5"),
  new PublicKey("65U66fcYuNfqN12vzateJhZ4bgDuxFWN9gMwraeQKByg"),
];

const amount = 1_000_000;

const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];

async function main() {
  for (let mint of mints) {
    const decimals = (await token.getMint(provider.connection, mint)).decimals;
    const scaledAmount = amount * 10 ** decimals;

    for (let dev of devs) {
      console.log(
        `Airdroppping ${scaledAmount} ${mint.toString()} to ${dev.toString()}`
      );

      let destination = (
        await token.getOrCreateAssociatedTokenAccount(
          provider.connection,
          payer,
          mint,
          dev
        )
      ).address;
      await token.transfer(
        provider.connection,
        payer,
        token.getAssociatedTokenAddressSync(mint, payer.publicKey),
        destination,
        payer,
        scaledAmount
      );
    }
  }
}

main();
