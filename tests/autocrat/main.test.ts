import autocrat from "./autocrat.js";
import fullProposal from "./integration/fullProposal.test.js";

import initializeDao from "./unit/initializeDao.test.js";

export default function suite() {
  describe.only("#initialize_dao", initializeDao);

  describe("autocrat", autocrat);
  describe("full proposal", fullProposal);

}
