import initializePerformancePackage from "./unit/initializePerformancePackage.test.js";
import initializePerformancePackageWithLimits from "./unit/initializePerformancePackageWithLimits.test.js";
import startUnlock from "./unit/startUnlock.test.js";
import completeUnlock from "./unit/completeUnlock.test.js";
import withdrawTokens from "./unit/withdrawTokens.test.js";
import proposeChange from "./unit/proposeChange.test.js";
import changePerformancePackageAuthority from "./unit/changePerformancePackageAuthority.test.js";
import executeChange from "./unit/executeChange.test.js";
import burnPerformancePackage from "./unit/burnPerformancePackage.test.js";
import resizePerformancePackage from "./unit/resizePerformancePackage.test.js";

export default function suite() {
  describe("#initialize_performance_package", initializePerformancePackage);
  describe(
    "#initialize_performance_package_with_limits",
    initializePerformancePackageWithLimits,
  );
  describe("#start_unlock", startUnlock);
  describe("#complete_unlock", completeUnlock);
  describe("#withdraw_tokens", withdrawTokens);
  describe("#propose_change", proposeChange);
  describe(
    "#change_performance_package_authority",
    changePerformancePackageAuthority,
  );
  describe("#execute_change", executeChange);
  describe("#burn_performance_package", burnPerformancePackage);
  describe("#resize_performance_package", resizePerformancePackage);
}
