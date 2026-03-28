import {
  PublicKey,
  Keypair,
  ComputeBudgetProgram,
  SystemProgram,
} from "@solana/web3.js";
import { LiquidationClient } from "@metadaoproject/futarchy-v2";
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

export async function setupActivatedLiquidation(
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
  const result = await setupLiquidationWithRefundRecords(ctx, records, opts);
  const liquidationClient = ctx.liquidation as LiquidationClient;

  // Fund recipients with SOL for rent (needed for init_if_needed quote ATA)
  for (const record of records) {
    ctx.context.setAccount(record.recipient.publicKey, {
      data: Buffer.alloc(0),
      executable: false,
      owner: SystemProgram.programId,
      lamports: 1_000_000_000,
    });
  }

  const totalQuoteRefundable = records.reduce(
    (sum, r) => sum.add(r.quoteRefundable),
    new BN(0),
  );

  await ctx.mintTo(
    result.quoteMint,
    result.liquidationAuthority.publicKey,
    ctx.payer,
    totalQuoteRefundable.toNumber(),
  );

  await liquidationClient
    .activateLiquidationIx({
      liquidationAuthority: result.liquidationAuthority.publicKey,
      liquidation: result.liquidation,
      quoteMint: result.quoteMint,
    })
    .signers([result.liquidationAuthority])
    .rpc();

  return result;
}
