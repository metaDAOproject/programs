import fullProposal from "./integration/fullProposal.test.js";
import futarchyAmm from "./integration/futarchyAmm.test.js";

import initializeDao from "./unit/initializeDao.test.js";
import initializeProposal from "./unit/initializeProposal.test.js";
import finalizeProposal from "./unit/finalizeProposal.test.js";

export default function suite() {
  describe("#initialize_dao", initializeDao);
  describe("#initialize_proposal", initializeProposal);
  describe("#finalize_proposal", finalizeProposal);

  // describe("autocrat", autocrat);
  describe("full proposal", fullProposal);
  describe.only("futarchy amm", futarchyAmm);
}
