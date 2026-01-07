import * as anchor from "@coral-xyz/anchor";
import * as multisig from "@sqds/multisig";
import {
  CONDITIONAL_VAULT_PROGRAM_ID,
  FUTARCHY_PROGRAM_ID,
  FutarchyClient,
  MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy/v0.7";
import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

// MetaDAO multisig vault - hardcoded fee destination
const METADAO_MULTISIG_VAULT = new PublicKey(
  "6awyHMshBGVjJ3ozdSJdyyDE1CTAXUwrpNMaRGMsb4sf",
);

// DAOs to skip
const SKIP_DAOS: string[] = ["DaoPublicKeyHere"];

const provider = anchor.AnchorProvider.env();

const payer = provider.wallet["payer"];

const futarchy: FutarchyClient = new FutarchyClient(
  provider,
  FUTARCHY_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  [],
);

interface FeeCollectionResult {
  dao: string;
  internalFees: { success: boolean; signature?: string; error?: string };
  meteoraFees: { success: boolean; signature?: string; error?: string };
}

const collectAllFees = async () => {
  // Fetch all DAOs
  console.log("[1] Fetching all DAOs...");
  const allDaos = await futarchy.autocrat.account.dao.all();
  console.log(`Found ${allDaos.length} DAOs\n`);

  const results: FeeCollectionResult[] = [];

  const daosToProcess = allDaos.filter(
    (dao) => !SKIP_DAOS.includes(dao.publicKey.toBase58()),
  );
  if (SKIP_DAOS.length > 0) {
    console.log(
      `Skipping ${allDaos.length - daosToProcess.length} DAOs from skip list\n`,
    );
  }

  for (let i = 0; i < daosToProcess.length; i++) {
    const dao = daosToProcess[i];
    const daoKey = dao.publicKey.toBase58();
    console.log(`[${i + 1}/${daosToProcess.length}] Processing DAO: ${daoKey}`);

    const result: FeeCollectionResult = {
      dao: daoKey,
      internalFees: { success: false },
      meteoraFees: { success: false },
    };

    // Create ATA addresses and instructions (used by both fee collection methods)
    const baseAta = getAssociatedTokenAddressSync(
      dao.account.baseMint,
      METADAO_MULTISIG_VAULT,
      true,
    );
    const quoteAta = getAssociatedTokenAddressSync(
      dao.account.quoteMint,
      METADAO_MULTISIG_VAULT,
      true,
    );

    const createBaseAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      baseAta,
      METADAO_MULTISIG_VAULT,
      dao.account.baseMint,
    );
    const createQuoteAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      quoteAta,
      METADAO_MULTISIG_VAULT,
      dao.account.quoteMint,
    );

    // Collect internal Futarchy AMM fees
    try {
      const signature = await futarchy
        .collectFeesIx({
          dao: dao.publicKey,
          baseMint: dao.account.baseMint,
          quoteMint: dao.account.quoteMint,
        })
        .preInstructions([createBaseAtaIx, createQuoteAtaIx])
        .rpc();

      result.internalFees = { success: true, signature };
      console.log(`    Success: ${signature}`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      result.internalFees = { success: false, error: errorMsg };

      // Check if it's just "no fees to collect" (pool has 0 fees)
      if (errorMsg.includes("PoolNotInSpotState")) {
        console.log(`    Skipped: Pool not in spot state`);
      } else {
        console.log(`    Failed: ${errorMsg.slice(0, 100)}`);
      }
    }

    // Collect Meteora DAMM fees
    try {
      console.log("  - Collecting Meteora DAMM fees...");

      // Get the DAO's squads multisig transaction index
      const squadsMultisigAccount =
        await multisig.accounts.Multisig.fromAccountAddress(
          provider.connection,
          dao.account.squadsMultisig,
        );

      const signature = await futarchy
        .collectMeteoraDammFeesIx({
          dao: dao.publicKey,
          baseMint: dao.account.baseMint,
          quoteMint: dao.account.quoteMint,
          transactionIndex:
            BigInt(squadsMultisigAccount.transactionIndex.toString()) + 1n,
          meteoraConfig: MAINNET_METEORA_CONFIG,
        })
        .preInstructions([createBaseAtaIx, createQuoteAtaIx])
        .rpc();

      result.meteoraFees = { success: true, signature };
      console.log(`    Success: ${signature}`);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      result.meteoraFees = { success: false, error: errorMsg };

      // Check if it's expected error (no Meteora pool)
      if (
        errorMsg.includes("Account does not exist") ||
        errorMsg.includes("position") ||
        errorMsg.includes("AccountNotFound")
      ) {
        console.log(`    Skipped: No Meteora pool for this DAO`);
      } else {
        console.log(`    Failed: ${errorMsg.slice(0, 100)}`);
      }
    }

    results.push(result);
    console.log("");
  }

  console.log(`Total DAOs processed: ${results.length}`);

  // Show failures
  const failures = results.filter(
    (r) =>
      !r.internalFees.success &&
      r.internalFees.error &&
      !r.internalFees.error.includes("PoolNotInSpotState"),
  );
  if (failures.length > 0) {
    console.log(`\nInternal fee collection failures:`);
    failures.forEach((f) => {
      console.log(`  - ${f.dao}: ${f.internalFees.error?.slice(0, 80)}`);
    });
  }
};

collectAllFees().catch(console.error);
