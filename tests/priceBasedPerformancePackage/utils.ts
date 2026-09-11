import { PublicKey } from "@solana/web3.js";

const OLD_PERFORMANCE_PACKAGE_SIZE = 520;

// Rewrites a package as the 520-byte v0.6.0 layout, rent-exempt at that size.
export async function writeOldLayoutPackage(
  ctx: Mocha.Context,
  performancePackage: PublicKey,
): Promise<void> {
  const account = await ctx.banksClient.getAccount(performancePackage);
  const rent = await ctx.banksClient.getRent();
  ctx.context.setAccount(performancePackage, {
    ...account,
    lamports: Number(rent.minimumBalance(BigInt(OLD_PERFORMANCE_PACKAGE_SIZE))),
    data: account.data.slice(0, OLD_PERFORMANCE_PACKAGE_SIZE),
  });
}
