import initializePerformancePackage from "./unit/initializePerformancePackage.test.js";
import startUnlock from "./unit/startUnlock.test.js";
import completeUnlock from "./unit/completeUnlock.test.js";
import changeAuthority from "./unit/changeAuthority.test.js";
import proposeChange from "./unit/proposeChange.test.js";
import executeChange from "./unit/executeChange.test.js";
import {
  MintGovernorClient,
  PerformancePackageV2Client,
} from "@metadaoproject/futarchy/v0.7";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.mintGovernor = MintGovernorClient.createClient({
      provider: provider as any,
    });
    this.performancePackageV2 = PerformancePackageV2Client.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_performance_package", initializePerformancePackage);
  describe("#start_unlock", startUnlock);
  describe("#complete_unlock", completeUnlock);
  describe("#change_authority", changeAuthority);
  describe("#propose_change", proposeChange);
  describe("#execute_change", executeChange);
}
