import { PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import BN from "bn.js";

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

export interface RefundRecordSetup {
  recipient: Keypair;
  baseAssigned: BN;
  quoteRefundable: BN;
}

export async function setupLiquidationWithRefundRecords(
  ctx: Mocha.Context,
  records: RefundRecordSetup[],
  opts?: { durationSeconds?: number },
): Promise<{
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseMintAuthority: Keypair;
  createKey: Keypair;
  recordAuthority: Keypair;
  liquidationAuthority: Keypair;
  liquidation: PublicKey;
}> {
  const result = await setupLiquidation(ctx);
  const liquidationClient = ctx.liquidation as LiquidationClient;

  await liquidationClient
    .initializeLiquidationIx({
      durationSeconds: opts?.durationSeconds ?? 86400,
      createKey: result.createKey.publicKey,
      recordAuthority: result.recordAuthority.publicKey,
      liquidationAuthority: result.liquidationAuthority.publicKey,
      baseMint: result.baseMint,
      quoteMint: result.quoteMint,
    })
    .signers([result.createKey])
    .rpc();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const builder = liquidationClient.setRefundRecordIx({
      baseAssigned: record.baseAssigned,
      quoteRefundable: record.quoteRefundable,
      recordAuthority: result.recordAuthority.publicKey,
      liquidation: result.liquidation,
      recipient: record.recipient.publicKey,
    });

    if (i > 0) {
      builder.postInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 + i }),
      ]);
    }

    await builder.signers([result.recordAuthority]).rpc();
  }

  return result;
}
