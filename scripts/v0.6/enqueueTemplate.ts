import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { FutarchyClient } from "@metadaoproject/programs/futarchy/v0.6";
import { MAINNET_USDC } from "@metadaoproject/programs";
import {
  buildDaoActionTransactions,
  removeSpendingLimit,
  signAndSendDaoActionTransactions,
  transferToken,
  updateDao,
  withdrawLiquidity,
} from "../utils/daoActions.js";

// Template for enqueueing DAO vault actions through the admin approval system.
// Copy it, set the constants, and compose the actions below. Once the ops
// multisig approves + executes the enqueue, approve + execute the DAO proposal
// with executeMultisigProposalApproval.ts - or adminExecuteMultisigProposal.ts
// when an action is signed by the DAO itself, like removeSpendingLimit.

///////////////
// Constants //
///////////////

// The DAO whose vault should execute the actions
const DAO = new PublicKey("3D854kknnQhu9xVaRNV154oZ9oN2WF3tXsq3LDu7fFMn");

////////////////
// Operations //
////////////////

const provider = anchor.AnchorProvider.env();

// Payer MUST be a member of the MetaDAO operational multisig with permission
// to propose transactions
const payer = provider.wallet["payer"];

const futarchy = FutarchyClient.createClient({ provider });

async function main() {
  const transactions = await buildDaoActionTransactions({
    provider,
    futarchy,
    dao: DAO,
    payer: payer.publicKey,
    actions: [
      // Compose the actions the DAO's vault should execute, e.g.:
      //
      updateDao({
        baseToStake: new BN(1_500_000).mul(new BN(10 ** 6)),
        passThresholdBps: 300,
        teamSponsoredPassThresholdBps: -300,
        minBaseFutarchicLiquidity: new BN(1),
        minQuoteFutarchicLiquidity: new BN(1),
      }),
      //
      // withdrawLiquidity({ fractionBps: 5_000, slippageBps: 2_000 }),
      //
      // transferToken({
      //   mint: MAINNET_USDC,
      //   recipient: new PublicKey("..."),
      //   amount: new BN(1_000).mul(new BN(10 ** 6)),
      // }),
      //
      // removeSpendingLimit(),
    ],
  });

  await signAndSendDaoActionTransactions({ provider, payer, transactions });
}

main().catch((error) => {
  console.error("Error enqueueing DAO actions:", error);
  process.exit(1);
});
