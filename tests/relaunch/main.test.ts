import scaffold from "./unit/scaffold.test.js";
import venues from "./unit/venues.test.js";
import initializeRelaunch from "./unit/initializeRelaunch.test.js";
import startDeposits from "./unit/startDeposits.test.js";
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
}
