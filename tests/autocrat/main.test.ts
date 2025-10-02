import fullProposal from "./integration/fullProposal.test.js";
import proposalBatchTx from "./integration/proposalBatchTx.test.js";

import initializeDao from "./unit/initializeDao.test.js";
import initializeProposal from "./unit/initializeProposal.test.js";
import finalizeProposal from "./unit/finalizeProposal.test.js";
import spendingLimitChange from "./unit/spendingLimitChange.test.js";

export default function suite() {
  describe("#initialize_dao", initializeDao);
  describe("#initialize_proposal", initializeProposal);
  describe("#finalize_proposal", finalizeProposal);
  describe.only("#upgrade_multisig_dao", spendingLimitChange);

  // describe("autocrat", autocrat);
  describe("full proposal", fullProposal);
  describe("proposal with a squads batch tx", proposalBatchTx);
}
