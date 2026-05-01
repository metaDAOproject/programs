import initializeGatedMint from "./unit/initializeGatedMint.test.js";
import addWhitelistedUser from "./unit/addWhitelistedUser.test.js";
import disableGating from "./unit/disableGating.test.js";
import thawAccount from "./unit/thawAccount.test.js";
import { GatedTokenClient } from "@metadaoproject/programs";
import { BankrunProvider } from "anchor-bankrun";

export default function suite() {
  before(async function () {
    const provider = new BankrunProvider(this.context);
    this.gatedToken = GatedTokenClient.createClient({
      provider: provider as any,
    });
  });

  describe("#initialize_gated_mint", initializeGatedMint);
  describe("#add_whitelisted_user", addWhitelistedUser);
  describe("#disable_gating", disableGating);
  describe("#thaw_account", thawAccount);
}
