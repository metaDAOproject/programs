import { LiquidationClient } from "@metadaoproject/futarchy/v0.7";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.liquidation = LiquidationClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_liquidation", function () {});
  describe("#set_refund_record", function () {});
  describe("#activate_liquidation", function () {});
  describe("#refund", function () {});
  describe("#withdraw_remaining_quote", function () {});
}
