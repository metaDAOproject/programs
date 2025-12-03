import initializeBidWall from "./unit/initializeBidWall.test.js";
import sellTokens from "./unit/sellTokens.test.js";
import collectFees from "./unit/collectFees.test.js";
import closeBidWall from "./unit/closeBidWall.test.js";
import cancelBidWall from "./unit/cancelBidWall.test.js";

export default function suite() {
  describe("#initialize_bid_wall", initializeBidWall);
  describe("#sell_tokens", sellTokens);
  describe("#collect_fees", collectFees);
  describe("#close_bid_wall", closeBidWall);
  describe("#cancel_bid_wall", cancelBidWall);
}
