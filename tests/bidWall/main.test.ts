import initializeBidWall from "./unit/initializeBidWall.test.js";
import sellTokens from "./unit/sellTokens.test.js";
import closeBidWall from "./unit/closeBidWall.test.js";

// TODO add a many-outcome integration test
export default function suite() {
  describe("#initialize_bid_wall", initializeBidWall);
  describe("#sell_tokens", sellTokens);
  describe("#close_bid_wall", closeBidWall);
}
