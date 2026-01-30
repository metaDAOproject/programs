import initializePerformancePackage from "./unit/initializePerformancePackage.test.js";
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
}
