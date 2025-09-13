import initializeLocker from "./unit/initializeLocker.test.ts";
import startUnlock from "./unit/startUnlock.test.ts";
import completeUnlock from "./unit/completeUnlock.test.ts";
import proposalChange from "./unit/proposeChange.test.js";
import changeLockerAuthority from "./unit/changeLockerAuthority.test.ts";
import executeChange from "./unit/executeChange.test.js";

import priceBasedPremine from "./integration/priceBasedPremine.test.ts";

export default function suite() {
  describe("#initialize_locker", initializeLocker);
  describe("#start_unlock", startUnlock);
  describe("#complete_unlock", completeUnlock);
  describe("#proposal_change", proposalChange);
  describe("#change_locker_authority", changeLockerAuthority);
  describe("#execute_change", executeChange);

  describe("price based premine", priceBasedPremine);
}
