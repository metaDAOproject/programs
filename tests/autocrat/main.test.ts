import autocrat from "./autocrat.js";
import fullProposal from "./integration/fullProposal.test.js";

export default function suite() {
  describe("autocrat", autocrat);
  describe.only("full proposal", fullProposal);
}
