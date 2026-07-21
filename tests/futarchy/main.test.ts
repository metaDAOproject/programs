import futarchyAmm from "./integration/futarchyAmm.test.js";

import initializeDao from "./unit/initializeDao.test.js";
import initializeProposal from "./unit/initializeProposal.test.js";
import initializeLargeSpendProposal from "./unit/initializeLargeSpendProposal.test.js";
import initializeMintTokensProposal from "./unit/initializeMintTokensProposal.test.js";
import initializeSpendingLimitChangeProposal from "./unit/initializeSpendingLimitChangeProposal.test.js";
import initializeHostileTakeoverProposal from "./unit/initializeHostileTakeoverProposal.test.js";
import launchProposal from "./unit/launchProposal.test.js";
import finalizeProposal from "./unit/finalizeProposal.test.js";
import updateDao from "./unit/updateDao.test.js";
import setSpendingLimit from "./unit/setSpendingLimit.test.js";
import syncSpendingLimit from "./unit/syncSpendingLimit.test.js";

import collectFees from "./unit/collectFees.test.js";
import conditionalSwap from "./unit/conditionalSwap.test.js";
import provideLiquidity from "./unit/provideLiquidity.test.js";

import collectMeteoraDammFees from "./unit/collectMeteoraDammFees.test.js";

import adminEnqueueMultisigProposalApproval from "./unit/adminEnqueueMultisigProposalApproval.test.js";
import executeMultisigProposalApproval from "./unit/executeMultisigProposalApproval.test.js";
import adminExecuteMultisigProposal from "./unit/adminExecuteMultisigProposal.test.js";
import adminCancelProposal from "./unit/adminCancelProposal.test.js";
import adminRemoveProposal from "./unit/adminRemoveProposal.test.js";
import unstakeFromProposal from "./unit/unstakeFromProposal.test.js";

import { PublicKey } from "@solana/web3.js";
import {
  LAUNCHPAD_V0_7_PROGRAM_ID,
  LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
} from "@metadaoproject/programs";

export default function suite() {
  before(async function () {
    const dynamicConfig = await this.banksClient.getAccount(
      new PublicKey("4mPQ4VuvvtYL3CeMPt14Uj1CLpBWcVdJoLoTH9ea4Kod"),
    );

    // discriminator + vault config authority
    const poolCreatorAuthorityOffset = 8 + 32;
    // discriminator + vault config authority + pool creator authority + pool fees config + activation type + collect fee mode
    const configTypeOffset = 8 + 32 + 32 + 128 + 1 + 1;

    const [poolCreatorAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("damm_pool_creator_authority")],
      LAUNCHPAD_V0_7_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(
      LAUNCHPAD_V0_7_MAINNET_METEORA_CONFIG,
      dynamicConfig,
    );
  });
  describe("#initialize_dao", initializeDao);
  describe("#initialize_proposal", initializeProposal);
  describe("#initialize_large_spend_proposal", initializeLargeSpendProposal);
  describe("#initialize_mint_tokens_proposal", initializeMintTokensProposal);
  describe(
    "#initialize_spending_limit_change_proposal",
    initializeSpendingLimitChangeProposal,
  );
  describe(
    "#initialize_hostile_takeover_proposal",
    initializeHostileTakeoverProposal,
  );
  describe("#launch_proposal", launchProposal);
  describe("#finalize_proposal", finalizeProposal);
  describe("#update_dao", updateDao);
  describe("#set_spending_limit", setSpendingLimit);
  describe("#sync_spending_limit", syncSpendingLimit);

  describe("#collect_fees", collectFees);
  describe("#conditional_swap", conditionalSwap);
  describe("#provide_liquidity", provideLiquidity);

  describe("#collect_meteora_damm_fees", collectMeteoraDammFees);

  describe(
    "#admin_enqueue_multisig_proposal_approval",
    adminEnqueueMultisigProposalApproval,
  );
  describe(
    "#execute_multisig_proposal_approval",
    executeMultisigProposalApproval,
  );
  describe("#admin_execute_multisig_proposal", adminExecuteMultisigProposal);
  describe("#admin_cancel_proposal", adminCancelProposal);
  describe("#admin_remove_proposal", adminRemoveProposal);
  describe("#unstake_from_proposal", unstakeFromProposal);
  // describe("full proposal", fullProposal);
  // describe("proposal with a squads batch tx", proposalBatchTx);
  describe("futarchy amm", futarchyAmm);
}
