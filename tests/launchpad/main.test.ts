import initializeLaunch from "./unit/initializeLaunch.test.js";
import startLaunch from "./unit/startLaunch.test.js";
import fund from "./unit/fund.test.js";
import completeLaunch from "./unit/completeLaunch.test.js";
import claim from "./unit/claim.test.js";
import refund from "./unit/refund.test.js";
import closeLaunch from "./unit/closeLaunch.test.js";

// TODO add a many-outcome integration test
export default function suite() {
  describe("#initialize_launch", initializeLaunch);
  describe("#start_launch", startLaunch);
  describe("#fund", fund);
  describe("#complete_launch", completeLaunch);
  describe("#claim", claim);
  describe("#refund", refund);
  describe("#close_launch", closeLaunch);
}
