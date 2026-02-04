import futarchyAmm from "./integration/futarchyAmm.test.js";

import initializeDao from "./unit/initializeDao.test.js";
import initializeProposal from "./unit/initializeProposal.test.js";
import finalizeProposal from "./unit/finalizeProposal.test.js";
import updateDao from "./unit/updateDao.test.js";

import collectFees from "./unit/collectFees.test.js";
import conditionalSwap from "./unit/conditionalSwap.test.js";
import provideLiquidity from "./unit/provideLiquidity.test.js";

import executeSpendingLimitChange from "./unit/executeSpendingLimitChange.test.js";

import collectMeteoraDammFees from "./unit/collectMeteoraDammFees.test.js";
import adminApproveProposal from "./unit/adminApproveExecuteMultisigProposal.test.js";

import { PublicKey } from "@solana/web3.js";
import {
  LAUNCHPAD_PROGRAM_ID,
  MAINNET_METEORA_CONFIG,
} from "@metadaoproject/futarchy/v0.7";

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
      LAUNCHPAD_PROGRAM_ID,
    );

    dynamicConfig.data.set(
      poolCreatorAuthority.toBuffer(),
      poolCreatorAuthorityOffset,
    );
    dynamicConfig.data.set([1], configTypeOffset);

    this.context.setAccount(MAINNET_METEORA_CONFIG, dynamicConfig);
  });
  describe("#initialize_dao", initializeDao);
  describe("#initialize_proposal", initializeProposal);
  describe("#finalize_proposal", finalizeProposal);
  describe("#update_dao", updateDao);

  describe("#collect_fees", collectFees);
  describe("#conditional_swap", conditionalSwap);
  describe("#provide_liquidity", provideLiquidity);
  describe("#execute_spending_limit_change", executeSpendingLimitChange);

  describe("#collect_meteora_damm_fees", collectMeteoraDammFees);

  describe("#admin_approve_proposal", adminApproveProposal);
  // describe("full proposal", fullProposal);
  // describe("proposal with a squads batch tx", proposalBatchTx);
  describe("futarchy amm", futarchyAmm);
}
