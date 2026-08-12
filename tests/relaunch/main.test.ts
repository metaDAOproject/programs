import scaffold from "./unit/scaffold.test.js";
import venues from "./unit/venues.test.js";
import initializeRelaunch from "./unit/initializeRelaunch.test.js";
import startDeposits from "./unit/startDeposits.test.js";
import deposit from "./unit/deposit.test.js";
import depositViaBuy from "./unit/depositViaBuy.test.js";
import closeDeposits from "./unit/closeDeposits.test.js";
import executeSell from "./unit/executeSell.test.js";
import executeUsdcSwap from "./unit/executeUsdcSwap.test.js";
import completeRelaunch from "./unit/completeRelaunch.test.js";
import claim from "./unit/claim.test.js";
import markFailed from "./unit/markFailed.test.js";
import claimRefund from "./unit/claimRefund.test.js";
import altTransactions from "./unit/altTransactions.test.js";
import { RelaunchClient } from "@metadaoproject/programs";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.relaunch = RelaunchClient.createClient({
      provider: provider as any,
    });
  });

  describe("scaffold", scaffold);
  describe("venues", venues);
  describe("#initialize_relaunch", initializeRelaunch);
  describe("#start_deposits", startDeposits);
  describe("#deposit", deposit);
  describe("#deposit_via_buy", depositViaBuy);
  describe("#close_deposits", closeDeposits);
  describe("#execute_sell", executeSell);
  describe("#execute_usdc_swap", executeUsdcSwap);
  describe("#complete_relaunch", completeRelaunch);
  describe("#claim", claim);
  describe("#mark_failed", markFailed);
  describe("#claim_refund", claimRefund);
  describe("ALT transactions", altTransactions);
}
