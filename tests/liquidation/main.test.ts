import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import { BankrunProvider } from "anchor-bankrun";
import initializeLiquidation from "./unit/initializeLiquidation.test.js";
import setRefundRecord from "./unit/setRefundRecord.test.js";
import activateLiquidation from "./unit/activateLiquidation.test.js";
import refund from "./unit/refund.test.js";
import withdrawRemainingQuote from "./unit/withdrawRemainingQuote.test.js";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.liquidation = LiquidationClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_liquidation", initializeLiquidation);
  describe("#set_refund_record", setRefundRecord);
  describe("#activate_liquidation", activateLiquidation);
  describe("#refund", refund);
  describe.only("#withdraw_remaining_quote", withdrawRemainingQuote);
}
