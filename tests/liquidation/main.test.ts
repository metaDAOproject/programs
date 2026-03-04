import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import { BankrunProvider } from "anchor-bankrun";
import initializeLiquidation from "./unit/initializeLiquidation.test.js";
import setRefundRecord from "./unit/setRefundRecord.test.js";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.liquidation = LiquidationClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_liquidation", initializeLiquidation);
  describe.only("#set_refund_record", setRefundRecord);
  describe("#activate_liquidation", function () {});
  describe("#refund", function () {});
  describe("#withdraw_remaining_quote", function () {});
}
