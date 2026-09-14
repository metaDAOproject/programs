import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import {
  PriceBasedPerformancePackageClient,
  WithdrawalMode,
} from "@metadaoproject/programs/price_based_performance_package";
import {
  buildDaoActionTransactions,
  proposePerformancePackageUnlockTerms,
  signAndSendDaoActionTransactions,
} from "../../utils/daoActions.js";

// Enqueues the Rip Cars unlock terms change through the admin approval system:
// the cliff on the performance package is removed and, until the original
// cliff date, withdrawals are capped per 30-day window. Once the ops multisig
// approves + executes the enqueue, approve + execute the DAO proposal with
// executeMultisigProposalApproval.ts; the recipient then applies the change
// with executeChange.ts.

///////////////
// Constants //
///////////////

const PERFORMANCE_PACKAGE = new PublicKey(
  "92NY2WWWNAfnMr8qyGXWXKbauhnR7d6ei9j9BGHVwh7r",
);

// Removes the cliff; any time at or before the change executes would do
const MIN_UNLOCK_TIMESTAMP = new BN(0);

// The original cliff date, 2028-01-16; withdrawals are uncapped from then on
const END_TIMESTAMP = new BN(Date.UTC(2028, 0, 16) / 1_000);
const WINDOW_SECONDS = 30 * 24 * 60 * 60;
// 645,000 CARS, 5% of the 12,900,000 in the package
const MAX_TOKENS_PER_WINDOW = new BN(645_000).mul(new BN(10 ** 6));
// 100,000 USDC
const MAX_QUOTE_PER_WINDOW = new BN(100_000).mul(new BN(10 ** 6));

// Distinguishes this change request from others the vault proposes
const PDA_NONCE = 1;

////////////////
// Operations //
////////////////

const WITHDRAWAL_MODES: Record<string, WithdrawalMode> = {
  tokens: { tokens: {} },
  sell: { sell: {} },
  both: { both: {} },
};

const withdrawalMode = WITHDRAWAL_MODES.both;

const provider = anchor.AnchorProvider.env();

// Payer MUST be a member of the MetaDAO operational multisig with permission
// to propose transactions
const payer = provider.wallet["payer"];

const futarchy = FutarchyClient.createClient({ provider });
const priceBasedPerformancePackage =
  PriceBasedPerformancePackageClient.createClient({ provider });

async function main() {
  // The package reads its price from the Rip Cars DAO
  const { oracleConfig } =
    await priceBasedPerformancePackage.getPerformancePackage(
      PERFORMANCE_PACKAGE,
    );
  const dao = oracleConfig.oracleAccount;

  console.log("DAO:", dao.toBase58());
  console.log(
    "Withdrawal mode: both token withdrawals and sells into FutarchyAMM",
  );

  const transactions = await buildDaoActionTransactions({
    provider,
    futarchy,
    dao,
    payer: payer.publicKey,
    actions: [
      proposePerformancePackageUnlockTerms({
        performancePackage: PERFORMANCE_PACKAGE,
        minUnlockTimestamp: MIN_UNLOCK_TIMESTAMP,
        limits: {
          endTimestamp: END_TIMESTAMP,
          windowSeconds: WINDOW_SECONDS,
          maxTokensPerWindow: MAX_TOKENS_PER_WINDOW,
          maxQuotePerWindow: MAX_QUOTE_PER_WINDOW,
          withdrawalMode,
        },
        pdaNonce: PDA_NONCE,
      }),
    ],
  });

  await signAndSendDaoActionTransactions({ provider, payer, transactions });
}

main().catch((error) => {
  console.error("Error enqueueing DAO actions:", error);
  process.exit(1);
});
