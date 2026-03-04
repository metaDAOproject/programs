import { PublicKey, Keypair } from "@solana/web3.js";
import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";

export async function setupLiquidation(ctx: Mocha.Context): Promise<{
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseMintAuthority: Keypair;
  createKey: Keypair;
  recordAuthority: Keypair;
  liquidationAuthority: Keypair;
  liquidation: PublicKey;
}> {
  const baseMintAuthority = Keypair.generate();
  const baseMint = await ctx.createMint(baseMintAuthority.publicKey, 6);
  const quoteMint = await ctx.createMint(ctx.payer.publicKey, 6);

  const createKey = Keypair.generate();
  const recordAuthority = Keypair.generate();
  const liquidationAuthority = Keypair.generate();

  const liquidationClient = ctx.liquidation as LiquidationClient;
  const liquidation = liquidationClient.getLiquidationAddress({
    baseMint,
    quoteMint,
    createKey: createKey.publicKey,
  });

  return {
    baseMint,
    quoteMint,
    baseMintAuthority,
    createKey,
    recordAuthority,
    liquidationAuthority,
    liquidation,
  };
}
