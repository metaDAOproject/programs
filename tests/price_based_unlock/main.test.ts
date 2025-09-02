// import initializeLocker from "./unit/initializeLocker.test.ts";
// import startUnlock from "./unit/startUnlock.test.ts";
// import completeUnlock from "./unit/completeUnlock.test.ts";

import priceBasedPremine from "./integration/priceBasedPremine.test.ts";

export default function suite() {
  // describe("#initialize_locker", initializeLocker);
  // describe("#start_unlock", startUnlock);
  // describe("#complete_unlock", completeUnlock);

  describe("price based premine", priceBasedPremine);
}
