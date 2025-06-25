import initializeSharedLiquidityPool from "./unit/initializeSharedLiquidityPool.test.js";
import initializeDraftProposal from "./unit/initializeDraftProposal.test.js";
import stakeToDraftProposal from "./unit/stakeToDraftProposal.test.js";
import unstakeFromDraftProposal from "./unit/unstakeFromDraftProposal.test.js";
import depositSharedLiquidity from "./unit/depositSharedLiquidity.test.js";
import withdrawSharedLiquidity from "./unit/withdrawSharedLiquidity.test.js";
import initializeProposalWithLiquidity from "./unit/initializeProposalWithLiquidity.test.js";
import removeProposalLiquidity from "./unit/removeProposalLiquidity.test.js";
import sharedLiquidityManagerLifecycle from "./integration/sharedLiquidityManagerLifecycle.test.js";

export default function suite() {
  describe("#initialize_shared_liquidity_pool", initializeSharedLiquidityPool);
  describe("#initialize_draft_proposal", initializeDraftProposal);
  describe("#stake_to_draft_proposal", stakeToDraftProposal);
  describe("#unstake_from_draft_proposal", unstakeFromDraftProposal);
  describe("#deposit_shared_liquidity", depositSharedLiquidity);
  describe("#withdraw_shared_liquidity", withdrawSharedLiquidity);
  describe("#initialize_proposal_with_liquidity", initializeProposalWithLiquidity);
  // describe("#remove_proposal_liquidity", removeProposalLiquidity);
  it("shared liquidity manager lifecycle", sharedLiquidityManagerLifecycle);
}
